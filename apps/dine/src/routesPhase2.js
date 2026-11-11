'use strict';
// Dine Phase 2 routes, added to the same router as routes.js so they share the session, the read-only guard, the role check
// and the tenant context. Every route names its permission (staff.js); a role without it gets 403 before any database work.
// Every query carries tenantId. Written, not yet tested by a person.
const crypto = require('crypto');
const P = require('./publicPages');
const PR = require('./print');

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
  // Link only: nothing is sent. The guest taps Send in their own WhatsApp.
  def('get', '/order-link', 'orders', async (req, res, tid) => {
    const v = await getVenue(tid); const link = P.waOrderLink(v.waNumber, [], { name: v.name });
    if (!link) return fail(res, 400, 'Add the venue WhatsApp number in settings first.'); res.json({ success: true, data: { link } });
  });
}
module.exports = { addPhase2Routes };
