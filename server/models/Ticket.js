const mongoose = require('mongoose');

// Doc: "Inbox of issues raised by gym owners" — Root Admin's support inbox.
const ticketSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    raisedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    internalNotes: {
      type: [
        new mongoose.Schema(
          {
            note: { type: String, required: true, trim: true },
            authorRootAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'RootAdmin', required: true },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
