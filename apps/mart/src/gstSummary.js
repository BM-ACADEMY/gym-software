'use strict';
// GST summary for the owner and the CA (area 1). We do NOT file GST. Groups the bills' lines by GST rate: taxable value and GST.
// Bills that were returned are left out. CGST/SGST split follows each bill's own gstMode. Whole rupees, currency INR. Pure.
const int = (n) => Math.round(Number(n) || 0);
function gstSummary(bills) {
  const by = {}; let bills_n = 0;
  for (const b of bills || []) {
    if (!b || b.status === 'returned') continue; bills_n += 1;
    for (const l of b.lines || []) {
      const rate = Number(l.rate ?? 0); const r = by[rate] || (by[rate] = { rate, taxable: 0, gst: 0, cgst: 0, sgst: 0, igst: 0 });
      r.taxable += int(l.taxable); r.gst += int(l.gst);
      if (b.gstMode === 'igst') r.igst += int(l.gst); else { const c = Math.round(int(l.gst) / 2); r.cgst += c; r.sgst += int(l.gst) - c; }
    }
  }
  const rows = Object.values(by).sort((a, b) => a.rate - b.rate).map((r) => ({ ...r, currency: 'INR' }));
  const tot = rows.reduce((a, r) => ({ taxable: a.taxable + r.taxable, gst: a.gst + r.gst }), { taxable: 0, gst: 0 });
  return { rows, taxable: tot.taxable, gst: tot.gst, bills: bills_n, currency: 'INR', note: 'For your CA. We do not file GST. Check the rates with your CA.' };
}
module.exports = { gstSummary };
