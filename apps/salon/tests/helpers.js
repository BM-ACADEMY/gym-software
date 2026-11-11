// Shared set-up for the Phase 2 tests: both routers on one in-memory stand-in database, two businesses (Alpha, Bravo).
const { fakeMongoose, fakeRouter } = require('./fake');
const { createSalonRouter, createPublicRouter, makeLimiter } = require('../src/routes');
const { createSalonMoreRouter } = require('../src/routesMore');
const makeModels = require('../src/models'); const B = require('../src/booking');
const ownerOf = (tid) => ({ user: { id: 'u' + tid, tenantId: tid, role: 'admin' } });
const staffOf = (tid, staffId) => ({ user: { id: 's' + tid, tenantId: tid, role: 'staff', staffId } });
const doctorOf = (tid, staffId) => ({ user: { id: 'd' + tid, tenantId: tid, role: 'doctor', staffId } });
const openDay = () => { let d = B.addDays(B.istParts().date, 2); while (B.weekday(d) === 0) d = B.addDays(d, 1); return d; };
async function setupMore(extra = {}) {
  const { mongoose } = fakeMongoose(); const ex = { Router: () => fakeRouter() };
  const common = { express: ex, mongoose, protect: (q, s, n) => n(), authorize: () => (q, s, n) => n(), tenantOf: (r) => r.user.tenantId };
  const router = createSalonRouter(common); const more = createSalonMoreRouter({ ...common, ...extra });
  const pub = createPublicRouter({ express: ex, mongoose, limiter: makeLimiter({ max: 50 }), ...(extra.pubExtra || {}) });
  const M = makeModels(mongoose);
  const mkTenant = async (name, patch = {}) => { const t = await M.Tenant.create({ businessName: name, bookingToken: (name.charCodeAt(0).toString(16).padStart(2, '0')).repeat(24), windows: [[600, 780], [1080, 1260]], closedWeekdays: [0], slotStep: 30, bufferMins: 0, bookingMode: 'instant', taxMode: 'none', ...patch }); const id = String(t._id); const st = await M.Staff.create({ tenantId: id, name: name + ' stylist', serviceKeys: [] }); await M.Service.create({ tenantId: id, key: 'haircut', name: 'Haircut', mins: 30, price: 500, gstRate: 0 }); return { id, staffId: String(st._id), token: t.bookingToken }; };
  return { router, more, pub, M, A: await mkTenant('Alpha'), Bt: await mkTenant('Bravo'), mkTenant };
}
module.exports = { setupMore, ownerOf, staffOf, doctorOf, openDay, B };
