const PDFDocument = require('pdfkit');
const { slipRows, monthName } = require('../services/payroll/slip');

// Helvetica cannot draw the rupee sign or Tamil/Hindi, so amounts print as "Rs" and
// names outside basic Latin are replaced with "?". Good enough for v1; embed a Unicode font later.
const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN')}`;
const latin = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7E -ÿ]/g, '?');

const streamPayslip = (res, { run, item, gymName }) => {
  const p = item.payslip;
  const { earn, ded } = slipRows(item);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${run.month}-${latin(item.name).replace(/[^\w-]/g, '_')}.pdf"`);
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(18).text(latin(gymName));
  doc.font('Helvetica').fontSize(10).fillColor('#444').text(`Payslip for ${monthName(run.month)}`);
  doc.moveDown(0.5).fillColor('#000').font('Helvetica-Bold').fontSize(12).text(latin(item.name));
  if (item.roleTitle) doc.font('Helvetica').fontSize(9).fillColor('#444').text(latin(item.roleTitle));
  doc.fillColor('#444').fontSize(9).text(`Working days ${p.workingDays}  |  Loss of pay days ${item.lopDays}`);
  doc.moveDown();

  const line = (label, value, bold) => {
    doc.fillColor('#000').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).text(latin(label), 50, doc.y, { continued: true, width: 350 });
    doc.text(value, { align: 'right' });
  };
  doc.font('Helvetica-Bold').fontSize(11).text('Earnings'); doc.moveDown(0.3);
  earn.forEach(([d, a]) => line(d, rs(a)));
  line('Gross', rs(p.gross + (p.adjAdd || 0)), true);
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(11).text('Deductions'); doc.moveDown(0.3);
  if (!ded.length) line('None', rs(0));
  ded.forEach(([d, a]) => line(d, rs(a)));
  line('Total deductions', rs(p.totalDeductions), true);
  doc.moveDown();
  line('Net pay', rs(p.net), true);
  if (p.advanceCarriedForward) doc.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#444').text(`Advance carried forward: ${rs(p.advanceCarriedForward)}`);
  doc.moveDown(2).fontSize(8).fillColor('#666').text('This is a computer generated payslip.');
  doc.end();
};

module.exports = { streamPayslip };
