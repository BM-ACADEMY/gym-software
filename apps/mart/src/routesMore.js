'use strict';
// MRT-12 routes, mounted by createMartRouter: change password, UPI QR image, paid leave balance, shifts, printable payslip.
// Same rules as routes.js: every query filters by tenantId; owner-only routes check ownerOnly; role access is in permissions.js.
const PR = require('./payroll'); const SH = require('./shifts'); const QR = require('./qr'); const { payslipHtml } = require('./payslipPage'); const S = require('./session');
const { MIN_PASSWORD, MAX_FAILS, LOCK_MS } = require('./signup');

function mountMore({ router, M, wrap, fail, audit, ownerOnly, toOid, today, now, monthOf, settingsOf, staffByName, hashFn, verifyFn, valid, addDays }) {
  const passwordOk = (pw) => typeof pw === 'string' && pw.length >= MIN_PASSWORD && pw.length <= 100;
  const PW_MSG = `The password must be ${MIN_PASSWORD} to 100 characters.`;

  // ---- change password ----
  // Owner sets a new password for a team login (manager, cashier, stock keeper). The old sign-ins of that person stop working.
  router.post('/team/password', wrap(async (req, res, tid) => {
    if (!ownerOnly(req, res)) return; const b = req.body || {}; const email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 120) : '';
    if (!passwordOk(b.password)) return fail(res, 400, PW_MSG);
    const u = email ? await M.User.findOne({ email, tenantId: tid }) : null; if (!u) return fail(res, 404, 'No team login with that email.');
    if (u.role === 'admin') return fail(res, 400, 'Change your own password from "My password".');
    await M.User.updateOne({ _id: u._id, tenantId: tid }, { $set: { passwordHash: await hashFn(b.password), passwordChangedAt: now(), failedLogins: 0, lockedUntil: null } });
    await audit(tid, req, 'team_password', String(u._id)); res.json({ success: true, message: 'Password changed. Tell the person the new password; they must sign in again.' });
  }));
  // Who changed which login's password and when (no passwords, no hashes).
  router.get('/team/password', wrap(async (req, res, tid) => {
    if (!ownerOnly(req, res)) return;
    const rows = await M.Audit.find({ tenantId: tid, action: { $in: ['team_password', 'self_password'] } }).sort({ createdAt: -1 }).limit(100).lean();
    const users = await M.User.find({ tenantId: tid }).limit(200).lean(); const nm = Object.fromEntries(users.map((x) => [String(x._id), x.name || x.email]));
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: rows.map((r) => ({ id: String(r._id), at: r.createdAt, action: r.action === 'team_password' ? 'Owner changed' : 'Changed own', login: r.action === 'team_password' ? nm[r.ref] || '' : nm[r.by] || '' })) });
  }));
  // Anyone signed in changes their own password. Needs the current one; five wrong tries lock it for 15 minutes.
  router.post('/my-password', wrap(async (req, res, tid) => {
    const b = req.body || {}; const u = await M.User.findOne({ _id: req.user.id, tenantId: tid }).select('+passwordHash'); if (!u) return fail(res, 401, 'Please sign in.');
    if (u.lockedUntil && new Date(u.lockedUntil) > now()) return fail(res, 429, 'Too many tries. Please wait 15 minutes and try again.');
    if (!(await verifyFn(String(b.current || ''), u.passwordHash))) {
      const fails = (u.failedLogins || 0) + 1; await M.User.updateOne({ _id: u._id, tenantId: tid }, { $set: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(now().getTime() + LOCK_MS) } : { failedLogins: fails } });
      return fail(res, 400, 'The current password is not right.');
    }
    if (!passwordOk(b.password)) return fail(res, 400, PW_MSG);
    if (b.password === b.current) return fail(res, 400, 'Choose a password that is different from the current one.');
    await M.User.updateOne({ _id: u._id, tenantId: tid }, { $set: { passwordHash: await hashFn(b.password), passwordChangedAt: now(), failedLogins: 0, lockedUntil: null } });
    await audit(tid, req, 'self_password', String(u._id)); res.set('Set-Cookie', S.clearCookie());
    res.json({ success: true, signedOut: true, message: 'Password changed. Please sign in again with the new password.' });
  }));

  // ---- UPI QR image for a link the shop made (the customer scans it with any UPI app; we still cannot see the money) ----
  router.get('/upi-links/:id/qr.svg', wrap(async (req, res, tid) => {
    const id = toOid(req.params.id); const d = id ? await M.UpiLink.findOne({ _id: id, tenantId: tid }).lean() : null; if (!d) return fail(res, 404, 'Not found');
    let svg; try { svg = QR.qrSvg(d.link, { ecl: 'M', scale: 6 }); } catch (e) { return fail(res, 400, 'This link is too long to make a code.'); }
    res.set('Content-Type', 'image/svg+xml; charset=utf-8'); res.set('Cache-Control', 'no-store'); res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"); res.send(svg);
  }));

  // ---- paid leave balance and slips ----
  // Paid-leave days used before this month in the same calendar year, per staff member (for the yearly allowance).
  const leaveUsed = async (tid, month) => {
    const rows = await M.Attendance.find({ tenantId: tid, status: 'paid_leave', day: { $gte: month.slice(0, 4) + '-01-01', $lt: month + '-01' } }).limit(20000).lean();
    const used = {}; for (const r of rows) used[String(r.staffId)] = (used[String(r.staffId)] || 0) + 1; return used;
  };
  const slipsFor = async (tid, month, staffId) => {
    const st = await settingsOf(tid); const allowance = Number.isInteger(st.paidLeaveAllowance) ? st.paidLeaveAllowance : null;
    const q = { tenantId: tid, isActive: true }; if (staffId) q._id = staffId;
    const [staff, marks, adv, used] = await Promise.all([M.Staff.find(q).sort({ name: 1 }).limit(200).lean(), M.Attendance.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }).limit(6200).lean(), M.Advance.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }).limit(2000).lean(), leaveUsed(tid, month)]);
    return staff.map((x) => ({ id: String(x._id), slip: PR.payslip({ name: x.name, monthlySalary: x.monthlySalary, month, marks: marks.filter((m) => String(m.staffId) === String(x._id)), advances: adv.filter((a) => String(a.staffId) === String(x._id)), joinedOn: x.joinedOn, leave: { allowance, usedBefore: used[String(x._id)] || 0 } }) }));
  };
  router.get('/leave-balance', wrap(async (req, res, tid) => {
    if (!ownerOnly(req, res)) return; const month = monthOf(req.query.month); const st = await settingsOf(tid); const allowance = Number.isInteger(st.paidLeaveAllowance) ? st.paidLeaveAllowance : null;
    const [staff, rows] = await Promise.all([M.Staff.find({ tenantId: tid, isActive: true }).sort({ name: 1 }).limit(200).lean(), M.Attendance.find({ tenantId: tid, status: 'paid_leave', day: { $gte: month.slice(0, 4) + '-01-01', $lte: month + '-31' } }).limit(20000).lean()]);
    const used = {}; for (const r of rows) used[String(r.staffId)] = (used[String(r.staffId)] || 0) + 1;
    res.set('Cache-Control', 'no-store'); res.json({ success: true, year: month.slice(0, 4), allowance, data: staff.map((x) => ({ id: String(x._id), name: x.name, used: used[String(x._id)] || 0, remaining: allowance === null ? null : Math.max(0, allowance - (used[String(x._id)] || 0)) })), note: allowance === null ? 'No yearly limit is set. Set one in Settings to count paid leave.' : 'Paid leave marked beyond the allowance is paid as unpaid leave.' });
  }));
  // Printable one-page payslip (owner only). Opens as a page; print it from the browser.
  router.get('/payslip/print', wrap(async (req, res, tid) => {
    if (!ownerOnly(req, res)) return; const id = toOid(String(req.query.staffId || '')); if (!id) return fail(res, 400, 'Choose a staff member.');
    if (req.query.month !== undefined && !PR.validMonth(req.query.month)) return fail(res, 400, 'Month must look like 2026-11.');
    const month = monthOf(req.query.month); const rows = await slipsFor(tid, month, id); if (!rows.length) return fail(res, 404, 'Not found');
    const t = await M.Tenant.findOne({ _id: tid }).lean(); await audit(tid, req, 'payslip_print', id);
    res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'no-store'); res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"); res.set('X-Content-Type-Options', 'nosniff'); res.send(payslipHtml(rows[0].slip, t && t.shopName));
  }));

  // ---- shifts ----
  router.get('/shifts', wrap(async (req, res, tid) => {
    const month = monthOf(req.query.month); const [staff, rows] = await Promise.all([M.Staff.find({ tenantId: tid }).limit(200).lean(), M.Shift.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }).sort({ day: -1 }).limit(3000).lean()]);
    const nm = Object.fromEntries(staff.map((x) => [String(x._id), x.name])); const tot = SH.totals(rows);
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: rows.map((s) => ({ id: String(s._id), staff: nm[String(s.staffId)] || '', day: s.day, start: s.start, end: s.end, hours: SH.hours(SH.check(s).minutes || 0), note: s.note })), hoursByStaff: Object.fromEntries(Object.entries(tot).map(([k, v]) => [nm[k] || k, v])), month });
  }));
  router.post('/shifts', wrap(async (req, res, tid) => {
    const b = req.body || {}; const st = await staffByName(tid, b.staff); if (!st) return fail(res, 404, 'Staff member not found. Type the name exactly as in your staff list.');
    const day = b.day === undefined || b.day === '' ? today() : b.day; if (!valid(day) || day > addDays(today(), 60)) return fail(res, 400, 'Choose a real date within the next 60 days.');
    const c = SH.check(b); if (c.error) return fail(res, 400, c.error);
    const same = await M.Shift.find({ tenantId: tid, staffId: st._id, day }).limit(10).lean(); if (same.length >= 4) return fail(res, 400, 'That is already 4 shifts for the day.');
    if (SH.overlaps(same, b)) return fail(res, 409, 'This shift overlaps another shift for the same person that day.');
    const d = await M.Shift.create({ tenantId: tid, staffId: st._id, day, start: b.start, end: b.end, note: typeof b.note === 'string' ? b.note.trim().slice(0, 80) : undefined });
    await audit(tid, req, 'shift_add', d._id); res.status(201).json({ success: true, data: { id: String(d._id), hours: SH.hours(c.minutes) } });
  }));
  router.delete('/shifts/:id', wrap(async (req, res, tid) => {
    const id = toOid(req.params.id); const d = id ? await M.Shift.findOne({ _id: id, tenantId: tid }) : null; if (!d) return fail(res, 404, 'Not found');
    await M.Shift.deleteOne({ _id: id, tenantId: tid }); await audit(tid, req, 'shift_remove', id); res.json({ success: true });
  }));
  return { slipsFor };
}
module.exports = { mountMore };
