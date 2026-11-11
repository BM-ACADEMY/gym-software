const express = require('express');
const router = express.Router();
const { PLANS, GST_RATE, getTrialDays } = require('../config/plans');
const { publicPlans } = require('../services/planOverrides');

// SET-01: the public pricing page reads live prices from here, so a change in Root Admin shows without a deploy.
router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ success: true, data: { plans: publicPlans(PLANS, GST_RATE), trialDays: getTrialDays() } });
});
module.exports = router;
