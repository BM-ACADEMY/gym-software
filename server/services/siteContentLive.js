'use strict';
// Holds the one live site-content store for this server process (built once at start, see server.js).
const { makeStore } = require('./siteContentStore');
let current = null;
const init = ({ SystemSettings }) => { current = makeStore({ SystemSettings }); return current; };
// Before start-up (or in a test with no database) a store with no saved changes answers with the code defaults.
const get = () => current || makeStore({ SystemSettings: { getSetting: async () => null, setSetting: async () => {} } });
module.exports = { init, get };
