'use strict';
// CLO-08: sales by item, staff and hour, and a Tally-style CSV for the CA. Pure. Whole rupees (INR). Written, not yet tested by a person.
// Item and staff amounts are line amounts before GST after the line discount; a bill-level discount is not shared out to lines (stated in the note).
// The Tally-style CSV is a plain voucher list for the CA to key in or map. It is NOT a Tally import file and we do not file GST.
const { toCsv } = require('./accounts');
const int = (n) => Math.round(Number(n) || 0);
const istHour = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? null : new Date(t + 5.5 * 3600000).getUTCHours(); };
const live = (bills) => (bills || []).filter((b) => b && b.status !== 'returned');

function breakdown(bills, by) {
  const out = {};
  if (by === 'hour') {
    for (const b of live(bills)) { const h = istHour(b.at); if (h === null) continue; const k = String(h).padStart(2, '0') + ':00'; const o = out[k] = out[k] || { key: k, bills: 0, total: 0 }; o.bills++; o.total += int(b.total); }
    return Object.values(out).sort((a, b) => (a.key < b.key ? -1 : 1));
  }
  for (const b of live(bills)) for (const l of b.lines || []) {
    const k = by === 'staff' ? (l.staffId ? String(l.staffId) : 'No staff on the line') : String(l.name || 'Item').slice(0, 80);
    const o = out[k] = out[k] || { key: k, pieces: 0, amount: 0 }; o.pieces += Number(l.qty) || 0; o.amount += int(l.net != null ? l.net : l.taxable);
  }
  return Object.values(out).sort((a, b) => b.amount - a.amount);
}
const report = (bills, by) => ({ by, currency: 'INR', rows: breakdown(bills, by), note: by === 'hour' ? 'Bill totals by the hour the bill was made (India time).' : 'Line amounts before GST, after line discounts. A discount on the whole bill is not shared out to lines.' });

const HEAD = ['date', 'voucher_no', 'voucher_type', 'party', 'taxable', 'gst', 'discount', 'total', 'status'];
function tallyRows(bills, { names = {} } = {}) {
  return (bills || []).filter(Boolean).map((b) => ({ date: b.date, voucher_no: b.number, voucher_type: b.status === 'returned' ? 'Sales (returned, check with CA)' : 'Sales', party: (b.customerId && names[b.customerId]) || 'Cash sale', taxable: int(b.taxable), gst: int(b.gst), discount: int(b.discount), total: int(b.total), status: b.status || '' }));
}
const tallyCsv = (bills, opts) => toCsv(HEAD, tallyRows(bills, opts));
module.exports = { breakdown, report, tallyRows, tallyCsv, istHour };
