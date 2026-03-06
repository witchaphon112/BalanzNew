const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LineStrategy = require('passport-line').Strategy;
const jwt = require('jsonwebtoken');
const { User, Transaction, Category, Budget } = require('./models');
const { mergeUsers } = require('./utils/mergeUsers');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
// Load environment variables as early as possible so required modules can read them.
// Use an explicit path so starting the server from the repo root still loads `backend/.env`.
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '.env') });
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories'); // เปลี่ยนจาก Categories
const budgetRoutes = require('./routes/budget'); // แก้ไขการพิมพ์ผิด
const notificationsRouter = require('./routes/notifications');
const ocrRoutes = require('./routes/ocr'); // OCR routes
const aiRoutes = require('./routes/ai'); // OpenAI (slip + transcription)
const lineWebhookRouter = require('./routes/line');
const debugRoutes = require('./routes/debug');
const leaderboardRoutes = require('./routes/leaderboard');
const app = express();

async function findBotPlaceholderCandidate({ displayName, profilePic, excludeUserId } = {}) {
  if (!displayName) return null;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const q = {
    _id: excludeUserId ? { $ne: excludeUserId } : undefined,
    lineUserId: { $exists: false },
    lineMessagingUserId: { $exists: true, $ne: '' },
    name: displayName,
    profilePic: profilePic ? String(profilePic) : undefined,
    email: { $regex: /^line_msg_.*@local$/i },
    createdAt: { $gte: since },
  };
  if (!q._id) delete q._id;
  if (!q.profilePic) delete q.profilePic;

  // Multiple placeholder users with the same displayName can exist (tests / retries).
  // Only auto-select when the choice is unambiguous:
  // - exactly one candidate has any transactions, OR
  // - all have zero tx and there's only one candidate, OR
  // - all have zero tx and the freshest is "very fresh" while the next is clearly older.
  const candidates = await User.find(q).sort({ createdAt: -1 }).limit(10);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const enriched = await Promise.all(candidates.map(async (u) => {
    const [txCount, lastTx] = await Promise.all([
      Transaction.countDocuments({ userId: u._id }).catch(() => 0),
      Transaction.findOne({ userId: u._id })
        .sort({ datetime: -1, createdAt: -1, _id: -1 })
        .select({ datetime: 1, createdAt: 1 })
        .lean()
        .catch(() => null),
    ]);
    const lastAt = lastTx?.datetime || lastTx?.createdAt || null;
    return { u, txCount: Number(txCount) || 0, lastAt: lastAt ? new Date(lastAt) : null };
  }));

  const withTx = enriched.filter((e) => e.txCount > 0);
  if (withTx.length === 1) return withTx[0].u;
  if (withTx.length > 1) {
    // Ambiguous: more than one placeholder account has activity.
    return null;
  }

  // No transactions on any candidate: allow only if it's clearly a fresh, new placeholder.
  const sortedByCreated = [...enriched].sort((a, b) => new Date(b.u.createdAt) - new Date(a.u.createdAt));
  const freshest = sortedByCreated[0];
  const second = sortedByCreated[1];
  const freshestAgeMs = Date.now() - new Date(freshest.u.createdAt).getTime();
  const secondAgeMs = Date.now() - new Date(second.u.createdAt).getTime();
  const veryFresh = freshestAgeMs >= 0 && freshestAgeMs <= 60 * 60 * 1000; // 1 hour
  const secondClearlyOlder = secondAgeMs >= 24 * 60 * 60 * 1000; // 24 hours
  if (veryFresh && secondClearlyOlder) return freshest.u;

  return null;
}

async function countUserData(userId) {
  const [txCount, catCount, budCount] = await Promise.all([
    Transaction.countDocuments({ userId }).catch(() => 0),
    Category.countDocuments({ userId }).catch(() => 0),
    Budget.countDocuments({ userId }).catch(() => 0),
  ]);
  return {
    txCount: Number(txCount) || 0,
    catCount: Number(catCount) || 0,
    budCount: Number(budCount) || 0,
  };
}

async function autoUnifyMessagingUserOnLineLogin({ oauthUser, lineId, displayName, profilePic, email } = {}) {
  if (!oauthUser || !lineId || !displayName) return oauthUser;
  if (oauthUser.lineMessagingUserId) return oauthUser;

  const candidate = await findBotPlaceholderCandidate({ displayName, profilePic, excludeUserId: oauthUser._id });
  if (!candidate) return oauthUser;
  if (candidate.lineUserId) return oauthUser;

  const oauthCounts = await countUserData(oauthUser._id);
  const oauthHasAny = (oauthCounts.txCount + oauthCounts.catCount + oauthCounts.budCount) > 0;

  // If the OAuth user is "empty", prefer the bot-created user as the single canonical record,
  // attach `lineUserId` to it, and delete the empty OAuth user. This keeps transactions on the same _id.
  if (!oauthHasAny) {
    try {
      oauthUser.lineUserId = undefined;
      await oauthUser.save();
    } catch {
      // ignore: we'll still attempt to attach below
    }

    candidate.lineUserId = lineId;
    if (profilePic) candidate.profilePic = profilePic;
    if (email) candidate.email = email;
    try {
      await candidate.save();
      await User.deleteOne({ _id: oauthUser._id }).catch(() => {});
      return candidate;
    } catch (e) {
      if (e && e.code === 11000) {
        const existing = await User.findOne({ lineUserId: lineId });
        if (existing) return existing;
      }
      throw e;
    }
  }

  // Otherwise, merge the bot user into the OAuth user (keep `lineUserId` stable).
  const otherEmail = String(candidate.email || '');
  const safeToDelete =
    !candidate.password &&
    (otherEmail.endsWith('@local') || /^line_/i.test(otherEmail) || /^line_msg_/i.test(otherEmail));
  await mergeUsers({ fromUserId: candidate._id, toUserId: oauthUser._id, deleteSource: safeToDelete });
  return (await User.findById(oauthUser._id)) || oauthUser;
}

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
    const displayName = profile.displayName || '';
    // Prefer linking by lineUserId. If a user with this LINE id exists, use it.
    let user = await User.findOne({ lineUserId: lineId });
    if (user) {
      let updated = false;
      if (profile.displayName && user.name !== profile.displayName) { user.name = profile.displayName; updated = true; }
      if (profilePic && user.profilePic !== profilePic) { user.profilePic = profilePic; updated = true; }
      if (updated) await user.save();
      user = await autoUnifyMessagingUserOnLineLogin({ oauthUser: user, lineId, displayName, profilePic });
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
        user = await autoUnifyMessagingUserOnLineLogin({ oauthUser: user, lineId, displayName, profilePic, email });
        return done(null, user);
      }
    }

    // Heuristic: if the user already used the bot (LINE Messaging API) very recently,
    // there may be a bot-created placeholder user (email like `line_msg_<id>@local`)
    // with the same displayName. Auto-attach the LINE Login `lineUserId` to that record
    // to avoid creating a duplicate web-only user.
    //
    // Safety constraints:
    // - only placeholder bot accounts
    // - must have a Messaging user id
    // - must NOT already have lineUserId
    // - must match displayName exactly
    // - must be created recently
    if (displayName) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const candidates = await User.find({
        lineUserId: { $exists: false },
        lineMessagingUserId: { $exists: true, $ne: '' },
        name: displayName,
        email: { $regex: /^line_msg_.*@local$/i },
        createdAt: { $gte: since },
      }).sort({ createdAt: -1 }).limit(2);

      if (candidates.length === 1) {
        const candidate = candidates[0];
        candidate.lineUserId = lineId;
        if (profilePic) candidate.profilePic = profilePic;
        // Prefer real email from LINE Login if present; otherwise keep placeholder.
        if (email) candidate.email = email;
        try {
          await candidate.save();
          return done(null, candidate);
        } catch (e) {
          // In case of a duplicate-key race, fall back to the now-linked record.
          if (e && e.code === 11000) {
            const existing = await User.findOne({ lineUserId: lineId });
            if (existing) return done(null, existing);
          }
          throw e;
        }
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
      user = await autoUnifyMessagingUserOnLineLogin({ oauthUser: user, lineId, displayName, profilePic, email });
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
          const unified = await autoUnifyMessagingUserOnLineLogin({ oauthUser: existing, lineId, displayName, profilePic, email });
          return done(null, unified);
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
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

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
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
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
app.use('/api/ai', aiRoutes); // OpenAI routes (slip + transcription)
// Serve uploaded files (use absolute path so it works regardless of process cwd)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Dev debug endpoints
app.use('/api/debug', debugRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// LINE Messaging API webhook
app.use('/webhooks/line', lineWebhookRouter);

// Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
