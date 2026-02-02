const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: false },
  password: { type: String },
  name: { type: String, default: '' },
  profilePic: { type: String, default: '' }, // LINE profile picture URL
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  lineUserId: { type: String }, // LINE user id for OA
  timezone: { type: String, default: 'Asia/Bangkok' },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, {
  timestamps: true
});

userSchema.index({ lineUserId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);