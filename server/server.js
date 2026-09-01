require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const rootAdminRoutes = require('./routes/rootAdmin');
const adminRoutes = require('./routes/admin');
const subAdminRoutes = require('./routes/subadmin');
const memberRoutes = require('./routes/member');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/root-admin', rootAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subadmin', subAdminRoutes);
app.use('/api/member', memberRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
