'use strict';
// Cloth routes, part 2: accounts, staff, sales reports, predictions, leak checks, marketing suggestions, CA export.
// All reads and writes filter by tenantId. Predictions are labelled estimates. Marketing is suggest-only: nothing is sent from here.
const Ac = require('./accounts'); const Pr = require('./predict'); const Lk = require('./leaks'); const St = require('./staffRules'); const A = require('./alterations');
const SA = require('./stockAdvice');

module.exports = ({ router, M, wrap, fail, str, todayIST, addDays, settingsOf, gather, customerRows, billsBetween, now }) => {
  const monthOf = (d) => d.slice(0, 7);
  const range = (req, today) => { const from = str(req.query.from, 10) || addDays(today, -29), to = str(req.query.to, 10) || today; return Ac.isDate(from) && Ac.isDate(to) && to >= from && (Date.parse(to) - Date.parse(from)) / 86400000 <= 400 ? { from, to } : null; };

  // ---- expenses ----
  router.get('/expenses', wrap(async (req, res, tid) => { const r = range(req, todayIST(now())); if (!r) return fail(res, 400, 'Give a valid from and to date.'); const rows = await M.Expense.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).sort({ date: -1 }).limit(500).lean(); res.json({ success: true, data: { rows, byCategory: Ac.byCategory(rows), currency: 'INR' } }); }));
  router.post('/expenses', wrap(async (req, res, tid) => { const v = Ac.validateExpense(req.body); if (v.error) return fail(res, 400, v.error); res.status(201).json({ success: true, data: await M.Expense.create({ tenantId: tid, ...v.value }) }); }, { write: true }));

  // ---- cash day close ----
  router.post('/day-close', wrap(async (req, res, tid) => {
    const date = str(req.body.date, 10) || todayIST(now()); if (!Ac.isDate(date)) return fail(res, 400, 'Bad date.');
    const r = Ac.dayClose({ opening: req.body.opening, cashIn: req.body.cashIn, cashOut: req.body.cashOut, counted: req.body.counted }); if (r.error) return fail(res, 400, r.error);
    const d = await M.DayClose.findOneAndUpdate({ tenantId: tid, date }, { $set: { opening: req.body.opening, cashIn: req.body.cashIn, cashOut: req.body.cashOut, expected: r.expected, counted: r.counted, difference: r.difference, status: r.status } }, { upsert: true, returnDocument: 'after' });
    res.status(201).json({ success: true, data: d, text: r.text });
  }, { write: true }));
  router.get('/day-close', wrap(async (req, res, tid) => res.json({ success: true, data: await M.DayClose.find({ tenantId: tid }).sort({ date: -1 }).limit(60).lean() })));

  // ---- supplier bills and dues ----
  router.post('/supplier-bills', wrap(async (req, res, tid) => {
    const b = req.body || {}; const supplier = str(b.supplier); if (supplier.length < 2) return fail(res, 400, 'Enter the supplier name.');
    if (!Number.isInteger(b.amount) || b.amount < 1) return fail(res, 400, 'Amount must be a whole rupee amount.'); if (!Ac.isDate(b.dueOn)) return fail(res, 400, 'Pick the due date.');
    res.status(201).json({ success: true, data: await M.SupplierBill.create({ tenantId: tid, supplier, amount: b.amount, paid: 0, dueOn: b.dueOn, billNo: str(b.billNo, 40) || undefined }) });
  }, { write: true }));
  router.post('/supplier-bills/:id/pay', wrap(async (req, res, tid) => {
    const b = await M.SupplierBill.findOne({ _id: req.params.id, tenantId: tid }); if (!b) return fail(res, 404, 'Bill not found');
    const amt = req.body.amount; if (!Number.isInteger(amt) || amt < 1 || b.paid + amt > b.amount) return fail(res, 400, 'Payment must be a whole rupee amount and not more than what is owed.');
    const u = await M.SupplierBill.findOneAndUpdate({ _id: b._id, tenantId: tid, paid: b.paid }, { $set: { paid: b.paid + amt } }, { returnDocument: 'after' }); if (!u) return fail(res, 409, 'The bill changed. Reload and try again.');
    res.json({ success: true, data: u });
  }, { write: true }));
  router.get('/supplier-dues', wrap(async (req, res, tid) => res.json({ success: true, data: Ac.supplierDues(await M.SupplierBill.find({ tenantId: tid }).lean(), todayIST(now())) })));

  // ---- profit and loss, GST summary, CA export ----
  const period = async (tid, r) => {
    const bills = await billsBetween(tid, r.from, r.to); const good = bills.filter((b) => b.status !== 'returned');
    const lines = good.flatMap((b) => (b.lines || []).map((l) => ({ taxable: l.taxable, gstRate: l.rate })));
    const exp = await M.Expense.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).lean();
    const moves = await M.StockMove.find({ tenantId: tid, type: 'sale', date: { $gte: r.from, $lte: r.to } }).lean();
    const vs = await M.Variant.find({ tenantId: tid }).lean(); const cost = Object.fromEntries(vs.map((v) => [String(v._id), v.cost || 0]));
    const cogs = moves.reduce((a, m) => a + m.qty * (cost[String(m.variantId)] || 0), 0);
    const sales = good.reduce((a, b) => a + (b.taxable != null ? b.taxable : b.total), 0);
    return { bills: good, lines, exp, cogs, sales };
  };
  router.get('/reports/profit-loss', wrap(async (req, res, tid) => { const r = range(req, todayIST(now())); if (!r) return fail(res, 400, 'Give a valid from and to date.'); const p = await period(tid, r); res.json({ success: true, data: { ...Ac.profitAndLoss({ sales: p.sales, cogs: p.cogs, expenses: p.exp }), from: r.from, to: r.to, byCategory: Ac.byCategory(p.exp) } }); }));
  router.get('/reports/gst-summary', wrap(async (req, res, tid) => { const r = range(req, todayIST(now())); if (!r) return fail(res, 400, 'Give a valid from and to date.'); res.json({ success: true, data: { ...Ac.gstSummary((await period(tid, r)).lines), from: r.from, to: r.to } }); }));
  router.get('/export/ca.csv', wrap(async (req, res, tid) => {
    const r = range(req, todayIST(now())); if (!r) return fail(res, 400, 'Give a valid from and to date.'); const p = await period(tid, r);
    const rows = [...p.bills.map((b) => ({ date: b.date, type: 'sale', ref: b.number, amount: b.total, gst: b.gst || 0, note: '' })), ...p.exp.map((e) => ({ date: e.date, type: 'expense', ref: e.category, amount: e.amount, gst: 0, note: e.note || '' }))].sort((a, b) => (a.date < b.date ? -1 : 1));
    res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', 'attachment; filename="cloth-ca-export.csv"'); res.send(Ac.toCsv(['date', 'type', 'ref', 'amount', 'gst', 'note'], rows));
  }));

  // ---- sales report by day / week / month ----
  router.get('/reports/sales', wrap(async (req, res, tid) => {
    const r = range(req, todayIST(now())); if (!r) return fail(res, 400, 'Give a valid from and to date.'); const by = ['day', 'week', 'month'].includes(req.query.by) ? req.query.by : 'day';
    const key = (d) => (by === 'month' ? d.slice(0, 7) : by === 'week' ? addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7)) : d);
    const out = {}; for (const b of (await billsBetween(tid, r.from, r.to)).filter((x) => x.status !== 'returned')) { const k = key(b.date); const o = out[k] = out[k] || { period: k, bills: 0, total: 0 }; o.bills++; o.total += b.total; }
    res.json({ success: true, data: { by, currency: 'INR', rows: Object.values(out).sort((a, b) => (a.period < b.period ? -1 : 1)) } });
  }));

  // ---- staff and attendance ----
  router.get('/staff', wrap(async (req, res, tid) => res.json({ success: true, data: await M.Staff.find({ tenantId: tid, isActive: true }).sort({ name: 1 }).lean() })));
  router.post('/staff', wrap(async (req, res, tid) => { const name = str(req.body.name); if (name.length < 2) return fail(res, 400, 'Enter the name.'); const salary = req.body.salary == null ? 0 : req.body.salary; if (!Number.isInteger(salary) || salary < 0) return fail(res, 400, 'Salary must be whole rupees.'); res.status(201).json({ success: true, data: await M.Staff.create({ tenantId: tid, name, phone: str(req.body.phone, 15) || undefined, salary }) }); }, { write: true }));
  router.post('/staff/:id/attendance', wrap(async (req, res, tid) => {
    const s = await M.Staff.findOne({ _id: req.params.id, tenantId: tid, isActive: true }); if (!s) return fail(res, 404, 'Staff member not found');
    const date = str(req.body.date, 10) || todayIST(now()); if (!St.isDate(date) || !St.STATUS.includes(req.body.status)) return fail(res, 400, 'Give a date and present, half, absent or leave.');
    res.json({ success: true, data: await M.Attendance.findOneAndUpdate({ tenantId: tid, staffId: s._id, date }, { $set: { status: req.body.status } }, { upsert: true, returnDocument: 'after' }) });
  }, { write: true }));
  router.get('/staff/:id/pay', wrap(async (req, res, tid) => {
    const s = await M.Staff.findOne({ _id: req.params.id, tenantId: tid, isActive: true }); if (!s) return fail(res, 404, 'Staff member not found');
    const month = str(req.query.month, 7) || monthOf(todayIST(now())); if (!/^\d{4}-\d{2}$/.test(month)) return fail(res, 400, 'Month must look like 2026-11.');
    const days = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate();
    const marks = await M.Attendance.find({ tenantId: tid, staffId: s._id, date: { $gte: month + '-01', $lte: month + '-31' } }).lean();
    res.json({ success: true, data: { name: s.name, month, ...St.monthPay({ salary: s.salary, marks, daysInMonth: days }) } });
  }));

  // ---- predictions (estimates) ----
  router.get('/predictions', wrap(async (req, res, tid) => {
    const today = todayIST(now()); const bills = (await billsBetween(tid, addDays(today, -190), today)).filter((b) => b.status !== 'returned');
    const monthly = {}, daily = {}, visits = {};
    for (const b of bills) { monthly[monthOf(b.date)] = (monthly[monthOf(b.date)] || 0) + b.total; daily[b.date] = (daily[b.date] || 0) + b.total; if (b.customerId) (visits[b.customerId] = visits[b.customerId] || []).push(b.date); }
    const full = Object.keys(monthly).sort().filter((m) => m < monthOf(today)).map((m) => ({ month: m, total: monthly[m] }));
    const g = await gather(tid, today); const moves = await M.StockMove.find({ tenantId: tid, type: 'sale', date: { $gte: addDays(today, -30), $lte: today } }).lean();
    const sold = {}; for (const m of moves) sold[String(m.variantId)] = (sold[String(m.variantId)] || 0) + m.qty;
    const runOut = Pr.runOut(g.vs.map((v) => ({ key: v.style + ' ' + v.size + ' ' + v.colour, id: String(v._id), qty: v.qty })).map((v) => ({ ...v })), Object.fromEntries(g.vs.map((v) => [v.style + ' ' + v.size + ' ' + v.colour, sold[String(v._id)] || 0])));
    const infos = await customerRows(tid); const info = Object.fromEntries(infos.map((i) => [i.id, i]));
    const lapse = Pr.lapseRisk(Object.entries(visits).map(([id, v]) => ({ id, name: (info[id] || {}).name || 'Customer', visits: v, doNotContact: (info[id] || {}).doNotContact })), today);
    const dues = (await M.SupplierBill.find({ tenantId: tid }).lean()).map((b) => ({ owe: b.amount - b.paid, dueIn: Math.round((Date.parse(b.dueOn) - Date.parse(today)) / 86400000) })).filter((b) => b.owe > 0);
    const staff = await M.Staff.find({ tenantId: tid, isActive: true }).lean();
    res.json({ success: true, data: { note: 'These are estimates from your own past numbers, not promises.', nextMonth: Pr.nextMonthRange(full), weekdays: Pr.weekdayPattern(Object.entries(daily).map(([date, total]) => ({ date, total }))), runOut, lapseRisk: lapse, cashNeeded: Pr.cashNeeded(dues, staff.reduce((a, s) => a + s.salary, 0)) } });
  }));

  // ---- leak checks ----
  router.get('/reports/leaks', wrap(async (req, res, tid) => {
    const today = todayIST(now()); const bills = await billsBetween(tid, addDays(today, -30), today);
    res.json({ success: true, data: { note: 'Things that look unusual. They are hints, not proof.', heavyDiscounts: Lk.heavyDiscounts(bills), voidsByStaff: Lk.voidsByStaff(bills), cashDifferences: Lk.cashDifferences(await M.DayClose.find({ tenantId: tid, date: { $gte: addDays(today, -30) } }).lean()) } });
  }));

  // ---- marketing suggestions (suggest only; sending needs the owner's switch and an approved template) ----
  router.get('/marketing-ideas', wrap(async (req, res, tid) => {
    const today = todayIST(now()); const g = await gather(tid, today); const f = require('./followups').lists(await customerRows(tid), today); const out = [];
    if (f.lapsed.length) out.push({ key: 'winback', text: `Message ${f.lapsed.length} customers who have not visited in 90+ days`, reason: `Longest away: ${f.lapsed[0].daysAway} days.`, audience: f.lapsed.map((c) => c.id), template: 'cloth_winback (needs Meta approval)' });
    if (f.occasions.length) out.push({ key: 'occasion', text: `Send a wish and a small offer to ${f.occasions.length} customer(s) with an occasion this week`, reason: 'Dates you saved on their record.', audience: f.occasions.map((c) => c.id), template: 'cloth_occasion (needs Meta approval)' });
    if (g.slow.length) out.push({ key: 'clearance', text: `Run a clearance offer on ${g.slow.length} slow style(s)`, reason: `Rs ${g.slow.reduce((a, s) => a + s.tiedUp, 0)} of stock at cost has not sold for 60+ days.`, audience: [], template: 'cloth_offer (needs Meta approval)' });
    out.push({ key: 'review', text: 'Ask happy customers for a Google review after a bill', reason: 'Reviews bring new customers; share your shop page or QR.', audience: [], template: 'cloth_review (needs Meta approval)' });
    res.json({ success: true, data: { mode: 'suggest', ideas: out } });
  }));
};
