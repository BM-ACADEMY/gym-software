'use strict';
const express = require('express');
const mongoose = require('mongoose');
const ai = require('../../server/services/aiProvider');
const { createApp, missingSettings } = require('./src/app');

const app = createApp({ express, mongoose, ai });
if (require.main === module) {
  const go = () => app.listen(Number(process.env.PORT || 5006), '127.0.0.1', () => console.log('Hire on 127.0.0.1:' + (process.env.PORT || 5006)));
  if (missingSettings(process.env).length) go();
  else mongoose.connect(process.env.MONGODB_URI).then(go).catch((e) => { console.error('Database connection failed:', e.message); process.exit(1); });
}
module.exports = app;
