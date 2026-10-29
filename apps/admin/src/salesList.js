'use strict';
// Daily list of business owners the sales team should contact, in the Afra AI OS Lead Hub import format
// (headings phone,name,email,source,campaign). Pure rules: no database, no network.
// Input = account facts from the products (CRM-03 shape). One row per account, only its most urgent stage.
// Privacy: these are the BUYERS (owners). No amounts, no usage details, no end-customer data go into the file.
const DAY = 86400000;
const STAGES = ['expired', 'renewal-1d', 'trial-1d', 'renewal-7d', 'trial-3d', 'new-signup', 'renewal-30d', 'idle-14d']; // most urgent first
const HEADINGS = ['phone', 'name', 'email', 'source', 'campaign'];

function e164(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  else if (d.length === 10) d = '91' + d;
  if (!/^\d{11,15}$/.test(d)) return null;
  if (d.startsWith('91') && !/^91[6-9]\d{9}$/.test(d)) return null; // Indian mobiles start 6-9
  return '+' + d;
}
// Spreadsheet programs run text that starts with = + - @ as a formula. Prefix those, then quote the cell.
const cell = (v) => { let s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim(); if (/^[=+\-@\t]/.test(s) && !/^\+\d+$/.test(s)) s = "'" + s; return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// status: result of core-billing computeStatus ({status, endsAt, daysLeft}). now: Date.
function stageOf(a, now) {
  const s = a.status || {}; const left = s.daysLeft; const created = a.createdAt ? new Date(a.createdAt).getTime() : null;
  if (s.status === 'expired' || s.status === 'grace') return 'expired';
  if (s.status === 'trial') { if (left <= 1) return 'trial-1d'; if (left <= 3) return 'trial-3d'; }
  if (s.status === 'active') { if (left <= 1) return 'renewal-1d'; if (left <= 7) return 'renewal-7d'; if (left <= 30) return 'renewal-30d'; }
  if (created != null && now.getTime() - created < DAY && s.status === 'trial') return 'new-signup';
  if (s.status === 'active' && a.lastActiveAt && now.getTime() - new Date(a.lastActiveAt).getTime() > 14 * DAY) return 'idle-14d';
  return null;
}

function build(accounts, { now = new Date(), only = null } = {}) {
  const rows = []; const skipped = { no_consent: 0, bad_phone: 0, no_stage: 0, duplicate_phone: 0 }; const seen = new Set();
  for (const a of accounts || []) {
    const stage = stageOf(a, now); if (!stage) { skipped.no_stage += 1; continue; }
    if (only && !only.includes(stage)) continue;
    if (!a.contactConsent) { skipped.no_consent += 1; continue; }
    const phone = e164(a.ownerPhone); if (!phone) { skipped.bad_phone += 1; continue; }
    const key = phone + '|' + String(a.product); if (seen.has(key)) { skipped.duplicate_phone += 1; continue; } seen.add(key);
    rows.push({ phone, name: String(a.ownerName || a.businessName || '').slice(0, 80), email: String(a.ownerEmail || '').toLowerCase().slice(0, 120), source: 'afra_product', campaign: `${String(a.product).toLowerCase()}-${stage}`, stage });
  }
  rows.sort((x, y) => STAGES.indexOf(x.stage) - STAGES.indexOf(y.stage));
  return { rows, skipped };
}
const toCsv = (rows) => [HEADINGS.join(','), ...rows.map((r) => HEADINGS.map((h) => cell(r[h])).join(','))].join('\n') + '\n';
// Safe to paste in chat or a report: numbers only.
const summary = ({ rows, skipped }) => ({ total: rows.length, byCampaign: rows.reduce((o, r) => { o[r.campaign] = (o[r.campaign] || 0) + 1; return o; }, {}), skipped });
module.exports = { build, toCsv, summary, stageOf, e164, STAGES, HEADINGS };
