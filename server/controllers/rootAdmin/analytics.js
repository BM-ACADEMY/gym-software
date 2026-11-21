const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Subscriber = require('../../models/Subscriber');
const PlatformPayment = require('../../models/PlatformPayment');
const PlatformPlan = require('../../models/PlatformPlan');
const Payment = require('../../models/Payment');

const getPeriod = (query) => {
  const now = new Date();
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let dateTo;
  if (query.dateTo) {
    dateTo = new Date(query.dateTo);
    dateTo.setHours(23, 59, 59, 999);
  } else {
    dateTo = now;
  }
  return { dateFrom, dateTo };
};

const dayBucket = (dateField) => ({ $dateToString: { format: '%Y-%m-%d', date: dateField } });

const buildReport = async (query) => {
  const { dateFrom, dateTo } = getPeriod(query);

  const [revenueTrend, growthChart, churnTrendRaw, planDistribution, activeSubscribers, churnedThisPeriod, topGyms] = await Promise.all([
    PlatformPayment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: dateFrom, $lt: dateTo } } },
      { $group: { _id: dayBucket('$paidAt'), total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Subscriber.aggregate([
      { $match: { createdAt: { $gte: dateFrom, $lt: dateTo } } },
      { $group: { _id: dayBucket('$createdAt'), newSubscribers: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Subscriber.aggregate([
      { $match: { isActive: false, updatedAt: { $gte: dateFrom, $lt: dateTo } } },
      { $group: { _id: dayBucket('$updatedAt'), churned: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Subscriber.aggregate([
      { $group: { _id: '$platformPlanId', count: { $sum: 1 } } },
    ]),
    Subscriber.countDocuments({ isActive: true }),
    Subscriber.countDocuments({ isActive: false, updatedAt: { $gte: dateFrom, $lt: dateTo } }),
    Payment.aggregate([
      { $unwind: '$installments' },
      { $group: { _id: '$subscriberId', revenue: { $sum: '$installments.amount' } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const planIds = planDistribution.map((p) => p._id).filter(Boolean);
  const plans = await PlatformPlan.find({ _id: { $in: planIds } }).select('name');
  const planNameById = new Map(plans.map((p) => [String(p._id), p.name]));
  const planDistributionNamed = planDistribution.map((p) => ({
    planId: p._id,
    planName: p._id ? planNameById.get(String(p._id)) || 'Unknown plan' : 'No plan assigned',
    count: p.count,
  }));

  const gymIds = topGyms.map((g) => g._id);
  const gyms = await Subscriber.find({ _id: { $in: gymIds } }).select('gymName');
  const gymNameById = new Map(gyms.map((g) => [String(g._id), g.gymName]));
  const topGymsNamed = topGyms.map((g) => ({ subscriberId: g._id, gymName: gymNameById.get(String(g._id)) || 'Unknown', revenue: g.revenue }));

  const churnBase = activeSubscribers + churnedThisPeriod;
  const churnRate = churnBase > 0 ? churnedThisPeriod / churnBase : 0;

  return {
    period: { dateFrom, dateTo },
    revenueTrend: revenueTrend.map((d) => ({ date: d._id, total: d.total })),
    growthChart: growthChart.map((d) => ({ date: d._id, newSubscribers: d.newSubscribers })),
    churnTrend: churnTrendRaw.map((d) => ({ date: d._id, churned: d.churned })),
    planDistribution: planDistributionNamed,
    churn: { activeSubscribers, churnedThisPeriod, churnRate: Math.round(churnRate * 1000) / 1000 },
    topGyms: topGymsNamed,
  };
};

// @desc    Platform-wide revenue trend, churn rate, plan distribution, growth, top gyms
// @route   GET /api/root-admin/analytics
const getAnalytics = async (req, res) => {
  try {
    const data = await buildReport(req.query);
    res.status(200).json({ success: true, message: 'Analytics fetched successfully', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const escapeCsv = (value) => {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// @desc    Export the revenue trend + top gyms as CSV
// @route   GET /api/root-admin/analytics/export
const exportAnalytics = async (req, res) => {
  try {
    const data = await buildReport(req.query);

    const lines = ['Section,Date/Gym,Value'];
    data.revenueTrend.forEach((r) => lines.push(['Revenue', r.date, r.total].map(escapeCsv).join(',')));
    data.churnTrend.forEach((c) => lines.push(['Churned', c.date, c.churned].map(escapeCsv).join(',')));
    data.planDistribution.forEach((p) => lines.push(['Plan distribution', p.planName, p.count].map(escapeCsv).join(',')));
    data.topGyms.forEach((g) => lines.push(['Top Gym', g.gymName, g.revenue].map(escapeCsv).join(',')));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-analytics.csv"');
    res.status(200).send(lines.join('\n'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Export the same report as a one-page PDF summary
// @route   GET /api/root-admin/analytics/export.pdf
const exportAnalyticsPdf = async (req, res) => {
  try {
    const data = await buildReport(req.query);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-analytics.pdf"');
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('GymDesk — Platform Analytics');
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(
      `${new Date(data.period.dateFrom).toLocaleDateString()} — ${new Date(data.period.dateTo).toLocaleDateString()}`
    );
    doc.moveDown(1.5);
    doc.fillColor('#000');

    doc.fontSize(13).font('Helvetica-Bold').text('Summary');
    doc.fontSize(11).font('Helvetica');
    doc.text(`Active subscribers: ${data.churn.activeSubscribers}`);
    doc.text(`Churned this period: ${data.churn.churnedThisPeriod}`);
    doc.text(`Churn rate: ${(data.churn.churnRate * 100).toFixed(1)}%`);
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Revenue trend');
    doc.fontSize(10).font('Helvetica');
    if (data.revenueTrend.length === 0) doc.fillColor('#999').text('No revenue in this period.').fillColor('#000');
    data.revenueTrend.forEach((r) => doc.text(`${r.date}  —  Rs. ${r.total.toLocaleString('en-IN')}`));
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Churn trend');
    doc.fontSize(10).font('Helvetica');
    if (data.churnTrend.length === 0) doc.fillColor('#999').text('No churn events in this period.').fillColor('#000');
    data.churnTrend.forEach((c) => doc.text(`${c.date}  —  ${c.churned} churned`));
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Plan distribution');
    doc.fontSize(10).font('Helvetica');
    data.planDistribution.forEach((p) => doc.text(`${p.planName}: ${p.count} subscriber(s)`));
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Top gyms by revenue');
    doc.fontSize(10).font('Helvetica');
    if (data.topGyms.length === 0) doc.fillColor('#999').text('No revenue data yet.').fillColor('#000');
    data.topGyms.forEach((g, i) => doc.text(`${i + 1}. ${g.gymName} — Rs. ${g.revenue.toLocaleString('en-IN')}`));

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAnalytics, exportAnalytics, exportAnalyticsPdf };
