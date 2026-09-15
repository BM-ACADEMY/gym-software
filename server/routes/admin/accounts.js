const express = require('express');
const router = express.Router();
const { listExpenses, createExpense, updateExpense, deleteExpense, getProfitLoss, getGstSummary } = require('../../controllers/admin/accounts');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/profit-loss', getProfitLoss);
router.get('/gst-summary', getGstSummary);
router.get('/expenses', listExpenses);
router.post('/expenses', createExpense);
router.put('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

module.exports = router;
