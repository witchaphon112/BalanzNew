const express = require('express');
const line = require('@line/bot-sdk');
const router = express.Router();
const { User, Transaction, Category, ImportExportLog, LineLoginSession, LineMessagingLinkSession } = require('../models');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { scanImageFile } = require('../utils/ocrScan');
const { transcribeAudioFile } = require('../utils/transcribeAudio');

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'db5bf415547cac649f72a92d111ea700';
let CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const SESSION_TTL_MS = 10 * 60 * 1000;
const LINK_TTL_MS = 10 * 60 * 1000;

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
      pushMessage: async (userId, message) => {
        console.log('LINE push skipped (no CHANNEL_TOKEN). Push would be:', userId, message);
      },
      getMessageContent: async () => {
        throw new Error('LINE CHANNEL_TOKEN not configured');
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

async function pushToUser(userId, message) {
  try {
    ensureClient();
    const r = await client.pushMessage(userId, message);
    console.log('LINE push success', userId, message);
    return r;
  } catch (e) {
    const detail =
      e?.originalError?.response?.data ||
      e?.response?.data ||
      e?.originalError?.response ||
      e?.response ||
      null;
    console.error('LINE push error', detail || e);
    return null;
  }
}

// debug: show whether token was loaded when this module initialized
console.log('LINE webhook module loaded. CHANNEL_TOKEN present:', CHANNEL_TOKEN ? (CHANNEL_TOKEN.slice(0,8) + '...') : 'no');

// simple parser: returns { type: 'income'|'expense', amount, note }
function parseTransactionText(text) {
  const normalizeDigits = (s) => String(s || '').replace(/[๐-๙]/g, (ch) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)));
  const t = normalizeDigits(text).trim();
  const tl = t.toLowerCase();
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

  // Income keyword inference for inputs like: "เงินเดือน 20000", "โบนัส 5000"
  const incomeKeywords = [
    'เงินเดือน', 'โบนัส', 'รายได้', 'รายรับ', 'ค่าคอม', 'คอมมิชชั่น',
    'commission', 'salary', 'bonus', 'income',
  ];
  const inferredIncome = incomeKeywords.some((k) => tl.includes(k));

  // fallback: try to extract numbers
  const mm = t.match(/([0-9,\.]+)\s*(บาท|฿)?/);
  if (mm) {
    const amount = parseFloat(mm[1].replace(/,/g, '')) || 0;
    return { type: inferredIncome ? 'income' : 'expense', amount, note: t };
  }

  return { command: 'unknown' };
}

function classifyCategoryFromNote(note, type) {
  const raw = String(note || '');
  const t = raw.toLowerCase();
  const has = (...keys) => keys.some((k) => t.includes(k));

  if (type === 'income') {
    if (has('เงินเดือน', 'salary')) return { name: 'เงินเดือน', icon: 'salary' };
    if (has('โบนัส', 'bonus')) return { name: 'โบนัส', icon: 'gift' };
    if (has('คืนเงิน', 'refund', 'rebate')) return { name: 'คืนเงิน', icon: 'money' };
    if (has('ลงทุน', 'หุ้น', 'คริป', 'crypto', 'investment')) return { name: 'ลงทุน', icon: 'money' };
    return { name: 'รายได้อื่นๆ', icon: 'money' };
  }

  // expense
  if (has('ข้าว', 'ก๋วยเตี๋ยว', 'อาหาร', 'ข้าวมันไก่', 'หมูปิ้ง', 'ข้าวเหนียว', 'ส้มตำ', 'ผัด', 'แกง', 'ไก่', 'หมู', 'ปลา')) {
    return { name: 'อาหาร', icon: 'food' };
  }
  if (has('กาแฟ', 'ชา', 'น้ำ', 'น้ำอัดลม', 'โค้ก', 'pepsi', 'coffee', 'cafe')) {
    return { name: 'เครื่องดื่ม', icon: 'drink' };
  }
  if (has('grab', 'bolt', 'แท็กซี่', 'taxi', 'bts', 'mrt', 'รถเมล์', 'bus', 'train', 'เดินทาง', 'ค่าน้ำมัน', 'เติมน้ำมัน', 'parking', 'จอดรถ')) {
    return { name: 'เดินทาง', icon: 'transport' };
  }
  if (has('ค่าไฟ', 'ค่าน้ำ', 'อินเตอร์เน็ต', 'เน็ตทรู', 'ais', 'dtac', 'true', 'wifi', 'โทรศัพท์', 'มือถือ', 'บิล', 'bill')) {
    return { name: 'บิล/สาธารณูปโภค', icon: 'bills' };
  }
  if (has('shopee', 'lazada', '7-11', 'เซเว่น', 'ซื้อของ', 'ช้อป', 'shopping')) {
    return { name: 'ช้อปปิ้ง', icon: 'shopping' };
  }
  if (has('ยา', 'หมอ', 'โรงพยาบาล', 'คลินิก', 'health')) {
    return { name: 'สุขภาพ', icon: 'health' };
  }

  return { name: 'อื่นๆ', icon: 'other' };
}

async function ensureUserCategory({ userId, type, name, icon }) {
  const safeType = type === 'income' ? 'income' : 'expense';
  const safeName = String(name || '').trim() || (safeType === 'income' ? 'รายได้อื่นๆ' : 'อื่นๆ');
  const safeIcon = String(icon || '').trim() || 'other';

  const existing = await Category.findOne({ userId, type: safeType, name: safeName });
  if (existing) return existing;

  try {
    return await Category.create({
      userId,
      type: safeType,
      name: safeName,
      icon: safeIcon,
      isDefault: false,
    });
  } catch (e) {
    // Unique index race: try again
    const fallback = await Category.findOne({ userId, type: safeType, name: safeName });
    if (fallback) return fallback;
    throw e;
  }
}

async function resolveMessagingUser(lineMessagingUserId) {
  if (!lineMessagingUserId) return { user: null };

  const [userByMessagingId, userByLegacyLineId] = await Promise.all([
    User.findOne({ lineMessagingUserId }),
    // Backwards compat: some installs may have stored messaging userId in lineUserId
    User.findOne({ lineUserId: lineMessagingUserId }),
  ]);

  // If we found a legacy record that stored Messaging userId in `lineUserId`,
  // migrate it to the correct field so future lookups are consistent.
  if (!userByMessagingId && userByLegacyLineId && !userByLegacyLineId.lineMessagingUserId) {
    try {
      userByLegacyLineId.lineMessagingUserId = String(lineMessagingUserId);
      const email = String(userByLegacyLineId.email || '');
      // If this looks like a bot-created placeholder account, detach legacy `lineUserId`
      // to avoid confusing it with LINE Login (OAuth) ids.
      if (
        String(userByLegacyLineId.lineUserId || '') === String(lineMessagingUserId) &&
        email &&
        !email.endsWith('@line.local') &&
        (/^line_/i.test(email) || /^line_msg_/i.test(email))
      ) {
        userByLegacyLineId.lineUserId = undefined;
      }
      await userByLegacyLineId.save();
    } catch (e) {
      // ignore migration errors
    }
  }

  let user = userByMessagingId || userByLegacyLineId;

  if (!user) {
    let profile = null;
    try {
      ensureClient();
      profile = await client.getProfile(lineMessagingUserId);
    } catch (e) {
      // profile fetch may fail if CHANNEL_TOKEN not configured or permission denied - continue
    }

    try {
      user = await User.findOne({ lineMessagingUserId });
      if (!user) {
        const placeholderEmail = `line_msg_${lineMessagingUserId}@local`;
        try {
          user = await User.create({
            lineMessagingUserId: String(lineMessagingUserId),
            name: (profile && profile.displayName) ? profile.displayName : '',
            profilePic: (profile && profile.pictureUrl) ? profile.pictureUrl : '',
            email: placeholderEmail
          });
        } catch (createErr) {
          if (createErr && createErr.code === 11000) {
            // race: another process created a user with the same placeholder or a null-email collision
            user = await User.findOne({ lineMessagingUserId });
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

  return { user, userByMessagingId, userByLegacyLineId };
}

async function handleTextEvent(event) {
  const rawText = (event.message && event.message.text) ? event.message.text : '';
  // normalize: remove invisible/zero-width characters and soft-hyphens, then trim
  const text = rawText.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').trim();
  const parsed = parseTransactionText(text);
  const lineMessagingUserId = event.source && event.source.userId;

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
    console.log('LINE event.userId:', lineMessagingUserId, 'replyToken:', event.replyToken ? 'present' : 'missing');
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

  if (!lineMessagingUserId) {
    // cannot map to user
    return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบ userId จาก LINE' });
  }

  const { user, userByMessagingId, userByLegacyLineId } = await resolveMessagingUser(lineMessagingUserId);

  console.log('LINE resolved user mapping:', {
    lineMessagingUserId: String(lineMessagingUserId || ''),
    userByMessagingId: userByMessagingId ? String(userByMessagingId._id) : null,
    userByLegacyLineId: userByLegacyLineId ? String(userByLegacyLineId._id) : null,
    selectedUserId: user ? String(user._id) : null,
    selectedEmail: user?.email || null,
  });

  // Quick debug command: show which backend user this LINE account maps to.
  const isWhoAmI = /^\s*(whoami|บัญชี|account)\s*$/i.test(text);
  if (isWhoAmI) {
    return sendReply(event.replyToken, {
      type: 'text',
      text: `บัญชีที่ผูกกับแชท LINE นี้\nuserId: ${String(user?._id || '-')}\nemail: ${String(user?.email || '-')}\nlineMessagingUserId: ${String(lineMessagingUserId || '-')}`,
    });
  }

  // Link flow: generate short code to connect this LINE chat to the current web account.
  const isLink = /^\s*(เชื่อมบัญชี|เชื่อมเว็บ|link)\s*$/i.test(text);
  if (isLink) {
    const code = createLinkCode();
    const codeHash = hashLinkCode(code);
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    try {
      await LineMessagingLinkSession.create({ codeHash, lineMessagingUserId: String(lineMessagingUserId), expiresAt });
    } catch (e) {
      console.error('LineMessagingLinkSession create failed', e);
      return sendReply(event.replyToken, { type: 'text', text: 'ขออภัย ระบบสร้างโค้ดเชื่อมบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const linkUrl = `${frontend}/profile?linkCode=${encodeURIComponent(code)}`;
    return sendReply(event.replyToken, {
      type: 'text',
      text: `โค้ดเชื่อมบัญชี: ${code} (หมดอายุ 10 นาที)\n\nเปิดเว็บแล้วกดลิงก์นี้เพื่อเชื่อมอัตโนมัติ:\n${linkUrl}\n\nหรือไปหน้าโปรไฟล์แล้วกรอกโค้ดนี้ก็ได้`,
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
        lineUserId: String(lineMessagingUserId),
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
    console.log('LINE will save transaction for user _id:', String(user?._id || ''), 'lineMessagingUserId:', String(lineMessagingUserId || ''));
    // ensure we save note into the same field existing docs use (`notes`) and keep `note` for compatibility
    const notesText = parsed.note || parsed.notes || '';
    // auto-categorize from note keywords (create category if missing)
    let categoryId = null;
    try {
      const cat = classifyCategoryFromNote(notesText, parsed.type);
      if (cat && cat.name) {
        const doc = await ensureUserCategory({ userId: user._id, type: parsed.type, name: cat.name, icon: cat.icon });
        categoryId = doc?._id || null;
      }
    } catch (e) {
      console.warn('LINE auto-categorize failed:', e?.message || e);
    }
    // save transaction
    const tx = new Transaction({
      userId: user._id,
      type: parsed.type,
      amount: parsed.amount,
      notes: notesText,
      note: notesText,
      categoryId,
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

function bufferFromStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function guessImageExt(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t.includes('png')) return '.png';
  if (t.includes('webp')) return '.webp';
  if (t.includes('gif')) return '.gif';
  return '.jpg';
}

function guessAudioExt(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t.includes('mpeg')) return '.mp3';
  if (t.includes('wav')) return '.wav';
  if (t.includes('ogg')) return '.ogg';
  if (t.includes('opus')) return '.opus';
  if (t.includes('m4a')) return '.m4a';
  if (t.includes('mp4')) return '.m4a';
  if (t.includes('aac')) return '.aac';
  return '.m4a';
}

async function handleImageEvent(event) {
  const lineMessagingUserId = event.source && event.source.userId;
  const messageId = event.message && event.message.id;
  if (!lineMessagingUserId || !messageId) {
    return sendReply(event.replyToken, { type: 'text', text: 'อ่านรูปไม่สำเร็จ (missing user/message id)' });
  }

  // Ack quickly, then OCR + save transaction asynchronously (replyToken can be used only once).
  await sendReply(event.replyToken, { type: 'text', text: 'รับรูปแล้ว กำลังอ่านข้อมูลจากรูปให้...' });

  (async () => {
    try {
      ensureClient();
      const { user } = await resolveMessagingUser(lineMessagingUserId);
      if (!user) {
        await pushToUser(lineMessagingUserId, { type: 'text', text: 'ไม่พบบัญชีผู้ใช้ของคุณ' });
        return;
      }

      const resp = await client.getMessageContent(messageId);
      // SDKs differ: sometimes returns a stream, sometimes { data, headers }.
      const stream = (resp && typeof resp.on === 'function')
        ? resp
        : (resp && resp.data && typeof resp.data.on === 'function')
          ? resp.data
          : null;
      if (!stream) {
        throw new Error('Unsupported getMessageContent response');
      }

      const contentType = (resp && resp.headers && (resp.headers['content-type'] || resp.headers['Content-Type'])) || '';
      const ext = guessImageExt(contentType);

      const uploadDir = path.join(__dirname, '../uploads/line');
      try { fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
      const filePath = path.join(uploadDir, `line-${Date.now()}-${messageId}${ext}`);

      const buf = await bufferFromStream(stream);
      fs.writeFileSync(filePath, buf);

      const { extraction, ocrConfidence } = await scanImageFile(filePath, { cleanupOriginal: true });
      const amount = extraction?.amount;

      if (!amount || !(Number(amount) > 0)) {
        await pushToUser(lineMessagingUserId, { type: 'text', text: 'อ่านรูปได้ แต่ยังจับ “ยอดเงิน” ไม่เจอ ลองส่งรูปที่ชัดขึ้น/เต็มใบอีกครั้ง' });
        return;
      }

      const rawText = String(extraction?.rawText || '').toLowerCase();
      const looksLikeIncome = /เงินเข้า|received|receive|credit|เข้าบัญชี|รับเงิน/.test(rawText);
      const type = looksLikeIncome ? 'income' : 'expense';

      let note = 'สลิป/รูปภาพ';
      if (extraction?.documentType === 'transfer_slip') {
        note = extraction?.recipient ? `สลิปโอนเงิน ${looksLikeIncome ? 'จาก' : 'ไปยัง'} ${extraction.recipient}` : 'สลิปโอนเงิน';
      } else if (extraction?.documentType === 'receipt') {
        note = 'ใบเสร็จ/สลิป';
      }

      // For now, keep slip transactions in a money-related category for clarity.
      let categoryId = null;
      try {
        const catName = type === 'income' ? 'รับโอน/เงินเข้า' : 'โอนเงิน/ชำระเงิน';
        const catIcon = 'money';
        const doc = await ensureUserCategory({ userId: user._id, type, name: catName, icon: catIcon });
        categoryId = doc?._id || null;
      } catch (e) {
        console.warn('LINE slip category create failed:', e?.message || e);
      }

      const tx = new Transaction({
        userId: user._id,
        type,
        amount: Number(amount),
        notes: note,
        note,
        categoryId,
        datetime: new Date(),
        source: 'slip',
        rawMessage: { event, extraction, ocrConfidence },
      });
      await tx.save();

      const reply = `${type === 'income' ? 'รับ' : 'จ่าย'} ${Number(amount).toLocaleString()} บาท\n${note}\n(ความมั่นใจ OCR: ${Math.round(Number(ocrConfidence || 0) * 10) / 10}%)`;
      await pushToUser(lineMessagingUserId, { type: 'text', text: reply });
    } catch (e) {
      console.error('handleImageEvent error', e);
      await pushToUser(lineMessagingUserId, { type: 'text', text: 'ขออภัย อ่านรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง (แนะนำรูปชัด/ไม่เอียง/เต็มใบ)' });
    }
  })();
}

async function handleAudioEvent(event) {
  const lineMessagingUserId = event.source && event.source.userId;
  const messageId = event.message && event.message.id;
  if (!lineMessagingUserId || !messageId) {
    return sendReply(event.replyToken, { type: 'text', text: 'ถอดเสียงไม่สำเร็จ (missing user/message id)' });
  }

  // Ack quickly, then transcribe + save transaction asynchronously.
  await sendReply(event.replyToken, { type: 'text', text: 'รับเสียงแล้ว กำลังถอดเสียงให้...' });

  (async () => {
    try {
      ensureClient();
      const { user } = await resolveMessagingUser(lineMessagingUserId);
      if (!user) {
        await pushToUser(lineMessagingUserId, { type: 'text', text: 'ไม่พบบัญชีผู้ใช้ของคุณ' });
        return;
      }

      const resp = await client.getMessageContent(messageId);
      const stream = (resp && typeof resp.on === 'function')
        ? resp
        : (resp && resp.data && typeof resp.data.on === 'function')
          ? resp.data
          : null;
      if (!stream) throw new Error('Unsupported getMessageContent response');

      const contentType = (resp && resp.headers && (resp.headers['content-type'] || resp.headers['Content-Type'])) || '';
      const ext = guessAudioExt(contentType);

      const uploadDir = path.join(__dirname, '../uploads/line/audio');
      try { fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
      const filePath = path.join(uploadDir, `line-audio-${Date.now()}-${messageId}${ext}`);

      const buf = await bufferFromStream(stream);
      fs.writeFileSync(filePath, buf);

      const tr = await transcribeAudioFile({ filePath, mimeType: contentType || 'audio/*', language: 'th' });
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }

      if (tr?.disabled) {
        await pushToUser(lineMessagingUserId, { type: 'text', text: 'ฟีเจอร์ถอดเสียงยังไม่ถูกเปิด (ต้องตั้งค่า OPENAI_API_KEY ที่ backend)' });
        return;
      }

      const transcript = String(tr?.text || '').trim();
      if (!transcript) {
        await pushToUser(lineMessagingUserId, { type: 'text', text: 'ถอดเสียงไม่เจอข้อความ ลองอัดใหม่ให้ชัดขึ้นอีกนิดนะ' });
        return;
      }

      const parsed = parseTransactionText(transcript);
      if (!(parsed?.type && parsed?.amount)) {
        await pushToUser(lineMessagingUserId, { type: 'text', text: `ผมได้ยินว่า: "${transcript}"\nแต่ยังจับ “จำนวนเงิน” ไม่ได้ ลองพูดแบบนี้:\n- จ่าย 107 ข้าวมันไก่\n- รับ 20000 เงินเดือน` });
        return;
      }

      const notesText = parsed.note || parsed.notes || transcript;

      let categoryId = null;
      try {
        const cat = classifyCategoryFromNote(notesText, parsed.type);
        if (cat && cat.name) {
          const doc = await ensureUserCategory({ userId: user._id, type: parsed.type, name: cat.name, icon: cat.icon });
          categoryId = doc?._id || null;
        }
      } catch (e) {
        console.warn('VOICE auto-categorize failed:', e?.message || e);
      }

      const tx = new Transaction({
        userId: user._id,
        type: parsed.type,
        amount: parsed.amount,
        notes: notesText,
        note: notesText,
        categoryId,
        datetime: new Date(),
        source: 'voice',
        rawMessage: { event, transcript, stt: { provider: tr.provider, model: tr.model } },
      });
      await tx.save();

      const summary = `${parsed.type === 'expense' ? 'จ่าย' : 'รับ'} ${parsed.amount} ${parsed.note || ''}`.trim();
      await pushToUser(lineMessagingUserId, { type: 'text', text: `บันทึกจากเสียงเรียบร้อย: ${summary}\nได้ยินว่า: "${transcript}"` });
    } catch (e) {
      console.error('handleAudioEvent error', e);
      await pushToUser(lineMessagingUserId, { type: 'text', text: 'ขออภัย ถอดเสียงไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }
  })();
}

// handle postback events (from richmenu postback actions)
async function handlePostbackEvent(event) {
  const lineMessagingUserId = event.source && event.source.userId;
  const data = event.postback && event.postback.data ? event.postback.data : '';
  console.log('LINE postback received', { userId: lineMessagingUserId, data });
  if (!lineMessagingUserId) return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบ userId' });

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

  const { user } = await resolveMessagingUser(lineMessagingUserId);
  if (!user) return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบบัญชีผู้ใช้ของคุณ' });

  // handle known postback actions
  // Be strict when detecting the dashboard action to avoid accidental substring matches
  if (actionValue === 'web_login' || actionValue === 'web' || actionValue === 'dashboard' || actionValue === 'open_dashboard' || actionValue === 'open-dashboard') {
    const backendBase = process.env.BACKEND_URL || 'http://localhost:5050';
    const rawToken = createSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await LineLoginSession.create({
        tokenHash,
        userId: user._id,
        lineUserId: String(lineMessagingUserId),
        expiresAt,
      });
    } catch (e) {
      console.error('LineLoginSession create failed', e);
      return sendReply(event.replyToken, { type: 'text', text: 'ขออภัย ระบบสร้างลิงก์เข้าเว็บไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }

    const redirectUrl = `${backendBase}/webhooks/line/session-login?token=${encodeURIComponent(rawToken)}`;
    return sendReply(event.replyToken, { type: 'text', text: `แตะลิงก์นี้เพื่อเข้าเว็บ (ลิงก์หมดอายุใน 10 นาที)\n${redirectUrl}` });
  }

  if (actionValue === 'summary' || actionValue === 'summary_today') {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const txs = await Transaction.find({ userId: user._id, datetime: { $gte: start, $lte: end } });
    const income = txs.filter(t=>t.type==='income').reduce((s,n)=>s+n.amount,0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,n)=>s+n.amount,0);
    const reply = `สรุปวันนี้\nรายรับ: ${income}\nรายจ่าย: ${expense}\nรายการ: ${txs.length}`;
    return sendReply(event.replyToken, { type: 'text', text: reply });
  }

  if (actionValue === 'summary_month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
    const txs = await Transaction.find({ userId: user._id, datetime: { $gte: start, $lte: end } });
    const income = txs.filter(t=>t.type==='income').reduce((s,n)=>s+n.amount,0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,n)=>s+n.amount,0);
    const reply = `สรุปเดือนนี้\nรายรับ: ${income}\nรายจ่าย: ${expense}\nรายการ: ${txs.length}`;
    return sendReply(event.replyToken, { type: 'text', text: reply });
  }

  if (actionValue === 'help') {
    const helpText = 'คำสั่งตัวอย่าง:\n- จ่าย 120 ข้าวมันไก่\n- รับ 500 เงินลูกค้า\n- สรุปวันนี้\n- สรุปเดือนนี้\n- export';
    return sendReply(event.replyToken, { type: 'text', text: helpText });
  }

  if (actionValue === 'announce' || actionValue === 'ประกาศ') {
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

function createLinkCode() {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

function hashLinkCode(code) {
  return hashSessionToken(code);
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
        if (ev.type === 'message' && ev.message && ev.message.type === 'text') return handleTextEvent(ev);
        if (ev.type === 'message' && ev.message && ev.message.type === 'image') return handleImageEvent(ev);
        if (ev.type === 'message' && ev.message && ev.message.type === 'audio') return handleAudioEvent(ev);
        if (ev.type === 'postback') return handlePostbackEvent(ev);
        // ignore other events for now
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
