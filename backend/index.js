const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories'); // เปลี่ยนจาก Categories
const budgetRoutes = require('./routes/budget'); // แก้ไขการพิมพ์ผิด
const notificationsRouter = require('./routes/notifications');

dotenv.config();
const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes); // เปลี่ยนจาก Categories
app.use('/api/budgets', budgetRoutes); // แก้ไขการพิมพ์ผิด
app.use('/api', notificationsRouter); // ใช้ /api/notifications

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));