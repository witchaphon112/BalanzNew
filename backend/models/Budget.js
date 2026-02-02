const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false },
  period: { type: String, enum: ['monthly', 'weekly'], default: 'monthly' },
  amount: { type: Number, required: true, default: 0 },
  startDay: { type: Number, default: 1 }, // เช่น เริ่มรอบวันที่ 26 -> store 26
  startDate: { type: Date },
  notifyThreshold: { type: Number, default: 80 }, // percent
  cycleStartDay: { type: Number, default: 1 },
}, {
  timestamps: true
});

budgetSchema.index({ userId: 1, period: 1, categoryId: 1 });

module.exports = mongoose.model('Budget', budgetSchema);