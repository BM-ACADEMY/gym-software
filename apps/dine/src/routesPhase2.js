'use strict';
// Dine Phase 2 routes, added to the same router as routes.js so they share the session, the read-only guard, the role check
// and the tenant context. Every route names its permission (staff.js); a role without it gets 403 before any database work.
// Every query carries tenantId. Written, not yet tested by a person.
const crypto = require('crypto');
const P = require('./publicPages');
const PR = require('./print');
const IM = require('./importers');
const PV = require('./privacy');

function addPhase2Routes(ctx) {
  const { def, M, D, fail, log, str, plain, settingsOf, now, OID, DATE, loadOrder } = ctx;
  const setVenue = async (tid, patch) => { const t = await M.Tenant.findById(tid); const cur = (t && t.settings && t.settings.venue) || {}; await M.Tenant.updateOne({ _id: tid }, { $set: { 'settings.venue': { ...cur, ...patch } } }); return { ...cur, ...patch }; };
  const getVenue = async (tid) => { const t = await M.Tenant.findById(tid); return { name: t && t.venueName, ...(((t && t.settings && t.settings.venue) || {})) }; };

  // ---- 1. venue details, QR menu link, direct-order link ----
  def('get', '/settings/venue', 'orders', async (req, res, tid) => { const v = await getVenue(tid); const { menuToken, ...rest } = v; res.json({ success: true, data: { ...rest, menuLink: menuToken ? '/dine-public/menu/' + menuToken : null } }); });
  def('put', '/settings/venue', 'staff', async (req, res, tid) => {
    const b = req.body || {}; const patch = {};
    if (b.address !== undefined) patch.address = str(b.address, 200);
    if (b.phone !== undefined) { const p = String(b.phone || '').replace(/\D/g, ''); if (p && !/^[6-9]\d{9}$/.test(p)) return fail(res, 400, 'Phone must be a 10-digit mobile number.'); patch.phone = p; }
    if (b.waNumber !== undefined) { const p = String(b.waNumber || '').replace(/\D/g, ''); if (p && !/^[6-9]\d{9}$/.test(p)) return fail(res, 400, 'WhatsApp number must be a 10-digit mobile number.'); patch.waNumber = p; }
    if (b.fssai !== undefined) { const f = String(b.fssai || '').replace(/\s/g, ''); if (f && !/^\d{14}$/.test(f)) return fail(res, 400, 'An FSSAI licence number has 14 digits.'); patch.fssai = f; }
    if (b.creditLimit !== undefined) { if (!Number.isInteger(b.creditLimit) || b.creditLimit < 0 || b.creditLimit > 100000) return fail(res, 400, 'Credit limit must be a whole rupee amount from 0 to 100000.'); patch.creditLimit = b.creditLimit; }
    if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to change.');
    await setVenue(tid, patch); await log(tid, req, 'settings.venue'); res.json({ success: true });
  });
  def('post', '/settings/menu-link/rotate', 'staff', async (req, res, tid) => {
    const token = crypto.randomBytes(24).toString('hex'); await setVenue(tid, { menuToken: token }); await log(tid, req, 'menu.link.rotate');
    res.json({ success: true, data: { menuLink: '/dine-public/menu/' + token, note: 'Old QR codes stop working. Print the new one.' } });
  });
  // ---- 2. printable bill and KOT (browser prints them; Tamil and Hindi letters print correctly) ----
  const page = (res, html) => { res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); return res.status(200).send(html); };
  def('get', '/orders/:id/print/bill', 'bill', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    if (o.status !== 'billed' && o.status !== 'paid') return fail(res, 400, 'Bill the order first.');
    const v = await getVenue(tid); const size = req.query.size === 'A4' ? 'A4' : 'A5';
    page(res, PR.billPrintHtml(o, v, { size, cashier: undefined }));
  });
  def('get', '/orders/:id/print/kot', 'orders', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    const station = req.query.station === 'bar' ? 'bar' : 'kitchen'; const v = await getVenue(tid);
    page(res, PR.kotPrintHtml(o, station, v, PR.istText(now())));
  });
  // ---- 3. pay-later (credit) ledger and returns ----
  def('get', '/credit/dues', 'credit', async (req, res, tid) => {
    const rows = (await M.Credit.find({ tenantId: tid, settled: false }).limit(2000)).map(plain);
    res.json({ success: true, data: D.credit.dues(rows, D.istParts(now()).date) });
  });
  def('post', '/credit/payments', 'credit', async (req, res, tid) => {
    const b = req.body || {}; const phone = str(b.phone, 15); const amount = Number(b.amount); const method = ['cash', 'upi', 'card'].includes(b.method) ? b.method : null;
    if (!/^\d{10}$/.test(phone)) return fail(res, 400, 'Give the customer\'s 10-digit mobile number.');
    if (!method) return fail(res, 400, 'Choose cash, UPI or card.');
    const open = (await M.Credit.find({ tenantId: tid, phone, settled: false }).limit(500)).map(plain);
    const parts = D.credit.allocate(open, amount); const date = D.istParts(now()).date;
    for (const p of parts) {
      const row = open.find((c) => c.id === p.id); const done = D.credit.owing(row) - p.apply <= 0;
      await M.Credit.updateOne({ _id: p.id, tenantId: tid }, { $inc: { paid: p.apply }, ...(done ? { $set: { settled: true } } : {}), $push: { entries: { at: now().toISOString(), amount: p.apply, method, by: req.user.id } } });
    }
    if (method === 'cash') await M.CashEntry.create({ tenantId: tid, date, type: 'in', amount, category: 'credit_recovery', note: 'Pay-later received ' + phone.slice(0, 2) + '******' + phone.slice(-2), by: req.user.id, currency: 'INR' });
    await log(tid, req, 'credit.payment', 'Rs ' + amount); res.json({ success: true, data: { applied: parts.length, amount } });
  });
  // Return some lines of a PAID order. Needs a reason; the refund is worked out by core-pos returns.plan (cumulative rounding, so partial returns add up).
  // Service charge is not refunded by this route (owner handles it by hand); recipe stock is NOT put back (food is not re-stocked).
  def('post', '/orders/:id/returns', 'returns', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    if (o.status !== 'paid') return fail(res, 400, 'Only a paid order can have a return.');
    const reason = str(req.body && req.body.reason, 200); if (reason.length < 3) return fail(res, 400, 'Write a reason for the return.');
    const tl = (o.totals && o.totals.lines) || [];
    const pos = require('../../../packages/core-pos/src/returns');
    const b = { lines: tl.map((l) => ({ name: l.name, qty: l.qty, total: l.total, itemId: l.itemKey || null })), total: o.totals ? o.totals.total : 0, credit: o.credit || 0, payments: o.payments || [], pointsEarned: o.pointsEarned || 0, pointsUsed: o.pointsUsed || 0 };
    let plan; try { plan = pos.plan({ bill: b, items: req.body && req.body.items, returnedQty: o.returnedQty || [] }); } catch (e) { return fail(res, 400, e.message); }
    const entry = { at: now().toISOString(), by: req.user.id, reason, lines: plan.lines.map((l) => ({ name: l.name, qty: l.qty, refund: l.refund })), refund: plan.refund, cashBack: plan.cashBack, creditReduction: plan.creditReduction, loyaltyBack: plan.loyaltyBack };
    const r = await M.Order.findOneAndUpdate({ _id: o.id, tenantId: tid, status: 'paid', returnedAmount: o.returnedAmount || 0 }, { $set: { returnedQty: plan.nextReturnedQty, returnedAmount: plan.returnedAmount }, $push: { returns: entry, events: { at: entry.at, by: req.user.id, what: 'return' } } }, { new: true });
    if (!r) return fail(res, 409, 'Someone else just changed this order. Reload and try again.');
    if (plan.creditReduction > 0) await M.Credit.updateOne({ tenantId: tid, orderId: o.id }, { $inc: { amount: -plan.creditReduction } });
    if (plan.points !== 0 && o.customerPhone) await M.Loyalty.create({ tenantId: tid, phone: o.customerPhone, points: plan.points, reason: 'return', orderNumber: o.number, date: D.istParts(now()).date });
    if (plan.cashBack > 0 && (o.payments || []).some((p) => p.method === 'cash')) await M.CashEntry.create({ tenantId: tid, date: D.istParts(now()).date, type: 'out', amount: plan.cashBack, category: 'refund', note: 'Return on ' + o.number, by: req.user.id, currency: 'INR' });
    await log(tid, req, 'order.return', o.number + ' Rs ' + plan.refund); res.json({ success: true, data: { refund: plan.refund, cashBack: plan.cashBack, creditReduction: plan.creditReduction, returnedAmount: plan.returnedAmount, fullyReturned: plan.fullyReturned } });
  });
  // ---- 4. CSV import: ingredients, recipes, guests. Preview saves nothing; commit re-reads the same file on the server. ----
  const csvOf = (req) => { const c = req.body && req.body.csv; if (typeof c !== 'string' || !c.trim()) { const e = new Error('Send the file text as "csv".'); e.code = 'IMPORT_INVALID'; throw e; } if (c.length > 150000) { const e = new Error('The file is too big. Send fewer rows at a time.'); e.code = 'IMPORT_INVALID'; throw e; } return c; };
  const sum = (r, extra) => ({ good: r.ok.length, problems: r.errors.length, errors: r.errors.slice(0, 50), sample: r.ok.slice(0, 5), ...(extra || {}) });
  const loadIng = async (tid) => (await M.Ingredient.find({ tenantId: tid }).limit(2000)).map((i) => ({ id: String(i._id), name: i.name }));
  const loadDishes = async (tid) => (await M.MenuItem.find({ tenantId: tid, isActive: true }).limit(1000)).map((m) => ({ key: m.key, name: m.name }));
  def('post', '/import/ingredients/preview', 'stock', async (req, res, tid) => { const r = IM.parseIngredients(csvOf(req)); const have = new Set((await loadIng(tid)).map((i) => i.name.toLowerCase())); res.json({ success: true, data: sum(r, { alreadyThere: r.ok.filter((x) => have.has(x.name.toLowerCase())).length }) }); });
  def('post', '/import/ingredients/commit', 'stock', async (req, res, tid) => {
    const r = IM.parseIngredients(csvOf(req)); const have = new Set((await loadIng(tid)).map((i) => i.name.toLowerCase())); let added = 0; let skipped = 0;
    for (const x of r.ok) { if (have.has(x.name.toLowerCase())) { skipped += 1; continue; } await M.Ingredient.create({ tenantId: tid, name: x.name, unit: x.unit, costPerUnit: x.costPerUnit, qty: x.qty, reorderLevel: x.reorderLevel }); added += 1; }
    await log(tid, req, 'import.ingredients', added + ' added'); res.json({ success: true, data: { added, skippedExisting: skipped, problems: r.errors.length, errors: r.errors.slice(0, 50) } });
  });
  def('post', '/import/recipes/preview', 'stock', async (req, res, tid) => { const r = IM.parseRecipes(csvOf(req), await loadDishes(tid), await loadIng(tid)); res.json({ success: true, data: sum({ ok: r.ok, errors: r.errors }, { dishes: r.ok.length }) }); });
  def('post', '/import/recipes/commit', 'stock', async (req, res, tid) => {
    const r = IM.parseRecipes(csvOf(req), await loadDishes(tid), await loadIng(tid));
    for (const x of r.ok) await M.Recipe.findOneAndUpdate({ tenantId: tid, dishKey: x.dishKey }, { $set: { portion: x.portion, parts: x.parts } }, { upsert: true });
    await log(tid, req, 'import.recipes', r.ok.length + ' dishes'); res.json({ success: true, data: { saved: r.ok.length, problems: r.errors.length, errors: r.errors.slice(0, 50) } });
  });
  def('post', '/import/guests/preview', 'customers', async (req, res, tid) => { const r = IM.parseGuests(csvOf(req)); res.json({ success: true, data: sum(r, { ignoredCredit: r.ignoredCredit, note: r.ignoredCredit ? 'Opening credit in the file is not imported. Pay-later comes only from real bills.' : undefined }) }); });
  def('post', '/import/guests/commit', 'customers', async (req, res, tid) => {
    const r = IM.parseGuests(csvOf(req)); let added = 0; let existing = 0; let points = 0; const date = D.istParts(now()).date;
    for (const g of r.ok) {
      if (g.phone) {
        const had = await M.Customer.findOne({ tenantId: tid, phone: g.phone });
        if (had) { existing += 1; continue; }
        await M.Customer.create({ tenantId: tid, name: g.name, phone: g.phone, visits: [] }); added += 1;
        if (g.points > 0) { await M.Loyalty.create({ tenantId: tid, phone: g.phone, points: g.points, reason: 'opening', date }); points += g.points; }
      } else { await M.Customer.create({ tenantId: tid, name: g.name, visits: [] }); added += 1; }
    }
    await log(tid, req, 'import.guests', added + ' added'); res.json({ success: true, data: { added, alreadyThere: existing, openingPoints: points, problems: r.errors.length, errors: r.errors.slice(0, 50) } });
  });
  // ---- 5. data export and delete on request (owner only), and the audit trail ----
  const ownerOnly = (req, res) => { if (req.user.staffRole !== 'owner') { fail(res, 403, 'Only the owner can do this.'); return false; } return true; };
  def('get', '/privacy/guests/:id/export', 'customers', async (req, res, tid) => {
    if (!ownerOnly(req, res)) return;
    const c = OID.test(String(req.params.id)) ? await M.Customer.findOne({ _id: req.params.id, tenantId: tid }) : null; if (!c) return fail(res, 404, 'Guest not found');
    const cp = plain(c); const phone = cp.phone;
    const [orders, loyalty, credits] = await Promise.all([M.Order.find({ tenantId: tid, customerPhone: phone }).limit(2000), M.Loyalty.find({ tenantId: tid, phone }).limit(2000), M.Credit.find({ tenantId: tid, phone }).limit(2000)]);
    await log(tid, req, 'privacy.export', cp.id);
    res.set('Cache-Control', 'no-store'); res.set('Content-Disposition', 'attachment; filename="guest-data.json"');
    res.json({ success: true, data: PV.guestExport({ customer: cp, orders: orders.map(plain), loyalty: loyalty.map(plain), credits: credits.map(plain) }) });
  });
  def('post', '/privacy/guests/:id/delete', 'customers', async (req, res, tid) => {
    if (!ownerOnly(req, res)) return;
    if (!PV.confirmed(req.body)) return fail(res, 400, 'To delete, send confirm: "' + PV.CONFIRM_WORD + '". This cannot be undone.');
    const c = OID.test(String(req.params.id)) ? await M.Customer.findOne({ _id: req.params.id, tenantId: tid }) : null; if (!c) return fail(res, 404, 'Guest not found');
    const cp = plain(c); if (cp.anonymised) return fail(res, 409, 'This guest was already deleted.');
    const credits = (await M.Credit.find({ tenantId: tid, phone: cp.phone }).limit(2000)).map(plain);
    if (PV.owed(credits) > 0) return fail(res, 409, 'This guest still owes Rs ' + PV.owed(credits) + '. Settle the pay-later first.');
    const t = PV.tag(cp.id);
    await M.Order.updateMany({ tenantId: tid, customerPhone: cp.phone }, { $set: { customerPhone: t } });
    await M.Loyalty.updateMany({ tenantId: tid, phone: cp.phone }, { $set: { phone: t } });
    await M.Credit.updateMany({ tenantId: tid, phone: cp.phone }, { $set: { phone: t, name: 'Deleted guest' } });
    await M.Customer.updateOne({ _id: cp.id, tenantId: tid }, { $set: PV.anonymisePatch(cp.id, now()) });
    await log(tid, req, 'privacy.delete', cp.id); res.json({ success: true, message: 'The guest details were removed. Bills stay for your accounts, without the name or phone.' });
  });
  def('get', '/privacy/export.json', 'customers', async (req, res, tid) => {
    if (!ownerOnly(req, res)) return;
    const [tenant, menu, ingredients, recipes, customers, orders, cash] = await Promise.all([M.Tenant.findById(tid), M.MenuItem.find({ tenantId: tid }).limit(1000), M.Ingredient.find({ tenantId: tid }).limit(2000), M.Recipe.find({ tenantId: tid }).limit(1000), M.Customer.find({ tenantId: tid }).limit(20000), M.Order.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(20000), M.CashEntry.find({ tenantId: tid }).limit(20000)]);
    await log(tid, req, 'privacy.export.business', String(tid));
    const f = (rows) => rows.map(plain).map(PV.stripId);
    res.set('Cache-Control', 'no-store'); res.set('Content-Disposition', 'attachment; filename="business-data.json"');
    res.json({ success: true, data: { schema: 1, currency: 'INR', venue: { name: tenant && tenant.venueName }, menu: f(menu), ingredients: f(ingredients), recipes: f(recipes), guests: f(customers), orders: f(orders), cash: f(cash) } });
  });
  // Audit trail: who did what and when. Owner only. Never holds names, phone numbers or message text (the log is written without them).
  def('get', '/audit', 'customers', async (req, res, tid) => {
    if (!ownerOnly(req, res)) return;
    const prefix = typeof req.query.action === 'string' ? req.query.action.replace(/[^a-z._-]/gi, '').slice(0, 30) : '';
    const q = { tenantId: tid, ...(prefix ? { action: { $regex: '^' + prefix.replace(/\./g, '\\.') } } : {}) };
    const rows = (await M.Activity.find(q).sort({ createdAt: -1 }).limit(200)).map(plain);
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: rows.map((r) => ({ at: r.createdAt, by: r.by, action: r.action, ref: r.ref || '' })) });
  });
  // Link only: nothing is sent. The guest taps Send in their own WhatsApp.
  def('get', '/order-link', 'orders', async (req, res, tid) => {
    const v = await getVenue(tid); const link = P.waOrderLink(v.waNumber, [], { name: v.name });
    if (!link) return fail(res, 400, 'Add the venue WhatsApp number in settings first.'); res.json({ success: true, data: { link } });
  });
}
module.exports = { addPhase2Routes };
