const express = require('express');
const router = express.Router();
const { createTicket, listMyTickets } = require('../../controllers/admin/support');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', listMyTickets);
router.post('/', createTicket);

module.exports = router;
