'use strict';
// Owner only. GET /summary (numbers only) and GET /list.csv (the daily file for the Afra AI OS Lead Hub import).
// The CSV holds owner phones, so it is never cached or logged, and every download is audited.
const { build, toCsv, summary } = require('./salesList');
function createSalesRouter({ express, protect, authorize, getAccounts, audit = () => {}, now = () => new Date() }) {
  const router = express.Router();
  router.use(protect, authorize('root_admin'));
  const run = async () => { const { accounts, failed } = await getAccounts(); return { ...build(accounts, { now: now() }), failed }; };
  router.get('/summary', async (req, res) => {
    try { const r = await run(); res.set('Cache-Control', 'no-store'); res.json({ success: true, data: { ...summary(r), productsUnavailable: r.failed } }); }
    catch (e) { console.error('sales summary failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  router.get('/list.csv', async (req, res) => {
    try {
      const r = await run(); audit({ who: (req.user && (req.user.id || req.user.email)) || 'unknown', action: 'sales.csv_download', rows: r.rows.length });
      res.set({ 'Cache-Control': 'no-store', 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="afra-products-leads-${now().toISOString().slice(0, 10)}.csv"` });
      res.send(toCsv(r.rows));
    } catch (e) { console.error('sales csv failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createSalesRouter };
