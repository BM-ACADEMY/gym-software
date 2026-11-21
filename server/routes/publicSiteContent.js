const express = require('express');
const router = express.Router();
const { getTrialDays } = require('../config/plans');
const live = require('../services/siteContentLive');

// D-28: the public pages read their wording from here, so a change in Root Admin shows without a deploy.
// Nothing but wording: no history, no reasons, no names. The trial length is filled into {trialDays}.
router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ success: true, data: live.get().publicView({ trialDays: getTrialDays() }) });
});
module.exports = router;
