const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

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
    const user = await User.findById(userId).select({ lineMessagingUserId: 1, lineBudgetAlertsEnabled: 1 }).lean();
    const canPush = Boolean(String(user?.lineMessagingUserId || '').trim());
    const budgetOverLineEnabled = user?.lineBudgetAlertsEnabled !== false;
    res.json({ budgetOverLineEnabled, canPush });
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + (err?.message || 'Unknown error') });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const budgetOverLineEnabled = Boolean(req.body?.budgetOverLineEnabled);

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { lineBudgetAlertsEnabled: budgetOverLineEnabled } },
      { new: true }
    ).select({ lineMessagingUserId: 1, lineBudgetAlertsEnabled: 1 }).lean();

    const canPush = Boolean(String(user?.lineMessagingUserId || '').trim());
    res.json({ ok: true, budgetOverLineEnabled: user?.lineBudgetAlertsEnabled !== false, canPush });
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + (err?.message || 'Unknown error') });
  }
});

module.exports = router;

