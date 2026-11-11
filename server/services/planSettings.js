'use strict';
// Holds the one live plan-settings store for this server process (built once at start, see server.js).
const { makeStore } = require('./planSettingsStore');
let current = null;
const init = ({ SystemSettings, PLANS }) => { current = makeStore({ SystemSettings, PLANS }); return current; };
const get = () => { if (!current) throw new Error('plan settings not started'); return current; };
module.exports = { init, get };
