'use strict';
// Where job photos are kept. One small interface so the place can change without touching the routes:
//   { kind, put(key, buffer) -> Promise, get(key) -> Promise<Buffer|null>, remove(key) -> Promise }
// Today there is ONE adapter: a folder on the server's own disk (env WASH_PHOTO_DIR). A cloud storage adapter is an owner decision
// (WSH-P1: which account, which cost); it would be a second file with the same three functions. Keys look like <businessId>/<jobId>/<random>.<ext>.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const KEY = /^[0-9a-fA-F]{24}\/[0-9a-fA-F]{24}\/[0-9a-f]{32}\.(jpg|png|webp)$/;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const newKey = (tenantId, jobId, mime) => `${tenantId}/${jobId}/${crypto.randomBytes(16).toString('hex')}.${EXT[mime]}`;

// First bytes of the file must match the type it claims (the browser's word is not enough).
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
function localDisk(dir) {
  const root = path.resolve(dir);
  const at = (key) => { if (!KEY.test(String(key))) throw new Error('bad photo key'); const p = path.resolve(root, key); if (!p.startsWith(root + path.sep)) throw new Error('bad photo key'); return p; };
  return {
    kind: 'local',
    async put(key, buffer) { const p = at(key); await fs.promises.mkdir(path.dirname(p), { recursive: true }); await fs.promises.writeFile(p, buffer, { flag: 'wx', mode: 0o600 }); },
    async get(key) { try { return await fs.promises.readFile(at(key)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } },
    async remove(key) { try { await fs.promises.unlink(at(key)); } catch (e) { if (e.code !== 'ENOENT') throw e; } },
  };
}
// null when no folder is set: the upload route then answers 503 "not set up" instead of guessing a place.
const fromEnv = (env = process.env) => (env.WASH_PHOTO_DIR && path.isAbsolute(env.WASH_PHOTO_DIR) ? localDisk(env.WASH_PHOTO_DIR) : null);
module.exports = { KEY, EXT, newKey, sniff, localDisk, fromEnv };
