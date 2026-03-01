const express = require('express');
const line = require('@line/bot-sdk');
const router = express.Router();
const { User, Transaction, Category, ImportExportLog, LineLoginSession } = require('../models');
const jwt = require('jsonwebtoken');

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'db5bf415547cac649f72a92d111ea700';
let CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const SESSION_TTL_MS = 10 * 60 * 1000;

// Create LINE client if token exists; otherwise provide a safe no-op client to avoid startup crash
let client;
function ensureClient() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  if (!token) {
    CHANNEL_TOKEN = '';
    client = {
      replyMessage: async (replyToken, message) => {
        console.log('LINE reply skipped (no CHANNEL_TOKEN). Reply would be:', replyToken, message);
      },
      getProfile: async (userId) => {
        throw new Error('LINE CHANNEL_TOKEN not configured');
      }
    };
    return;
  }
  // recreate client if token changed or client not yet created
  if (!client || CHANNEL_TOKEN !== token) {
    CHANNEL_TOKEN = token;
    client = new line.Client({ channelAccessToken: CHANNEL_TOKEN, channelSecret: CHANNEL_SECRET });
    console.log('LINE client initialized/reinitialized.');
  }
}
// initialize once
ensureClient();

// wrapper to log reply results/errors
async function sendReply(replyToken, message) {
  try {
    ensureClient();
    const r = await client.replyMessage(replyToken, message);
    console.log('LINE reply success', replyToken, message);
    return r;
  } catch (e) {
    const detail =
      e?.originalError?.response?.data ||
      e?.response?.data ||
      e?.originalError?.response ||
      e?.response ||
      null;
    console.error('LINE reply error', detail || e);
    return null;
  }
}

// debug: show whether token was loaded when this module initialized
console.log('LINE webhook module loaded. CHANNEL_TOKEN present:', CHANNEL_TOKEN ? (CHANNEL_TOKEN.slice(0,8) + '...') : 'no');

// simple parser: returns { type: 'income'|'expense', amount, note }
function parseTransactionText(text) {
  const t = text.trim();
  // commands: help, สรุปวันนี้, สรุปเดือนนี้, export
  if (/^help$/i.test(t) || /^ช่วยเหลือ$/i.test(t)) return { command: 'help' };
  if (/^สรุปวันนี้$/i.test(t)) return { command: 'summary_today' };
  if (/^สรุปเดือนนี้$/i.test(t)) return { command: 'summary_month' };
  if (/^export(\s+.*)?$/i.test(t)) return { command: 'export' };
  if (/^\s*จด(รายการ(บันทึก)?)\s*$/i.test(t)) return { command: 'quick_note' };
  if (/^\s*จด\s*$/i.test(t)) return { command: 'quick_note' };

  // transaction: จ่าย 120 ข้าวมันไก่  OR  รับ 500 เงินลูกค้า
  const m = t.match(/^(จ่าย|จ่่าย|จ|จ\.?)\s*([0-9,\.]+)\s*(.*)$/i) || t.match(/^(รับ|เรีัย|ร)\s*([0-9,\.]+)\s*(.*)$/i);
  if (m) {
    const verb = m[1];
    const amountStr = m[2];
    const note = (m[3] || '').trim();
    const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
    const type = /^(รับ|r|เรีัย|ร)$/i.test(verb) ? 'income' : 'expense';
    return { type, amount, note };
  }

  // fallback: try to extract numbers
  const mm = t.match(/([0-9,\.]+)\s*(บาท|฿)?/);
  if (mm) {
    const amount = parseFloat(mm[1].replace(/,/g, '')) || 0;
    return { type: 'expense', amount, note: t };
  }

  return { command: 'unknown' };
}

async function handleTextEvent(event) {
  const rawText = (event.message && event.message.text) ? event.message.text : '';
  // normalize: remove invisible/zero-width characters and soft-hyphens, then trim
  const text = rawText.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').trim();
  const parsed = parseTransactionText(text);
  const userId = event.source && event.source.userId;

  // Diagnostic logging to help debug why some inputs fall through to unknown
  try {
    // Log a compact representation of the event for debugging real webhook payloads
    try {
      const shortEvent = {
        type: event.type,
        messageType: event.message && event.message.type,
        messageText: event.message && event.message.text,
        userId: event.source && event.source.userId,
        replyToken: event.replyToken ? 'present' : 'missing'
      };
      console.log('LINE full event:', JSON.stringify(shortEvent));
    } catch (e) {
      // continue
    }
    console.log('LINE incoming rawText:', rawText);
    console.log('LINE cleaned text:', text);
    console.log('LINE parsed:', parsed);
    console.log('LINE event.userId:', userId, 'replyToken:', event.replyToken ? 'present' : 'missing');
  } catch (e) {
    // ignore logging errors
  }

  // Quick UI trigger: when user types a phrase starting with 'จดรายการ' or 'จดรายการบันทึก',
  // reply with a Flex bubble + button. Match more flexibly to allow extra words after the phrase.
  const isFlexTrigger = /^\s*จด(รายการ(บันทึก)?)?(\b|\s|$)/i.test(text) || /^\s*จด/i.test(text);
  console.log('LINE flex trigger test:', isFlexTrigger);
  if (isFlexTrigger) {
    const flexMessage = {
      type: 'flex',
      altText: 'จดเลย',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: 'พิมพ์บอกน้องจิ๋วได้เลย เช่น', weight: 'bold', size: 'md' },
            { type: 'text', text: '- ข้าวมันไก่ 50\n- เงินเดือน 20000', wrap: true, margin: 'sm' }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#87bfe3',
              action: { type: 'uri', label: 'จดเลย', uri: 'line://msg/text/' }
            }
          ]
        }
      }
    };
    console.log('LINE flex trigger matched, sending flex message.');
    return sendReply(event.replyToken, flexMessage);
  }

  // If user taps the 'จดเลย' button (sends message 'จดเลย'), prompt for example input
  const isJodLey = /^\s*จดเลย\s*$/i.test(text);
  console.log('LINE "จดเลย" trigger:', isJodLey);
  if (isJodLey) {
    const prompt = 'พิมพ์บอกป้่าได้เลย เช่น\n- ข้าวมันไก่ 50\n- เงินเดือน 20000\nผมจะจดและจัดประเภทให้อัตโนมัติ';
    return sendReply(event.replyToken, { type: 'text', text: prompt });
  }

  // If user types 'ประกาศ', send a quick-reply URI that opens the LINE profile when tapped.
  // NOTE: the server cannot force the client to open a link automatically — user must tap the quick-reply button.
  const isAnnounce = /^\s*ประกาศ\s*$/i.test(text);
  if (isAnnounce) {
    // Send a Buttons template which shows a clear tappable button to open the profile/VOOM URL.
    // Template buttons are more visible than quickReply and reliably surface a URI action.
    const profileUrl = 'https://line.me/R/ti/p/@156twxxb';
    const message = {
      type: 'template',
      altText: 'ดูโปรไฟล์ LINE',
      template: {
        type: 'buttons',
        text: 'แตะปุ่มด้านล่างเพื่อเปิดหน้าโปรไฟล์/VOOM',
        actions: [
          { type: 'uri', label: 'ดูโปรไฟล์', uri: profileUrl }
        ]
      }
    };
    return sendReply(event.replyToken, message);
  }

  if (!userId) {
    // cannot map to user
    return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบ userId จาก LINE' });
  }

  const oauthEmail = `${userId}@line.local`;
  const [userByLineId, userByOAuthEmail] = await Promise.all([
    User.findOne({ lineUserId: userId }),
    User.findOne({ email: oauthEmail }),
  ]);

  // Prefer the LINE OAuth account (email "<lineUserId>@line.local") if it exists,
  // to keep the web-login user and LINE-bot user consistent.
  let user = userByOAuthEmail || userByLineId;

  if (userByOAuthEmail && userByLineId && String(userByOAuthEmail._id) !== String(userByLineId._id)) {
    console.warn('LINE user mapping mismatch: both userByLineId and userByOAuthEmail exist. Preferring OAuth user.', {
      lineUserId: userId,
      userByLineId: String(userByLineId._id),
      userByOAuthEmail: String(userByOAuthEmail._id),
    });
    // Try to attach lineUserId to the OAuth user and detach from the older record if needed.
    try {
      if (!userByOAuthEmail.lineUserId) {
        userByOAuthEmail.lineUserId = String(userId);
        await userByOAuthEmail.save();
      }
      if (userByLineId.lineUserId && String(userByLineId.lineUserId) === String(userId) && String(userByLineId._id) !== String(userByOAuthEmail._id)) {
        userByLineId.lineUserId = undefined;
        await userByLineId.save();
      }
    } catch (e) {
      // If unique index isn't enforced yet or save fails, continue with the OAuth user anyway.
    }
  } else if (user && !user.lineUserId) {
    // If user was found by oauthEmail, attach lineUserId for faster lookups.
    try {
      user.lineUserId = String(userId);
      await user.save();
    } catch {
      // ignore
    }
  }

  if (!user) {
    // Try to upsert user; if unique index on email causes E11000 (existing null email),
    // fall back to creating a user with a placeholder email to avoid duplicate-null collisions.
    let profile = null;
    try {
      profile = await client.getProfile(userId);
    } catch (e) {
      // profile fetch may fail if CHANNEL_TOKEN not configured or permission denied - continue
    }
    // Avoid upsert via findOneAndUpdate because a legacy unique index on `email` (with nulls)
    // can cause E11000 on upsert. Instead, attempt an atomic create with a placeholder
    // unique email (based on the LINE userId), then fall back to find.
    try {
      user = await User.findOne({ lineUserId: userId });
      if (!user) {
        // Use the same email convention as LINE OAuth login to keep a single account.
        const placeholderEmail = oauthEmail;
        try {
          user = await User.create({ lineUserId: userId, name: (profile && profile.displayName) ? profile.displayName : '', profilePic: (profile && profile.pictureUrl) ? profile.pictureUrl : '', email: placeholderEmail });
        } catch (createErr) {
          if (createErr && createErr.code === 11000) {
            // race: another process created a user with the same placeholder or a null-email collision
            user = await User.findOne({ lineUserId: userId });
          } else {
            console.error('Failed to create user', createErr);
            throw createErr;
          }
        }
      }
    } catch (finalErr) {
      console.error('user creation/upsert final error', finalErr);
      throw finalErr;
    }
  }

  console.log('LINE resolved user mapping:', {
    lineUserId: String(userId || ''),
    userByLineId: userByLineId ? String(userByLineId._id) : null,
    userByOAuthEmail: userByOAuthEmail ? String(userByOAuthEmail._id) : null,
    selectedUserId: user ? String(user._id) : null,
    selectedEmail: user?.email || null,
  });

  // Quick debug command: show which backend user this LINE account maps to.
  const isWhoAmI = /^\s*(whoami|บัญชี|account)\s*$/i.test(text);
  if (isWhoAmI) {
    return sendReply(event.replyToken, {
      type: 'text',
      text: `บัญชีที่ผูกกับ LINE นี้\nuserId: ${String(user?._id || '-')}\nemail: ${String(user?.email || '-')}`,
    });
  }

  // Send a one-tap link to open the web dashboard as the same LINE user
  // (useful when the user is logged in on the web with a different account).
  const isWebLogin = /^\s*(เข้าเว็บ|เว็บ|dashboard|login)\s*$/i.test(text);
  if (isWebLogin) {
    const backendBase = process.env.BACKEND_URL || 'http://localhost:5050';
    const rawToken = createSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await LineLoginSession.create({
        tokenHash,
        userId: user._id,
        lineUserId: String(userId),
        expiresAt,
      });
    } catch (e) {
      console.error('LineLoginSession create failed', e);
      return sendReply(event.replyToken, { type: 'text', text: 'ขออภัย ระบบสร้างลิงก์เข้าเว็บไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }

    const redirectUrl = `${backendBase}/webhooks/line/session-login?token=${encodeURIComponent(rawToken)}`;
    return sendReply(event.replyToken, {
      type: 'text',
      text: `แตะลิงก์นี้เพื่อเข้าเว็บด้วยบัญชีเดียวกับ LINE (ลิงก์หมดอายุใน 10 นาที)\n${redirectUrl}`,
    });
  }

  if (parsed.command === 'help') {
    const helpText = 'คำสั่งตัวอย่าง:\n- จ่าย 120 ข้าวมันไก่\n- รับ 500 เงินลูกค้า\n- สรุปวันนี้\n- สรุปเดือนนี้\n- export';
    return sendReply(event.replyToken, { type: 'text', text: helpText });
  }

  if (parsed.command === 'summary_today') {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const txs = await Transaction.find({ userId: user._id, datetime: { $gte: start, $lte: end } });
    const income = txs.filter(t=>t.type==='income').reduce((s,n)=>s+n.amount,0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,n)=>s+n.amount,0);
    const reply = `สรุปวันนี้\nรายรับ: ${income}\nรายจ่าย: ${expense}\nรายการ: ${txs.length}`;
    return sendReply(event.replyToken, { type: 'text', text: reply });
  }

  if (parsed.command === 'summary_month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
    const txs = await Transaction.find({ userId: user._id, datetime: { $gte: start, $lte: end } });
    const income = txs.filter(t=>t.type==='income').reduce((s,n)=>s+n.amount,0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,n)=>s+n.amount,0);
    const reply = `สรุปเดือนนี้\nรายรับ: ${income}\nรายจ่าย: ${expense}\nรายการ: ${txs.length}`;
    return sendReply(event.replyToken, { type: 'text', text: reply });
  }

  if (parsed.command === 'export') {
    // create a log entry and reply (actual file generation can be implemented separately)
    await ImportExportLog.create({ userId: user._id, type: 'export', status: 'done', range: 'auto', meta: { triggerText: text } });
    return sendReply(event.replyToken, { type: 'text', text: 'กำลังสร้างไฟล์ export ให้ คุณจะได้รับลิงก์เมื่อพร้อม (feature ระยะถัดไป)' });
  }

  if (parsed.type && parsed.amount) {
    console.log('Parsed transaction:', parsed);
    console.log('LINE will save transaction for user _id:', String(user?._id || ''), 'lineUserId:', String(userId || ''));
    // ensure we save note into the same field existing docs use (`notes`) and keep `note` for compatibility
    const notesText = parsed.note || parsed.notes || '';
    // save transaction
    const tx = new Transaction({
      userId: user._id,
      type: parsed.type,
      amount: parsed.amount,
      notes: notesText,
      note: notesText,
      categoryId: null,
      datetime: new Date(),
      source: 'text',
      rawMessage: event
    });
    await tx.save();
    const summary = `${parsed.type === 'expense' ? 'จ่าย' : 'รับ'} ${parsed.amount} ${parsed.note || ''}`.trim();
    const when = new Date().toLocaleString();
    const baseReply = `บันทึกเรียบร้อย: ${summary}\nได้รับยอด ${parsed.amount} บาท สำหรับ: ${parsed.note || '-'}\nบันทึกเมื่อ: ${when}`;
    const replyText = `${baseReply} (test)`;
    return sendReply(event.replyToken, { type: 'text', text: replyText });
  }

  // unknown
  return sendReply(event.replyToken, { type: 'text', text: 'ขอโทษครับ ผมไม่เข้าใจคำสั่ง พิมพ์ help เพื่อดูคำสั่งตัวอย่าง' });
}

// handle postback events (from richmenu postback actions)
async function handlePostbackEvent(event) {
  const userId = event.source && event.source.userId;
  const data = event.postback && event.postback.data ? event.postback.data : '';
  console.log('LINE postback received', { userId, data });
  if (!userId) return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบ userId' });

  // if postback is a quick-note trigger, reply with the flex quick-note UI (no user message shown)
  try {
    const rawData = String(data || '');
    console.log('postback raw data:', rawData);
    const params = new URLSearchParams(rawData);
    const action = (params.get('action') || '').trim().toLowerCase();
    const isQuickNote = action === 'quick_note' || rawData.trim().toLowerCase() === 'action=quick_note' || rawData.toLowerCase().includes('action=quick_note');
    if (isQuickNote) {
      const flexMessage = {
        type: 'flex',
        altText: 'จดเลย',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              { type: 'text', text: 'พิมพ์บอกน้องจิ๋วได้เลย เช่น', weight: 'bold', size: 'md' },
              { type: 'text', text: '- ข้าวมันไก่ 50\n- เงินเดือน 20000', wrap: true, margin: 'sm' }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#87bfe3',
                action: { type: 'uri', label: 'จดเลย', uri: 'line://msg/text/' }
              }
            ]
          }
        }
      };
      return sendReply(event.replyToken, flexMessage);
    }
  } catch (e) {
    console.warn('postback quick_note parse error', e, 'data=', data);
  }
  // determine action value (robust parsing)
  let actionValue = '';
  try {
    const rawData2 = String(data || '');
    actionValue = (new URLSearchParams(rawData2).get('action') || '').trim().toLowerCase();
  } catch (e) {
    actionValue = String(data || '').trim().toLowerCase();
  }
  console.log('postback actionValue resolved:', actionValue);

  // find user
  const user = await User.findOne({ lineUserId: userId });
  if (!user) {
    return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบบัญชีผู้ใช้ที่เชื่อมกับ LINE ของคุณ โปรดล็อกอินผ่านหน้าเว็บก่อน' });
  }

  // handle known postback actions
  // Be strict when detecting the dashboard action to avoid accidental substring matches
  if (actionValue === 'dashboard' || actionValue === 'open_dashboard' || actionValue === 'open-dashboard') {
    // create JWT for quick-login and reply with dashboard button
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
    const token = jwt.sign({ userId: user._id, role: user.role || 'user' }, secret, { expiresIn: '1h' });
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const dashboardUrl = `${frontend}/dashboard?token=${token}`;
    const message = {
      type: 'template',
      altText: 'เปิดหน้า Dashboard',
      template: {
        type: 'buttons',
        text: 'คลิกปุ่มด้านล่างเพื่อไปที่หน้า Dashboard (ล็อกอินเรียบร้อย)',
        actions: [
          { type: 'uri', label: 'เปิด Dashboard', uri: dashboardUrl }
        ]
      }
    };
    return sendReply(event.replyToken, message);
  }

  if (actionValue === 'summary') {
    // reply with today's summary (same behavior as text command)
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const txs = await Transaction.find({ userId: user._id, datetime: { $gte: start, $lte: end } });
    const income = txs.filter(t=>t.type==='income').reduce((s,n)=>s+n.amount,0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,n)=>s+n.amount,0);
    const reply = `สรุปวันนี้\nรายรับ: ${income}\nรายจ่าย: ${expense}\nรายการ: ${txs.length}`;
    return sendReply(event.replyToken, { type: 'text', text: reply });
  }

  // unknown/unsupported postback: respond minimally for debugging
  console.log('Unhandled postback action:', actionValue, 'raw data:', data);
  return sendReply(event.replyToken, { type: 'text', text: `ไม่รองรับการกระทำ: ${actionValue || data}` });
}

// Redirect endpoint for rich menu URI action - generates JWT and redirects to dashboard
// Usage: /line/dashboard-redirect?uid=<signed_userId>
router.get('/dashboard-redirect', async (req, res) => {
  try {
    const signedUid = req.query.uid;
    if (!signedUid) return res.status(400).send('Missing uid parameter');

    // decode base64 signed userId (simple obfuscation - use proper signing in production)
    let userId;
    try {
      userId = Buffer.from(signedUid, 'base64').toString('utf8');
    } catch (e) {
      return res.status(400).send('Invalid uid parameter');
    }

    // find user by LINE userId
    const user = await User.findOne({ lineUserId: userId });
    if (!user) {
      const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontend}/login?error=user_not_found`);
    }

    // generate JWT
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
    const token = jwt.sign({ userId: user._id, role: user.role || 'user' }, secret, { expiresIn: '7d' });
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const dashboardUrl = `${frontend}/dashboard?token=${token}`;

    // redirect to dashboard
    res.redirect(dashboardUrl);
  } catch (err) {
    console.error('dashboard-redirect error', err);
    res.status(500).send('Internal error');
  }
});

// signature verification middleware (safe for local testing)
const crypto = require('crypto');

function createSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

function hashSessionToken(token) {
  const secret = process.env.SESSION_TOKEN_SECRET || process.env.JWT_SECRET || CHANNEL_SECRET || 'dev-session-secret';
  return crypto.createHmac('sha256', String(secret)).update(String(token)).digest('hex');
}

function verifySignature(req, res, next) {
  if (!CHANNEL_SECRET) return next();
  const signature = req.get('x-line-signature');
  if (!signature) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('No X-Line-Signature header — allowing in non-production for testing');
      return next();
    }
    return res.status(400).send('no signature');
  }
  const raw = req.rawBody || '';
  const hash = crypto.createHmac('sha256', CHANNEL_SECRET).update(raw).digest('base64');
  if (hash !== signature) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Invalid X-Line-Signature — allowing in non-production for testing');
      return next();
    }
    return res.status(401).send('invalid signature');
  }
  return next();
}

// richmenu upload helpers
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const richUploadDir = path.join(__dirname, '../uploads/richmenu');
try { fs.mkdirSync(richUploadDir, { recursive: true }); } catch (e) { /* ignore */ }
const upload = multer({ dest: richUploadDir });

// Health endpoint for debugging config (do not expose secrets)
router.get('/health', (req, res) => {
  const hasToken = Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
  const hasSecret = Boolean(process.env.LINE_CHANNEL_SECRET);
  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    channelToken: hasToken ? 'present' : 'missing',
    channelSecret: hasSecret ? 'present' : 'missing',
    webhookPath: '/webhooks/line',
  });
});

// One-time session login redirect (created from LINE chat)
// Usage: /webhooks/line/session-login?token=<one-time-token>
router.get('/session-login', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) return res.status(400).send('Missing token');

    const tokenHash = hashSessionToken(token);
    const session = await LineLoginSession.findOne({ tokenHash });
    if (!session) return res.status(404).send('Session not found');
    if (session.usedAt) return res.status(410).send('Session already used');
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) return res.status(410).send('Session expired');

    session.usedAt = new Date();
    await session.save();

    const user = await User.findById(session.userId);
    if (!user) return res.status(404).send('User not found');

    const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
    const jwtToken = jwt.sign({ userId: user._id, role: user.role || 'user' }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const profilePic = encodeURIComponent(user.profilePic || '');
    return res.redirect(`${frontend}/dashboard?token=${encodeURIComponent(jwtToken)}&profilePic=${profilePic}`);
  } catch (err) {
    console.error('session-login error', err);
    return res.status(500).send('Internal error');
  }
});

router.post('/', verifySignature, async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(async (ev) => {
      try {
        if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
          await handleTextEvent(ev);
        } else if (ev.type === 'postback') {
          await handlePostbackEvent(ev);
        } else {
          // ignore other events for now
        }
      } catch (err) {
        console.error('handle event error', err);
      }
    }));
    res.status(200).send('OK');
  } catch (err) {
    console.error('webhook error', err);
    res.status(500).send('error');
  }
});

// Create a rich menu and upload an image. Accepts multipart/form-data with field `image`.
// Optional form fields:
// - chatBarText: string
// - name: string
// - areas: JSON string representing the areas array (optional)
// - setDefault: '1'|'true' to set as default rich menu
// - userId: line userId to link this richmenu to
router.post('/richmenu/create', upload.single('image'), async (req, res) => {
  try {
    ensureClient();
    if (!CHANNEL_TOKEN) return res.status(500).json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' });

    // log incoming request fields for debugging
    console.log('richmenu/create request body:', Object.keys(req.body).reduce((o,k)=>{ o[k]=req.body[k]; return o; },{}));
    console.log('richmenu/create file:', req.file ? { originalname: req.file.originalname, path: req.file.path, size: req.file.size } : null);

    const chatBarText = req.body.chatBarText || 'เมนู';
    const name = req.body.name || 'custom-richmenu';
    let areas = [];
    if (req.body.areas) {
      try { areas = JSON.parse(req.body.areas); } catch (e) { areas = []; }
    }

    // default size for single image rich menu (adjustable)
    const richMenuObject = {
      size: { width: 2500, height: 1686 },
      selected: false,
      name: name,
      chatBarText: chatBarText,
      areas: areas
    };

    let richMenuId;
    try {
      richMenuId = await client.createRichMenu(richMenuObject);
      console.log('richmenu created id=', richMenuId);
    } catch (createErr) {
      console.error('createRichMenu failed', createErr && createErr.response ? createErr.response.data : createErr);
      throw createErr;
    }

    // upload image if provided (resize to LINE required size first)
    if (req.file && req.file.path) {
      const filePath = req.file.path;
      try {
        // try to resize to LINE richmenu size (2500x1686)
        try {
          const buf = await sharp(filePath).resize(2500, 1686, { fit: 'cover' }).toBuffer();
          console.log('resized image buffer length', buf.length);
          await client.setRichMenuImage(richMenuId, buf);
          console.log('setRichMenuImage succeeded');
        } catch (resizeErr) {
          console.warn('sharp resize failed or upload failed, trying original image as fallback', resizeErr && (resizeErr.response ? resizeErr.response.data : resizeErr));
          await client.setRichMenuImage(richMenuId, fs.createReadStream(filePath));
          console.log('setRichMenuImage succeeded with original file');
        }
      } finally {
        // remove temp file
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
    }

    // set default if requested (non-fatal)
    const warnings = [];
    if (req.body.setDefault === '1' || String(req.body.setDefault).toLowerCase() === 'true') {
      try {
        await client.setDefaultRichMenu(richMenuId);
      } catch (e) {
        console.error('setDefaultRichMenu failed', e && e.response ? e.response.data : e);
        warnings.push({ op: 'setDefault', error: (e && e.response && e.response.data) ? e.response.data : (e && e.message) });
      }
    }

    // link to a specific user if provided (non-fatal)
    if (req.body.userId) {
      try {
        await client.linkRichMenuToUser(req.body.userId, richMenuId);
      } catch (e) {
        console.error('linkRichMenuToUser failed', e && e.response ? e.response.data : e);
        warnings.push({ op: 'linkUser', userId: req.body.userId, error: (e && e.response && e.response.data) ? e.response.data : (e && e.message) });
      }
    }

    res.json({ success: true, richMenuId, warnings });
  } catch (err) {
    // if LINE SDK / axios returned a response body, include it for debugging
    try {
      console.error('richmenu create error', err && err.response ? err.response.data : err);
    } catch (e) {
      console.error('richmenu create error', err);
    }
    const responseError = (err && err.response && err.response.data) ? err.response.data : (err && err.message ? err.message : 'error');
    const status = (err && err.response && err.response.status) ? err.response.status : 500;
    return res.status(status).json({ error: responseError });
  }
});

module.exports = router;
