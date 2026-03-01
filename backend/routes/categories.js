const express = require('express');
const jwt = require('jsonwebtoken');
const Category = require('../models/Categories');
const Transaction = require('../models/Transaction');
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
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get categories for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const existingCategories = await Category.find({ userId: req.user.userId });
    const categories = await Category.find({ userId: req.user.userId });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Add category
router.post('/', authMiddleware, async (req, res) => {
  const { name, icon, type } = req.body;
  if (!type || !['income', 'expense'].includes(type)) {
    return res.status(400).json({ message: 'ประเภทต้องเป็น "income" หรือ "expense"' });
  }
  try {
    const existingCategory = await Category.findOne({ name, userId: req.user.userId, type });
    if (existingCategory) {
      return res.status(400).json({ message: 'หมวดหมู่นี้มีอยู่แล้วในประเภทนี้' });
    }
    const category = new Category({
      name,
      icon: icon || '🌐',
      type,
      userId: req.user.userId,
    });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Delete category
router.delete('/:categoryId', authMiddleware, async (req, res) => {
  const { categoryId } = req.params;
  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่ในระบบ' });
    }

    if (category.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ลบหมวดหมู่นี้' });
    }

    if ((category.name || '').trim() === 'อื่นๆ') {
      return res.status(400).json({ message: 'ไม่สามารถลบหมวด "อื่นๆ" ได้' });
    }

    let otherCategory = await Category.findOne({ name: 'อื่นๆ', type: category.type, userId: req.user.userId });
    if (!otherCategory) {
      otherCategory = new Category({
        name: 'อื่นๆ',
        icon: '🌐',
        type: category.type,
        userId: req.user.userId,
      });
      await otherCategory.save();
    }

    // Re-assign related transactions to "อื่นๆ" before deleting the category
    await Transaction.updateMany(
      { categoryId: category._id, userId: req.user.userId },
      { categoryId: otherCategory._id }
    );

    await Category.deleteOne({ _id: categoryId });

    res.json({ message: 'ลบหมวดหมู่เรียบร้อย', deletedId: categoryId, reassignedTo: otherCategory._id });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;
