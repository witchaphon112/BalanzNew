const express = require('express');
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');
const Category = require('../models/Categories'); // เพิ่มการ import
const mongoose = require('mongoose');
const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.post('/', authMiddleware, async (req, res) => {
  const { amount, type, category, date, notes } = req.body;
  console.log('Received data:', { amount, type, category, date, notes });
  try {
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either income or expense' });
    }

    let categoryId;
    if (mongoose.Types.ObjectId.isValid(category)) {
      categoryId = new mongoose.Types.ObjectId(category);
    } else {
      const foundCategory = await Category.findOne({ name: category, userId: req.user.userId });
      if (!foundCategory) {
        return res.status(400).json({ message: 'Category not found' });
      }
      categoryId = foundCategory._id;
    }

    let transactionDate;
    if (date.includes('T')) {
      transactionDate = new Date(date);
    } else {
      transactionDate = new Date(`${date}T00:00:00.000+07:00`);
    }

    if (isNaN(transactionDate.getTime())) {
      return res.status(400).json({ message: `Invalid date format: ${date}` });
    }

    const transaction = new Transaction({
      userId: req.user.userId,
      amount: parseFloat(amount),
      type,
      category: categoryId,
      date: transactionDate,
      notes,
    });
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.userId })
      .populate('category', 'name icon');
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;