const PDFDocument = require('pdfkit');

// Streams a one-page invoice/receipt PDF for a Payment record directly to an
// HTTP response — no temp file, no external service, works fully offline.
const streamInvoicePdf = (res, { payment, member, subscriber }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payment.invoiceNumber || payment._id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text(subscriber?.gymName || 'Gym', { continued: false });
  doc.fontSize(10).font('Helvetica').fillColor('#666').text('Invoice / Payment Receipt');
  if (subscriber?.gstEnabled && subscriber?.gstNumber) {
    doc.text(`GSTIN: ${subscriber.gstNumber}`);
  }
  doc.moveDown(1.5);

  doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text(`Invoice #: ${payment.invoiceNumber || '—'}`);
  doc.font('Helvetica').text(`Date: ${new Date(payment.paidAt || payment.createdAt).toLocaleDateString()}`);
  doc.text(`Status: ${payment.status.toUpperCase()}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').text('Billed to');
  doc.font('Helvetica').text(member?.name || 'Member');
  if (member?.phone) doc.text(member.phone);
  if (member?.email) doc.text(member.email);
  doc.moveDown();

  const tableTop = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('Description', 50, tableTop);
  doc.text('Method', 280, tableTop);
  doc.text('Date', 380, tableTop);
  doc.text('Amount', 480, tableTop, { width: 65, align: 'right' });
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#ddd').stroke();

  doc.font('Helvetica');
  let y = tableTop + 22;
  const rows = payment.installments?.length
    ? payment.installments
    : [{ amount: payment.amountPaid, method: payment.method, paidAt: payment.paidAt || payment.createdAt, note: payment.category }];

  rows.forEach((installment) => {
    doc.text(installment.note || `${payment.category || 'Membership'} payment`, 50, y, { width: 220 });
    doc.text(installment.method, 280, y);
    doc.text(new Date(installment.paidAt).toLocaleDateString(), 380, y);
    doc.text(`Rs. ${installment.amount.toLocaleString('en-IN')}`, 480, y, { width: 65, align: 'right' });
    y += 20;
  });

  doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#ddd').stroke();
  y += 15;

  if (subscriber?.gstEnabled) {
    const rate = subscriber.gstRate || 18;
    const taxAmount = Math.round((payment.amount * rate) / (100 + rate));
    const taxableValue = payment.amount - taxAmount;
    doc.font('Helvetica').text('Taxable value', 280, y);
    doc.text(`Rs. ${taxableValue.toLocaleString('en-IN')}`, 480, y, { width: 65, align: 'right' });
    y += 16;
    doc.text(`GST (${rate}%)`, 280, y);
    doc.text(`Rs. ${taxAmount.toLocaleString('en-IN')}`, 480, y, { width: 65, align: 'right' });
    y += 16;
  }

  doc.font('Helvetica').text('Total invoice amount', 280, y);
  doc.text(`Rs. ${payment.amount.toLocaleString('en-IN')}`, 480, y, { width: 65, align: 'right' });
  y += 18;
  doc.font('Helvetica-Bold').text('Amount paid', 280, y);
  doc.text(`Rs. ${payment.amountPaid.toLocaleString('en-IN')}`, 480, y, { width: 65, align: 'right' });
  const balance = Math.max(0, payment.amount - payment.amountPaid);
  if (balance > 0) {
    y += 18;
    doc.fillColor('#b91c1c').text('Balance due', 280, y);
    doc.text(`Rs. ${balance.toLocaleString('en-IN')}`, 480, y, { width: 65, align: 'right' });
    doc.fillColor('#000');
  }

  doc.moveDown(3);
  doc.fontSize(9).fillColor('#999').text('This is a system-generated receipt.', 50, doc.y);

  doc.end();
};

module.exports = { streamInvoicePdf };
