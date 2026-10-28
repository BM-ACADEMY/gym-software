// Mount: app.use('/api/admin', createAdminRouter({ express, protect, authorize, collectAll, readConfig }))
// `protect` must be the admin app's own sign-in WITH two-step verification (task SA-11b, not built yet).
const { combine } = require('./aggregate');
function createAdminRouter({ express, protect, authorize, collectAll, readConfig, cacheMs = 60000 }) {
  const router = express.Router(); let cache = null;
  router.use(protect, authorize('root_admin'));
  router.get('/overview', async (req, res) => {
    try {
      if (!cache || Date.now() - cache.at > cacheMs) cache = { at: Date.now(), data: combine(await collectAll(readConfig())) };
      const only = String(req.query.product || '').toLowerCase();
      const data = only ? { ...cache.data, products: cache.data.products.filter((p) => p.product === only) } : cache.data;
      res.json({ success: true, data });
    } catch (e) { console.error('admin overview failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createAdminRouter };
