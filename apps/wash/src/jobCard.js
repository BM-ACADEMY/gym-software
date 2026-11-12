'use strict';
// A printable job card (one page, plain HTML, no scripts) for the vehicle owner or the attendant. Every value is escaped.
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-IN');
const when = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '');
// job: a plain job; businessName: string; attendant: name or ''.
function jobCardHtml({ job, businessName, attendant }) {
  const lines = (job.lines || []).map((l) => `<tr><td>${esc(l.name || l.label || l.key || 'Service')}</td><td class="n">${esc(rs(l.amount))}</td></tr>`).join('');
  const row = (k, v) => (v ? `<tr><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>` : '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job card ${esc(job.number)} ${esc(job.plate)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:20px auto;max-width:420px;color:#111}h1{font-size:19px;margin:0}h2{font-size:14px;margin:2px 0 12px;font-weight:400;color:#444}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:5px 3px;border-bottom:1px solid #ddd}td.n{text-align:right}.p{font-size:26px;font-weight:700;letter-spacing:2px;margin:8px 0}.t td{font-weight:700;border-top:2px solid #111}.s{margin-top:34px;display:flex;justify-content:space-between;color:#444}@media print{.np{display:none}}</style></head><body>
<h1>${esc(businessName || 'Job card')}</h1><h2>Job card no. ${esc(job.number)} &middot; ${esc(job.day)}</h2><div class="p">${esc(job.plate)}</div>
<table>${row('Vehicle type', job.klass)}${row('Bay', job.bay)}${row('Washer', attendant)}${row('Status', job.state)}${row('Started', when(job.startedAt))}${row('Ready', when(job.readyAt))}</table>
<table>${lines}${job.discount ? `<tr><td>Discount</td><td class="n">- ${esc(rs(job.discount))}</td></tr>` : ''}${job.passCovered ? `<tr><td>Covered by monthly pass</td><td class="n">- ${esc(rs(job.passCovered))}</td></tr>` : ''}<tr class="t"><td>Total</td><td class="n">${esc(rs(job.total))}</td></tr></table>
<div class="s"><span>Customer signature</span><span>Staff</span></div><p class="np">To print: use Print in your browser menu (Ctrl+P).</p></body></html>`;
}
module.exports = { jobCardHtml, esc };
