const PDFDocument = require('pdfkit');
const { getPlan } = require('../config/plans');

// Tax invoice for a GymDesk subscription payment, streamed to the response.
// Seller details come from env so the CA can approve wording without code changes.
const seller = () => ({
  name: process.env.INVOICE_SELLER_NAME || 'Afra Ventures Pvt Ltd',
  gstin: process.env.INVOICE_SELLER_GSTIN || '',
  address: process.env.INVOICE_SELLER_ADDRESS || '',
  sac: process.env.INVOICE_SAC || '998431', // SaaS / online information services, confirm with CA
});

const rupees = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN')}`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-');

const streamSubscriptionInvoice = (res, p) => {
  const s = seller();
  const plan = getPlan(p.planKey);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${String(p.invoiceNo || p._id).replace(/[^\w-]/g, '_')}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text('TAX INVOICE');
  doc.moveDown(0.5).fontSize(11).text(s.name);
  doc.font('Helvetica').fontSize(10).fillColor('#444');
  if (s.address) doc.text(s.address);
  if (s.gstin) doc.text(`GSTIN: ${s.gstin}`);
  doc.moveDown();

  doc.fillColor('#000').font('Helvetica-Bold').text(`Invoice no: ${p.invoiceNo || '-'}`);
  doc.font('Helvetica').text(`Date: ${fmt(p.paidAt)}`).text(`Payment ID: ${p.razorpayPaymentId || '-'}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').text('Billed to');
  doc.font('Helvetica').text(p.buyerName || 'Gym');
  if (p.buyerGstin) doc.text(`GSTIN: ${p.buyerGstin}`);
  if (p.buyerState) doc.text(`Place of supply: ${p.buyerState}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').text('Description');
  doc.font('Helvetica').text(`GymDesk ${plan ? plan.name : p.planKey} plan, ${p.cycle}. Service period ${fmt(p.periodStart)} to ${fmt(p.periodEnd)}. SAC ${s.sac}.`);
  doc.moveDown();

  const line = (label, value, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 50, doc.y, { continued: true, width: 300 });
    doc.text(value, { align: 'right' });
  };
  line('Plan price', rupees(p.base));
  if (p.discount) line(`Discount${p.promoCode ? ` (${p.promoCode})` : ''}`, `- ${rupees(p.discount)}`);
  if (p.credit) line('Credit for unused days', `- ${rupees(p.credit)}`);
  line('Taxable value', rupees(p.taxable));
  if (p.igst) line(`IGST @ ${p.gstRate}%`, rupees(p.igst));
  else {
    line(`CGST @ ${p.gstRate / 2}%`, rupees(p.cgst));
    line(`SGST @ ${p.gstRate / 2}%`, rupees(p.sgst));
  }
  doc.moveDown(0.5);
  line('Total paid', rupees(p.total), true);
  doc.moveDown(2).fontSize(8).fillColor('#666').text('This is a computer generated invoice.');
  doc.end();
};

module.exports = { streamSubscriptionInvoice };
