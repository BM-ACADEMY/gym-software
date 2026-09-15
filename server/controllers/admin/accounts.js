const mongoose = require('mongoose');
const Expense = require('../../models/Expense');
const Payment = require('../../models/Payment');
const Subscriber = require('../../models/Subscriber');

// Salaries are an employment cost, not a taxable supply — no input tax credit
// applies to them. Every other expense category is treated as GST-inclusive
// and eligible for ITC.
const GST_ELIGIBLE_EXPENSE_CATEGORIES = ['rent', 'equipment', 'utilities', 'other'];

const CATEGORIES = ['rent', 'equipment', 'salaries', 'utilities', 'other'];

// Defaults to the current calendar month when no range is given.
const getPeriod = (query) => {
  const now = new Date();
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
  let dateTo;
  if (query.dateTo) {
    dateTo = new Date(query.dateTo);
    dateTo.setHours(23, 59, 59, 999);
  } else {
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return { dateFrom, dateTo };
};

// @desc    List expenses, filterable by category/date range
// @route   GET /api/admin/accounts/expenses
const listExpenses = async (req, res) => {
  try {
    const { category } = req.query;
    const { dateFrom, dateTo } = getPeriod(req.query);
    const query = { subscriberId: req.user.subscriberId, date: { $gte: dateFrom, $lt: dateTo } };
    if (category) query.category = category;

    const expenses = await Expense.find(query).sort({ date: -1 });
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    res.status(200).json({ success: true, message: 'Expenses fetched successfully', data: { expenses, total } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Record an expense
// @route   POST /api/admin/accounts/expenses
const createExpense = async (req, res) => {
  try {
    const { category, description, amount, date } = req.body;
    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of ${CATEGORIES.join(', ')}` });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'A positive amount is required' });
    }

    const expense = await Expense.create({
      subscriberId: req.user.subscriberId,
      category,
      description,
      amount: Number(amount),
      date: date || new Date(),
    });

    res.status(201).json({ success: true, message: 'Expense recorded successfully', data: expense });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update an expense
// @route   PUT /api/admin/accounts/expenses/:id
const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const { category, description, amount, date } = req.body;
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: `category must be one of ${CATEGORIES.join(', ')}` });
      }
      expense.category = category;
    }
    if (description !== undefined) expense.description = description;
    if (amount !== undefined) {
      if (amount <= 0) return res.status(400).json({ success: false, message: 'A positive amount is required' });
      expense.amount = Number(amount);
    }
    if (date !== undefined) expense.date = date;

    await expense.save();
    res.status(200).json({ success: true, message: 'Expense updated successfully', data: expense });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete an expense entry
// @route   DELETE /api/admin/accounts/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const result = await Expense.deleteOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    res.status(200).json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Profit/loss for a period: total revenue collected minus total expenses
// @route   GET /api/admin/accounts/profit-loss
const getProfitLoss = async (req, res) => {
  try {
    const { dateFrom, dateTo } = getPeriod(req.query);
    const subscriberId = new mongoose.Types.ObjectId(req.user.subscriberId);

    const [revenueAgg, expenses, byCategoryAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { subscriberId } },
        { $unwind: '$installments' },
        { $match: { 'installments.paidAt': { $gte: dateFrom, $lt: dateTo } } },
        { $group: { _id: null, total: { $sum: '$installments.amount' } } },
      ]),
      Expense.find({ subscriberId: req.user.subscriberId, date: { $gte: dateFrom, $lt: dateTo } }),
      Expense.aggregate([
        { $match: { subscriberId, date: { $gte: dateFrom, $lt: dateTo } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
      ]),
    ]);

    const revenue = revenueAgg[0]?.total || 0;
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expensesByCategory = { rent: 0, equipment: 0, salaries: 0, utilities: 0, other: 0 };
    byCategoryAgg.forEach((c) => { expensesByCategory[c._id] = c.total; });

    res.status(200).json({
      success: true,
      message: 'Profit/loss fetched successfully',
      data: { period: { dateFrom, dateTo }, revenue, totalExpenses, profit: revenue - totalExpenses, expensesByCategory },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    GST summary for a period — output tax on revenue collected minus
//          input tax credit on GST-eligible expenses, both treated as
//          GST-inclusive amounts at the gym's configured rate.
// @route   GET /api/admin/accounts/gst-summary
const getGstSummary = async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.user.subscriberId).select('gstEnabled gstNumber gstRate');
    if (!subscriber.gstEnabled) {
      return res.status(200).json({ success: true, message: 'GST is not enabled for this gym', data: { enabled: false } });
    }

    const { dateFrom, dateTo } = getPeriod(req.query);
    const subscriberId = new mongoose.Types.ObjectId(req.user.subscriberId);
    const rate = subscriber.gstRate || 18;
    // Splitting a GST-inclusive amount into base + tax: tax = amount * rate / (100 + rate)
    const taxPortion = (amount) => Math.round((amount * rate) / (100 + rate));

    const [revenueAgg, eligibleExpenses] = await Promise.all([
      Payment.aggregate([
        { $match: { subscriberId } },
        { $unwind: '$installments' },
        { $match: { 'installments.paidAt': { $gte: dateFrom, $lt: dateTo } } },
        { $group: { _id: null, total: { $sum: '$installments.amount' } } },
      ]),
      Expense.aggregate([
        { $match: { subscriberId, date: { $gte: dateFrom, $lt: dateTo }, category: { $in: GST_ELIGIBLE_EXPENSE_CATEGORIES } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const revenue = revenueAgg[0]?.total || 0;
    const eligibleExpenseTotal = eligibleExpenses[0]?.total || 0;
    const outputTax = taxPortion(revenue);
    const inputTaxCredit = taxPortion(eligibleExpenseTotal);

    res.status(200).json({
      success: true,
      message: 'GST summary fetched successfully',
      data: {
        enabled: true,
        gstNumber: subscriber.gstNumber || null,
        rate,
        period: { dateFrom, dateTo },
        revenue,
        outputTax,
        eligibleExpenseTotal,
        inputTaxCredit,
        netPayable: Math.max(0, outputTax - inputTaxCredit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listExpenses, createExpense, updateExpense, deleteExpense, getProfitLoss, getGstSummary };
