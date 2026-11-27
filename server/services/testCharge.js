'use strict';
// RM-11: a one-time Rs 1 price for ONE gym, so the live Razorpay keys can be proven with a real payment
// without changing any plan price for other gyms or the public pricing page.
// Root Admin turns it on for one internal gym; it applies only to Solo monthly, ends after 30 minutes,
// and is used up by the first paid order. Stored in SystemSettings under KEY (one at a time).
const SystemSettings = require('../models/SystemSettings');
const { GST_RATE } = require('../config/plans');

const KEY = 'live_test_charge';
const AMOUNT = 1; // whole rupees
const PLAN = 'solo';
const CYCLE = 'monthly';
const MINUTES = 30;

// Pure: is this saved charge usable by this gym now?
const isActiveFor = (charge, subscriberId, now = new Date()) =>
  Boolean(charge && charge.subscriberId && String(charge.subscriberId) === String(subscriberId) && new Date(charge.expiresAt) > now);

// Pure: same shape as billingMath.quote. GST on Rs 1 rounds to Rs 0, so the total is Rs 1.
const quote = (gstMode) => {
  const taxable = AMOUNT;
  const gst = Math.round((taxable * GST_RATE) / 100);
  let cgst = 0, sgst = 0, igst = 0;
  if (gstMode === 'igst') igst = gst;
  else { cgst = Math.round(gst / 2); sgst = gst - cgst; }
  return { base: AMOUNT, credit: 0, discount: 0, taxable, gst, cgst, sgst, igst, total: taxable + gst, gstMode, gstRate: GST_RATE, currency: 'INR', testCharge: true };
};

const get = async () => SystemSettings.getSetting(KEY, null);

const activeFor = async (subscriberId, now = new Date()) => {
  const charge = await get();
  return isActiveFor(charge, subscriberId, now) ? charge : null;
};

const set = async ({ subscriberId, gymName, by }, now = new Date()) => {
  const value = { subscriberId: String(subscriberId), gymName, amount: AMOUNT, plan: PLAN, cycle: CYCLE, setBy: String(by || ''), setAt: now.toISOString(), expiresAt: new Date(now.getTime() + MINUTES * 60000).toISOString() };
  await SystemSettings.setSetting(KEY, value, 'RM-11 one-time Rs 1 test price for one internal gym');
  return value;
};

const clear = async () => SystemSettings.setSetting(KEY, null, 'RM-11 one-time Rs 1 test price for one internal gym');

module.exports = { KEY, AMOUNT, PLAN, CYCLE, MINUTES, isActiveFor, quote, get, activeFor, set, clear };
