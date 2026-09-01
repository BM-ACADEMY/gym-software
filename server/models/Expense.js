const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    category: {
      type: String,
      enum: ['rent', 'equipment', 'salaries', 'utilities', 'other'],
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

expenseSchema.index({ subscriberId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
