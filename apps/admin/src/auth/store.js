'use strict';
// Users live in one JSON file on the server (mode 600), outside git. The two-step secret inside is encrypted.
const fs = require('fs');
function fileStore(path) {
  const read = () => { try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch (e) { return { users: [] }; } };
  const write = (d) => { const tmp = path + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d, null, 1), { mode: 0o600 }); fs.renameSync(tmp, path); };
  return {
    find: async (email) => read().users.find((u) => u.email === email) || null,
    save: async (user) => { const d = read(); const i = d.users.findIndex((u) => u.email === user.email); if (i >= 0) d.users[i] = user; else d.users.push(user); write(d); },
    count: () => read().users.length,
  };
}
const auditFile = (path) => (event) => fs.appendFileSync(path, JSON.stringify(event) + '\n', { mode: 0o600 }); // never put passwords or codes in an event
module.exports = { fileStore, auditFile };
