'use strict';
const express = require('express');
const mongoose = require('mongoose');
const { createApp, missingSettings } = require('./src/app');

const app = createApp({ express, mongoose });
if (require.main === module) {
  const go = () => app.listen(Number(process.env.PORT || 5008), '127.0.0.1', () => console.log('Mart on 127.0.0.1:' + (process.env.PORT || 5008)));
  if (missingSettings(process.env).length) go();
  else mongoose.connect(process.env.MONGODB_URI).then(go).catch((e) => { console.error('Database connection failed:', e.message); process.exit(1); });
}
module.exports = app;
