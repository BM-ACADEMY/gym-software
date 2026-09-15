const express = require('express');
const router = express.Router();
const { listInvoices, createInvoice, markPaid, getFailedQueue, retryInvoice } = require('../../controllers/rootAdmin/billing');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('root_admin'));

router.get('/failed-queue', getFailedQueue);
router.get('/invoices', listInvoices);
router.post('/invoices', createInvoice);
router.patch('/invoices/:id/mark-paid', markPaid);
router.post('/invoices/:id/retry', retryInvoice);

module.exports = router;
