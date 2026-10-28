'use strict';
// Placement fee and GST, whole rupees with a currency code. GST 18% on the fee (rate to be confirmed by the CA, M-04).
const { err } = require('./candidate');
function placementFee({ annualCtc, feeType, feeValue, gstRate = 18, gstMode = 'cgst_sgst' }) {
  if (!Number.isInteger(annualCtc) || annualCtc <= 0) throw err('FEE_INVALID', 'annual pay must be whole rupees above zero');
  if (!['percent', 'flat'].includes(feeType)) throw err('FEE_INVALID', 'fee type must be percent or flat');
  if (!Number.isFinite(feeValue) || feeValue < 0 || (feeType === 'percent' && feeValue > 100)) throw err('FEE_INVALID', 'bad fee value');
  if (![0, 5, 12, 18, 28].includes(gstRate)) throw err('FEE_INVALID', 'gst rate not allowed');
  const fee = feeType === 'percent' ? Math.round(annualCtc * feeValue / 100) : Math.round(feeValue);
  const gst = Math.round(fee * gstRate / 100);
  const half = Math.floor(gst / 2);
  return gstMode === 'igst'
    ? { fee, gst, cgst: 0, sgst: 0, igst: gst, total: fee + gst, currency: 'INR' }
    : { fee, gst, cgst: half, sgst: gst - half, igst: 0, total: fee + gst, currency: 'INR' };
}
// Replacement guarantee: fee is due only after the guarantee period unless the agency says otherwise.
function dueDate(joinedAt, creditDays = 30) { const d = new Date(joinedAt); d.setUTCDate(d.getUTCDate() + creditDays); return d.toISOString().slice(0, 10); }
module.exports = { placementFee, dueDate };
