'use strict';
// Super Admin server (SA-11). FAILS CLOSED: until a real sign-in with two-step verification is plugged into
// `auth` (task SA-11b), every route answers 503. This file never invents a weak login.
const express = require('express');
const { createAdminRouter, collectAll, readConfig, createMarketingRouter, makeMongoStore, combine, createSalesRouter, createAccountsRouter, collectAccounts } = require('./src');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

let auth = null;
try { auth = require('./src/auth'); } catch (e) { auth = null; } // written in SA-11b
const closed = (req, res) => res.status(503).json({ success: false, message: 'Sign-in is not set up yet.' });

if (auth && typeof auth.protect === 'function' && typeof auth.authorize === 'function') {
  auth.mount(app);
  // Marketing to-do (needs a database for the admin app's own data; stays closed without MONGODB_URI)
  if (process.env.MONGODB_URI) {
    const mongoose = require('mongoose');
    const getFacts = async () => combine(await collectAll(readConfig()));
    app.use('/api/admin/marketing', createMarketingRouter({ express, protect: auth.protect, authorize: auth.authorize, store: makeMongoStore(mongoose), getFacts, audit: (a) => console.log('audit', JSON.stringify(a)) }));
  }
  app.use('/api/admin/accounts', createAccountsRouter({ express, protect: auth.protect, authorize: auth.authorize, getAccounts: () => collectAccounts(readConfig()), audit: (a) => console.log('audit', JSON.stringify(a)) }));
  app.use('/api/admin/sales', createSalesRouter({ express, protect: auth.protect, authorize: auth.authorize, getAccounts: () => collectAccounts(readConfig()), audit: (a) => console.log('audit', JSON.stringify(a)) }));
  app.use('/api/admin', createAdminRouter({ express, protect: auth.protect, authorize: auth.authorize, collectAll, readConfig }));
} else {
  app.use('/api', closed);
}
app.get('/api/health', (req, res) => res.json({ ok: true, signIn: !!(auth && auth.protect) }));

const port = Number(process.env.PORT || 5010);
if (require.main === module) {
  const go = () => app.listen(port, '127.0.0.1', () => console.log(`Super Admin on 127.0.0.1:${port}`));
  if (process.env.MONGODB_URI) require('mongoose').connect(process.env.MONGODB_URI).then(go).catch((e) => { console.error('Database connection failed:', e.message); process.exit(1); });
  else go();
}
module.exports = app;
