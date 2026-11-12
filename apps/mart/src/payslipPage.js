'use strict';
// A printable payslip page for the owner (one page, plain HTML, no scripts). All text is escaped. The owner pays the staff; this is a record.
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-IN');
const STYLE = 'body{font:15px/1.5 system-ui,sans-serif;margin:24px auto;max-width:520px;color:#111}h1{font-size:20px;margin:0}h2{font-size:15px;margin:2px 0 14px;font-weight:400;color:#444}table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #ddd}td.n{text-align:right}tr.t td{font-weight:700;border-top:2px solid #111}.w{background:#fff3cd;padding:8px;margin:12px 0;border-radius:4px}.s{margin-top:44px;display:flex;justify-content:space-between;color:#444}section{page-break-after:always;margin-bottom:40px}section:last-of-type{page-break-after:auto}@media print{.np{display:none}}';
function block(p, shopName) {
  const row = (k, v) => `<tr><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>`;
  return `<section><h1>${esc(shopName || 'Payslip')}</h1><h2>Payslip for ${esc(p.month)}</h2>
<table>${row('Name', p.name)}${row('Monthly salary', rs(p.monthlySalary))}${row('Payable days', `${p.payableDays} of ${p.daysInMonth}`)}${row('Present / half day', `${p.counts.present} / ${p.counts.half}`)}${row('Paid leave / weekly off', `${p.counts.paid_leave} / ${p.counts.weekly_off}`)}${row('Absent / unpaid leave', `${p.counts.absent} / ${p.counts.unpaid_leave}`)}${p.leaveOverAllowance ? row('Paid leave over the yearly allowance (paid as unpaid)', p.leaveOverAllowance) : ''}${row('Pay for the days', rs(p.gross))}${row('Advances taken', rs(p.advances))}<tr class="t"><td>To pay</td><td class="n">${esc(rs(p.net))}</td></tr></table>
${p.advanceCarryForward ? `<p>Advance still to recover next month: ${esc(rs(p.advanceCarryForward))}</p>` : ''}${p.draft ? `<p class="w">Draft: ${esc(p.unmarkedDays.length)} day(s) are not marked, so they are not paid yet.</p>` : ''}
<div class="s"><span>Owner signature</span><span>Staff signature</span></div></section>`;
}
// One slip, or one slip per page for everyone. No scripts: print with the browser's Print (Ctrl+P).
function payslipsHtml(slips, shopName, title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title || 'Payslips')}</title><style>${STYLE}</style></head><body>${slips.map((p) => block(p, shopName)).join('')}<p class="np">To print: use Print in your browser menu (Ctrl+P).</p></body></html>`;
}
const payslipHtml = (p, shopName) => payslipsHtml([p], shopName, `Payslip ${p.month} ${p.name}`);
module.exports = { payslipHtml, payslipsHtml, esc };
