'use strict';
// Salon final-list routes (mounted on /api/salon after routes.js and routesMore.js). Every query filters by tenantId.
// Printable bill, QR picture for the booking link, tomorrow's reminder suggestions (suggest only: nothing is sent).
// Written, not yet tested by a person.
const makeModels = require('./models');
const B = require('./booking');
const BP = require('./bookingPage');
const BPR = require('./billPrint');
const RM = require('./reminders');
const { qrSvg } = require('./qrSvg');
const { makeFail, makeWrap, isId } = require('./routes');

function createSalonFinalRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite, env = process.env, roles = ['admin', 'staff', 'doctor'] }) {
  const router = express.Router(); const M = makeModels(mongoose);
  router.use(protect, authorize(...roles));
  if (guardWrite) router.use((req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); });
  const fail = makeFail(); const wrap = makeWrap(fail, tenantOf);
  const adminOnly = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : fail(res, 403, 'Only the owner can do this.'));
  const today = () => B.istParts().date;
  const istText = () => { const p = B.istParts(); return `${p.date} ${String(Math.floor(p.minutes / 60)).padStart(2, '0')}:${String(p.minutes % 60).padStart(2, '0')}`; };

  // Print a bill. The owner can print any bill; staff only today's bills (phone masked). A voided bill is not printed as a bill.
  router.get('/bills/:id/print', wrap(async (req, res, tid) => {
    const bill = isId(req.params.id) ? await M.Bill.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; if (!bill) return fail(res, 404, 'Bill not found');
    if (bill.status === 'void') return fail(res, 409, 'This bill was voided and cannot be printed.');
    if (req.user.role !== 'admin' && bill.date !== today()) return fail(res, 403, 'Only the owner can print an older bill.');
    const [tenant, customer] = await Promise.all([M.Tenant.findOne({ _id: tid }).lean(), bill.customerId ? M.Customer.findOne({ _id: bill.customerId, tenantId: tid }).lean() : null]);
    if (!tenant) return fail(res, 404, 'Business not found');
    const html = BPR.render({ bill: { ...bill, returnedAmount: bill.refunded || 0 }, tenant, customer, role: req.user.role, size: req.query.size, at: istText() });
    res.set({ 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'", 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' });
    res.send(html);
  }));

  // The booking link as a QR picture for the counter poster (owner only). Same link as /settings/booking-qr.
  router.get('/settings/booking-qr.svg', adminOnly, wrap(async (req, res, tid) => {
    const t = await M.Tenant.findOne({ _id: tid }).lean(); if (!t || !t.bookingToken) return fail(res, 404, 'No booking link yet. Make one in Settings.');
    const url = BP.bookingUrl(env, t.bookingToken); if (!url) return fail(res, 409, 'The public web address is not set on the server yet (SALON_PUBLIC_URL).');
    res.set({ 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
    res.send(qrSvg(url, 8));
  }));

  // Tomorrow's visits with a drafted reminder each. Only customers who agreed to be contacted. Nothing is sent.
  router.get('/reminders/suggestions', wrap(async (req, res, tid) => {
    const date = B.addDays(today(), 1); const t = await M.Tenant.findOne({ _id: tid }).lean(); if (!t) return fail(res, 404, 'Business not found');
    const appts = await M.Appointment.find({ tenantId: tid, date, active: true, status: 'booked' }).limit(500).lean();
    const ids = [...new Set(appts.map((a) => String(a.customerId)))];
    const customers = ids.length ? await M.Customer.find({ tenantId: tid, _id: { $in: ids } }).limit(500).lean() : [];
    const out = RM.suggestions({ businessName: t.businessName, date, appointments: appts, customers });
    const owner = req.user.role === 'admin';
    out.list = out.list.map((r) => ({ ...r, phone: owner ? r.phone : B.maskPhone(r.phone), whatsappLink: owner ? RM.waLink(r.phone, r.message) : null }));
    res.json({ success: true, data: out });
  }));
  return router;
}
module.exports = { createSalonFinalRouter };
