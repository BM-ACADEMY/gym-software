const express = require('express');
const router = express.Router();
const { listTickets, updateStatus, addNote } = require('../../controllers/rootAdmin/support');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('root_admin'));

router.get('/', listTickets);
router.patch('/:id/status', updateStatus);
router.post('/:id/notes', addNote);

module.exports = router;
