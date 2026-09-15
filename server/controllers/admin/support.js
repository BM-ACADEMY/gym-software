const Ticket = require('../../models/Ticket');

// @desc    Raise a support ticket with the GymDesk platform team
// @route   POST /api/admin/support
const createTicket = async (req, res) => {
  try {
    const { subject, description } = req.body;
    if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });

    const ticket = await Ticket.create({
      subscriberId: req.user.subscriberId,
      raisedByAdminId: req.user.id,
      subject,
      description,
    });

    res.status(201).json({ success: true, message: 'Support ticket submitted — the GymDesk team will follow up', data: ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    View own gym's past tickets
// @route   GET /api/admin/support
const listMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ subscriberId: req.user.subscriberId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: 'Tickets fetched successfully', data: tickets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createTicket, listMyTickets };
