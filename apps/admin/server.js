'use strict';
// Super Admin server (SA-11). FAILS CLOSED: until a real sign-in with two-step verification is plugged into
// `auth` (task SA-11b), every route answers 503. This file never invents a weak login.
const express = require('express');
const { createAdminRouter, collectAll, readConfig } = require('./src');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

let auth = null;
try { auth = require('./src/auth'); } catch (e) { auth = null; } // written in SA-11b
const closed = (req, res) => res.status(503).json({ success: false, message: 'Sign-in is not set up yet.' });

if (auth && typeof auth.protect === 'function' && typeof auth.authorize === 'function') {
  auth.mount(app);
  app.use('/api/admin', createAdminRouter({ express, protect: auth.protect, authorize: auth.authorize, collectAll, readConfig }));
} else {
  app.use('/api', closed);
}
app.get('/api/health', (req, res) => res.json({ ok: true, signIn: !!(auth && auth.protect) }));

const port = Number(process.env.PORT || 5010);
if (require.main === module) app.listen(port, '127.0.0.1', () => console.log(`Super Admin on 127.0.0.1:${port}`));
module.exports = app;
