// The Express app itself, with no side effects (no DB connect, no listen, no
// background schedulers) — importable by both server.js and the test suite
// (supertest wraps this directly, never a running network port).
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const rootAdminRoutes = require('./routes/rootAdmin');
const adminRoutes = require('./routes/admin');
const subAdminRoutes = require('./routes/subadmin');
const memberRoutes = require('./routes/member');
const webhookRoutes = require('./routes/webhooks');
const { securityHeaders, corsOptions, rejectOperatorKeys, rateLimit } = require('./middleware/security');

const app = express();

// Behind Render/Railway/Nginx the real client IP is in X-Forwarded-For —
// needed for the rate limiter to count per client, not per proxy.
app.set('trust proxy', 1);

app.use(securityHeaders);
// Origins are restricted by CORS_ORIGINS in production; exposedHeaders is
// required for the browser's JS to read X-Gym-Suspended.
app.use(cors(corsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(rejectOperatorKeys);

// A broad per-IP ceiling on the whole API; auth routes add tighter limits.
app.use('/api', rateLimit({ name: 'api', windowMs: 60 * 1000, max: 300 }));

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/root-admin', rootAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subadmin', subAdminRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/payments', webhookRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong!' });
});

module.exports = app;
