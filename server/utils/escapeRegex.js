// Escapes user text so it is matched literally inside a MongoDB $regex.
// Without this, a search like ".*" or "(a+)+$" matches everything or can
// hang the database (ReDoS).
const escapeRegex = (value) => String(value).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };
