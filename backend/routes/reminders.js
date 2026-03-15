const express = require('express');
const jwt = require('jsonwebtoken');
const { ReminderSetting, User } = require('../models');

const router = express.Router();

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.exp) return res.status(401).json({ message: 'Token expired' });
    req.user = decoded;
    next();
  } catch (error) {
    if (error && error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired' });
    return res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [setting, user] = await Promise.all([
      ReminderSetting.findOne({ userId }).lean(),
      User.findById(userId).select({ lineMessagingUserId: 1 }).lean(),
    ]);
    const enabled = Boolean(setting?.enabled);
    const time = String(setting?.timeHHMM || '08:00');
    const canPush = Boolean(String(user?.lineMessagingUserId || '').trim());
    res.json({ enabled, time, canPush });
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + (err?.message || 'Unknown error') });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const enabled = Boolean(req.body?.enabled);
    const time = String(req.body?.time || '').trim() || '08:00';
    if (!TIME_RE.test(time)) return res.status(400).json({ message: 'Invalid time. Expected HH:MM' });

    const setting = await ReminderSetting.findOneAndUpdate(
      { userId },
      { $set: { enabled, timeHHMM: time } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const user = await User.findById(userId).select({ lineMessagingUserId: 1 }).lean();
    const canPush = Boolean(String(user?.lineMessagingUserId || '').trim());

    res.json({
      ok: true,
      enabled: Boolean(setting?.enabled),
      time: String(setting?.timeHHMM || time),
      canPush,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + (err?.message || 'Unknown error') });
  }
});

module.exports = router;
