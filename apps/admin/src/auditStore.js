'use strict';
// Audit trail viewer (SA-08). Records what the owner and the DM team did in Super Admin (adds, approvals, sends, downloads, views).
// Entries hold WHO, WHAT and a short reference or number. Never a name, phone, email, password, key or message text.
// Sign-in events (lockouts, failed codes) are kept by the sign-in module in its own file (ADMIN_AUDIT_FILE) and are not shown here yet.
const KEEP = ['who', 'action', 'ref', 'count', 'rows', 'sent', 'updated', 'reason', 'product'];
const short = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? v : 0) : String(v == null ? '' : v).slice(0, 80));
const clean = (e, now = new Date()) => {
  if (!e || typeof e !== 'object' || !e.action) return null;
  const out = { at: now }; for (const k of KEEP) if (e[k] != null) out[k] = short(e[k]); return out;
};
// Spreadsheet programs run text that starts with = + - @ as a formula. Prefix those, then quote the cell.
const cell = (v) => { let s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim(); if (/^[=+\-@\t]/.test(s)) s = "'" + s; return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const HEAD = ['at', 'who', 'action', 'ref', 'count', 'rows', 'sent', 'updated', 'reason', 'product'];
const toCsv = (rows) => [HEAD.join(','), ...rows.map((r) => HEAD.map((h) => cell(h === 'at' ? new Date(r.at).toISOString() : r[h])).join(','))].join('\n') + '\n';

function makeAuditStore(mongoose) {
  const Row = mongoose.models.AdminAudit || mongoose.model('AdminAudit', new mongoose.Schema({ at: { type: Date, index: true }, who: String, action: { type: String, index: true }, ref: String, count: Number, rows: Number, sent: Number, updated: Number, reason: String, product: String }));
  return {
    record: async (e) => { const c = clean(e); if (c) await Row.create(c); },
    list: async ({ action, who, from, to, limit = 200 } = {}) => {
      const q = {}; if (action) q.action = { $regex: '^' + String(action).slice(0, 40).replace(/[^\w.:-]/g, ''), $options: 'i' }; if (who) q.who = String(who).slice(0, 80);
      if (from || to) { q.at = {}; if (from && !isNaN(new Date(from))) q.at.$gte = new Date(from); if (to && !isNaN(new Date(to))) q.at.$lte = new Date(to); if (!Object.keys(q.at).length) delete q.at; }
      return (await Row.find(q).sort({ at: -1 }).limit(Math.min(Number(limit) || 200, 1000)).lean()).map((d) => ({ ...d, id: String(d._id) }));
    },
  };
}
module.exports = { clean, toCsv, makeAuditStore, cell };
