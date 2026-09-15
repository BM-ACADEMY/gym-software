const Ticket = require('../../models/Ticket');

// @desc    Inbox of issues raised by gym owners
// @route   GET /api/root-admin/support
const listTickets = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const tickets = await Ticket.find(query)
      .populate('subscriberId', 'gymName')
      .populate('raisedByAdminId', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, message: 'Tickets fetched successfully', data: tickets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a ticket's status
// @route   PATCH /api/root-admin/support/:id/status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.status(200).json({ success: true, message: 'Ticket status updated', data: ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add an internal note (visible only to Root Admin team, not the gym owner)
// @route   POST /api/root-admin/support/:id/notes
const addNote = async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ success: false, message: 'Note text is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    ticket.internalNotes.push({ note, authorRootAdminId: req.user.id });
    await ticket.save();

    res.status(201).json({ success: true, message: 'Note added', data: ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listTickets, updateStatus, addNote };
