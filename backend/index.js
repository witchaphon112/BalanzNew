const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LineStrategy = require('passport-line').Strategy;
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
// Load environment variables as early as possible so required modules can read them
dotenv.config();
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories'); // เปลี่ยนจาก Categories
const budgetRoutes = require('./routes/budget'); // แก้ไขการพิมพ์ผิด
const notificationsRouter = require('./routes/notifications');
const ocrRoutes = require('./routes/ocr'); // OCR routes
const lineWebhookRouter = require('./routes/line');
const app = express();
// LINE Login configuration
passport.use(new LineStrategy({
  channelID: '2008748910',
  channelSecret: '36ca849ef6db52fdf5126b41a03c6ef4',
  callbackURL: 'http://localhost:5050/callback',
  scope: ['profile', 'openid', 'email']
}, async (accessToken, refreshToken, params, profile, done) => {
  try {
    // LINE profile: profile.id, profile.displayName, profile.emails
    const lineId = profile.id;
    const profilePic = profile._json && profile._json.pictureUrl ? profile._json.pictureUrl : '';
    // Prefer linking by lineUserId. If a user with this LINE id exists, use it.
    let user = await User.findOne({ lineUserId: lineId });
    if (user) {
      let updated = false;
      if (profile.displayName && user.name !== profile.displayName) { user.name = profile.displayName; updated = true; }
      if (profilePic && user.profilePic !== profilePic) { user.profilePic = profilePic; updated = true; }
      if (updated) await user.save();
      return done(null, user);
    }

    // Otherwise, try to find by email if available and attach lineUserId
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      user = await User.findOne({ email });
      if (user) {
        user.lineUserId = lineId;
        if (profile.displayName) user.name = profile.displayName;
        if (profilePic) user.profilePic = profilePic;
        await user.save();
        return done(null, user);
      }
    }

    // Fallback: create a new user and set lineUserId
    const newEmail = email || `${lineId}@line.local`;
    user = new User({
      email: newEmail,
      password: '',
      name: profile.displayName || '',
      profilePic,
      role: 'user',
      lineUserId: lineId
    });
    try {
      await user.save();
      return done(null, user);
    } catch (e) {
      // Handle race or duplicate key on email: attach lineUserId to existing user
      if (e && e.code === 11000) {
        const existing = await User.findOne({ email: newEmail });
        if (existing) {
          existing.lineUserId = lineId;
          if (profile.displayName) existing.name = profile.displayName;
          if (profilePic) existing.profilePic = profilePic;
          await existing.save();
          return done(null, existing);
        }
      }
      throw e;
    }
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});
// Middleware - Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Preserve raw body for LINE signature verification middleware
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString(); } }));

// Session and Passport middleware
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(passport.initialize());
app.use(passport.session());

// LINE Login routes
app.get('/auth/line', passport.authenticate('line'));
app.get('/callback', passport.authenticate('line', {
  failureRedirect: '/login',
  session: true
}), (req, res) => {
  // Successful authentication
  // Generate JWT token for the user
  const user = req.user;
  const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET);
  // Redirect to frontend with token and profilePic as query params
  const profilePic = encodeURIComponent(user.profilePic || '');
  res.redirect(`http://localhost:3000/dashboard?token=${token}&profilePic=${profilePic}`);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes); // เปลี่ยนจาก Categories
app.use('/api/budgets', budgetRoutes); // แก้ไขการพิมพ์ผิด
app.use('/api', notificationsRouter); // ใช้ /api/notifications
app.use('/api/ocr', ocrRoutes); // OCR routes
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// LINE Messaging API webhook
app.use('/webhooks/line', lineWebhookRouter);

// Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));