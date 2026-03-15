const express = require('express');
const line = require('@line/bot-sdk');
const router = express.Router();
const { User, Transaction, Category, Budget, ImportExportLog, LineLoginSession, LineMessagingLinkSession } = require('../models');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { transcribeAudioFile } = require('../utils/transcribeAudio');
const { mergeUsers } = require('../utils/mergeUsers');
const { parseSlipImageBuffer } = require('../utils/openaiSlip');
const { summarizeFinanceDay } = require('../utils/openaiFinanceSummary');

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

function getPushTargetId(source) {
  const t = source && source.type;
  if (t === 'group') return source.groupId || '';
  if (t === 'room') return source.roomId || '';
  return (source && source.userId) || '';
}

function buildAiUserErrorMessage(err) {
  const code = String(err?.code || '').trim();
  const status = Number(err?.status || 0) || 0;
  const rawMsg = String(err?.message || '').trim();

  if (code === 'missing_openai_api_key') return 'ยังไม่ได้ตั้งค่า OPENAI_API_KEY ใน backend/.env';
  if (status === 401) return 'OpenAI API key ไม่ถูกต้อง/หมดอายุ (401)';
  if (status === 403) return 'OpenAI ถูกปฏิเสธสิทธิ์ (403)';
  if (status === 429) return 'OpenAI โควต้าเต็ม/โดน rate limit (429)';
  if (code === 'invalid_json') return 'AI ตอบกลับผิดรูปแบบ';
  if (/abort/i.test(rawMsg)) return 'AI timeout';
  if (/fetch failed|enotfound|econnrefused|etimedout/i.test(rawMsg)) return 'เชื่อมต่อ OpenAI ไม่ได้ (network)';

  if (rawMsg) return `AI error: ${rawMsg.slice(0, 180)}`;
  return 'AI error';
}

// debug: show whether token was loaded when this module initialized
console.log('LINE webhook module loaded. CHANNEL_TOKEN present:', CHANNEL_TOKEN ? (CHANNEL_TOKEN.slice(0,8) + '...') : 'no');

function formatThb(amount) {
  const n = Number(amount) || 0;
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

function formatThaiDateTime(input) {
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatThaiDate(input) {
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function getBangkokMonthRange(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;

  // Thailand is UTC+07:00 with no DST.
  const bangkokMs = d.getTime() + 7 * 60 * 60 * 1000;
  const bd = new Date(bangkokMs);
  const year = bd.getUTCFullYear();
  const month = bd.getUTCMonth();

  const startUtcMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const endUtcMs = Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

function getBangkokDayRange(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;

  const bangkokMs = d.getTime() + 7 * 60 * 60 * 1000;
  const bd = new Date(bangkokMs);
  const year = bd.getUTCFullYear();
  const month = bd.getUTCMonth();
  const day = bd.getUTCDate();

  const startUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const endUtcMs = Date.UTC(year, month, day + 1, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function parseMonthSpecifierFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const normalizeDigits = (s) => String(s || '').replace(/[๐-๙]/g, (ch) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)));
  const s = normalizeDigits(raw).toLowerCase();

  if (s.includes('เดือนนี้')) return { kind: 'relative', offset: 0 };
  if (s.includes('เดือนที่แล้ว') || s.includes('เดือนก่อน')) return { kind: 'relative', offset: -1 };
  if (s.includes('เดือนหน้า') || s.includes('เดือนถัดไป')) return { kind: 'relative', offset: 1 };

  // Thai month abbreviations: ม.ค., ก.พ., มี.ค., เม.ย., พ.ค., มิ.ย., ก.ค., ส.ค., ก.ย., ต.ค., พ.ย., ธ.ค.
  const ABBR_TH = [
    ['ม.ค', 0], ['ก.พ', 1], ['มี.ค', 2], ['เม.ย', 3], ['พ.ค', 4], ['มิ.ย', 5],
    ['ก.ค', 6], ['ส.ค', 7], ['ก.ย', 8], ['ต.ค', 9], ['พ.ย', 10], ['ธ.ค', 11],
  ];
  for (const [abbr, monthIndex] of ABBR_TH) {
    const re = new RegExp(`${abbr}\\.?(?:\\s*)(\\d{4})`, 'i');
    const match = raw.match(re);
    if (match) {
      let year = Number(match[1]);
      if (year >= 2400) year -= 543;
      if (Number.isFinite(year)) return { kind: 'absolute', year, monthIndex };
    }
  }

  // Thai month + year (B.E. or C.E.)
  for (let i = 0; i < MONTH_NAMES_TH.length; i++) {
    const mName = MONTH_NAMES_TH[i];
    const re = new RegExp(`${mName}\\s*(\\d{4})`, 'i');
    const match = raw.match(re);
    if (match) {
      let year = Number(match[1]);
      if (year >= 2400) year -= 543;
      if (Number.isFinite(year)) return { kind: 'absolute', year, monthIndex: i };
    }
  }

  // YYYY-MM
  const ym = s.match(/(\d{4})\s*-\s*(\d{1,2})/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (Number.isFinite(year) && month >= 1 && month <= 12) return { kind: 'absolute', year, monthIndex: month - 1 };
  }

  // MM/YYYY (B.E. supported)
  const my = s.match(/(\d{1,2})\s*\/\s*(\d{4})/);
  if (my) {
    const month = Number(my[1]);
    let year = Number(my[2]);
    if (year >= 2400) year -= 543;
    if (Number.isFinite(year) && month >= 1 && month <= 12) return { kind: 'absolute', year, monthIndex: month - 1 };
  }

  return null;
}

async function getTopExpenseCategories({ userId, range, limit = 3 } = {}) {
  if (!userId || !range?.start || !range?.end) return [];

  const rows = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'expense',
        datetime: { $gte: range.start, $lt: range.end },
      },
    },
    {
      $group: {
        _id: '$categoryId',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
    { $limit: Math.max(1, Math.min(10, Number(limit) || 3)) },
  ]).catch(() => []);

  const catIds = (rows || [])
    .map((r) => r?._id)
    .filter((id) => id != null);

  const cats = await Category.find({ _id: { $in: catIds } })
    .select({ _id: 1, name: 1, icon: 1 })
    .lean()
    .catch(() => []);

  const catMap = new Map((cats || []).map((c) => [String(c._id), c]));
  return (rows || []).map((r) => {
    const c = r?._id ? catMap.get(String(r._id)) : null;
    const name = String(c?.name || '').trim() || 'อื่นๆ';
    const iconDisplay = pickCategoryIconDisplay(c?.icon);
    return {
      categoryId: r?._id || null,
      name,
      icon: iconDisplay?.value || '🤖',
      total: Number(r?.total) || 0,
      count: Number(r?.count) || 0,
    };
  });
}

async function getMonthBudgetTotal({ userId, monthLabel } = {}) {
  if (!userId || !monthLabel) return null;
  const rows = await Budget.find({ userId, month: String(monthLabel) })
    .select({ total: 1 })
    .lean()
    .catch(() => []);
  const total = (rows || []).reduce((s, b) => s + (Number(b?.total) || 0), 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function buildFinanceStatusFlexMessage({
  label,
  range,
  income,
  expense,
  remaining,
  txCount,
  topExpenses,
  budgetTotal,
  budgetRemaining,
  aiSummary,
} = {}) {
  const safeLabel = String(label || '').trim();
  const pillText = safeLabel.length > 22 ? `${safeLabel.slice(0, 22)}…` : safeLabel;
  const safeIncome = Number(income) || 0;
  const safeExpense = Number(expense) || 0;
  const safeRemaining = Number(remaining) || 0;
  const safeTxCount = Number(txCount) || 0;

  const remainingColor = safeRemaining < 0 ? '#DC2626' : '#16A34A';
  const headerBg = safeRemaining < 0 ? '#FEF2F2' : '#ECFDF5';

  const dateHint = range?.start ? formatThaiDate(range.start) : '';
  const dateHint2 = range?.end ? formatThaiDate(new Date(new Date(range.end).getTime() - 1)) : '';
  const periodHint = dateHint && dateHint2 && dateHint !== dateHint2 ? `${dateHint} - ${dateHint2}` : (dateHint || '');

  const budgetSection =
    Number.isFinite(Number(budgetTotal)) && Number(budgetTotal) > 0
      ? [
          { type: 'separator', color: '#E5E7EB', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              { type: 'text', text: 'งบประมาณ', size: 'sm', weight: 'bold', color: '#0F172A' },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ตั้งไว้', size: 'sm', color: '#64748B', flex: 1 },
                  { type: 'text', text: formatThb(budgetTotal), size: 'sm', weight: 'bold', color: '#0F172A', flex: 0 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ใช้ไป', size: 'sm', color: '#64748B', flex: 1 },
                  { type: 'text', text: formatThb(safeExpense), size: 'sm', weight: 'bold', color: '#0F172A', flex: 0 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'เหลือจากงบ', size: 'sm', color: '#64748B', flex: 1 },
                  {
                    type: 'text',
                    text: formatThb(budgetRemaining),
                    size: 'sm',
                    weight: 'bold',
                    color: (Number(budgetRemaining) || 0) < 0 ? '#DC2626' : '#16A34A',
                    flex: 0,
                  },
                ],
              },
            ],
          },
        ]
      : [];

  const topExpenseSection =
    Array.isArray(topExpenses) && topExpenses.length > 0
      ? [
          { type: 'separator', color: '#E5E7EB', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              { type: 'text', text: 'หมวดรายจ่ายสูงสุด', size: 'sm', weight: 'bold', color: '#0F172A' },
              ...topExpenses.slice(0, 3).map((r) => ({
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: `${String(r?.icon || '•')} ${String(r?.name || 'อื่นๆ')}`, size: 'sm', color: '#334155', flex: 1, wrap: true },
                  { type: 'text', text: formatThb(r?.total), size: 'sm', weight: 'bold', color: '#0F172A', flex: 0 },
                ],
              })),
            ],
          },
        ]
      : [];

  const aiSummaryText = String(aiSummary || '').trim();
  const aiSection =
    aiSummaryText
      ? [
          { type: 'separator', color: '#E5E7EB', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              { type: 'text', text: 'สรุปโดย AI', size: 'sm', weight: 'bold', color: '#0F172A' },
              { type: 'text', text: aiSummaryText, size: 'sm', color: '#334155', wrap: true },
            ],
          },
        ]
      : [];

  return {
    type: 'flex',
    altText: safeLabel ? `สรุปการเงิน (${safeLabel})` : 'สรุปการเงิน',
    contents: {
      type: 'bubble',
      styles: {
        header: { backgroundColor: headerBg },
        body: { backgroundColor: '#FFFFFF' },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'สถานะการเงิน', weight: 'bold', size: 'xl', color: '#0F172A', flex: 1, wrap: true },
              {
                type: 'box',
                layout: 'vertical',
                paddingAll: '6px',
                paddingStart: '12px',
                paddingEnd: '12px',
                cornerRadius: '999px',
                backgroundColor: '#E2E8F0',
                flex: 0,
                contents: [{ type: 'text', text: pillText || '-', size: 'xs', weight: 'bold', color: '#334155', align: 'center' }],
              },
            ],
          },
          ...(periodHint
            ? [{ type: 'text', text: periodHint, size: 'sm', color: '#64748B', wrap: true }]
            : []),
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'คงเหลือ (สุทธิ)', size: 'sm', color: '#64748B' },
          { type: 'text', text: formatThb(safeRemaining), size: 'xxl', weight: 'bold', color: remainingColor, wrap: true },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'รายจ่าย', size: 'xs', color: '#94A3B8' },
                  { type: 'text', text: formatThb(safeExpense), size: 'md', weight: 'bold', color: '#0F172A', wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'รายรับ', size: 'xs', color: '#94A3B8' },
                  { type: 'text', text: formatThb(safeIncome), size: 'md', weight: 'bold', color: '#0F172A', wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 0,
                contents: [
                  { type: 'text', text: 'รายการ', size: 'xs', color: '#94A3B8' },
                  { type: 'text', text: String(safeTxCount), size: 'md', weight: 'bold', color: '#0F172A' },
                ],
              },
            ],
          },
          ...aiSection,
          ...topExpenseSection,
          ...budgetSection,
        ],
      },
    },
  };
}

function buildQuickNoteFlexMessage() {
  return {
    type: 'flex',
    altText: 'เพิ่มรายการ',
    contents: {
      type: 'bubble',
      styles: {
        header: { backgroundColor: '#10B981' },
        body: { backgroundColor: '#FFFFFF' },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'เพิ่มรายการ', weight: 'bold', size: 'xl', color: '#FFFFFF', wrap: true },
          { type: 'text', text: 'พิมพ์ข้อความ แล้วผมจะบันทึกให้', size: 'sm', color: '#CBD5E1', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'ตัวอย่าง (พิมพ์ได้เลย):', size: 'sm', weight: 'bold', color: '#0F172A' },
              { type: 'text', text: '• ข้าวมันไก่ 50\n• กาแฟ 65\n• เงินเดือน 20000\n• ค่าน้ำ 180', size: 'sm', color: '#334155', wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'ทิป', size: 'sm', weight: 'bold', color: '#0F172A' },
              { type: 'text', text: '• พิมพ์หลายรายการได้ (ขึ้นบรรทัดใหม่)\n• ใส่จำนวนเงินท้ายประโยคจะเดาได้แม่นขึ้น', size: 'sm', color: '#475569', wrap: true },
            ],
          },
        ],
      },
    },
  };
}

function buildAnnounceFlexMessage() {
  // Deep link opens the LINE profile page directly in the app (better UX than https)
  const profileUrl = 'line://ti/p/@156twxxb';
  const profileUrlHttp = 'https://line.me/R/ti/p/@156twxxb';
  return {
    type: 'flex',
    altText: 'ประกาศ',
    contents: {
      type: 'bubble',
      action: { type: 'uri', uri: profileUrl },
      styles: {
        header: { backgroundColor: '#10B981' },
        body: { backgroundColor: '#FFFFFF' },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'xs',
        contents: [
          { type: 'text', text: 'ประกาศ', weight: 'bold', size: 'xl', color: '#052E2B', wrap: true },
          { type: 'text', text: 'แตะการ์ดนี้เพื่อเปิดหน้าโปรไฟล์/VOOM', size: 'sm', color: '#064E3B', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            cornerRadius: '14px',
            backgroundColor: '#ECFDF5',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'เปิดลิงก์:', size: 'sm', weight: 'bold', color: '#064E3B' },
              { type: 'text', text: profileUrlHttp, size: 'xs', color: '#0F766E', wrap: true },
            ],
          },
          { type: 'text', text: 'ทิป: แตะที่การ์ดเพื่อเปิด “หน้าโปรไฟล์” ทันที (ในแอป LINE)', size: 'xs', color: '#64748B', wrap: true },
        ],
      },
    },
  };
}

async function sumCategoryTotalForMonth({ userId, categoryId, type, when } = {}) {
  if (!userId || !categoryId) return null;
  const range = getBangkokMonthRange(when || new Date());
  if (!range) return null;

  const rows = await Transaction.aggregate([
    {
      $match: {
        userId,
        categoryId,
        type: type === 'income' ? 'income' : 'expense',
        datetime: { $gte: range.start, $lt: range.end },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).catch(() => []);

  const total = rows && rows[0] && typeof rows[0].total === 'number' ? rows[0].total : null;
  return Number.isFinite(total) ? total : null;
}

function pickCategoryIconDisplay(categoryIcon) {
  const raw = String(categoryIcon || '').trim();
  if (!raw) return { kind: 'emoji', value: '🤖' };
  // If user stored an emoji in DB, show it directly.
  if (!/^[a-z0-9_ -]+$/i.test(raw) && raw.length <= 8) return { kind: 'emoji', value: raw };
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  const iconMap = {
    food: '🍜',
    drink: '☕️',
    transport: '🚆',
    bills: '🧾',
    shopping: '🛍️',
    health: '🩺',
    salary: '💼',
    bonus: '🎁',
    gift: '🎁',
    money: '💰',
    refund: '💸',
    investment: '📈',
    other: '📌',
    misc: '📌',
  };
  if (iconMap[key]) return { kind: 'emoji', value: iconMap[key] };
  return { kind: 'emoji', value: '🤖' };
}

function buildRecordedSuccessFlexMessage({
  txId,
  type,
  amount,
  categoryTotal,
  note,
  categoryName,
  categoryIcon,
  when,
  sourceLabel,
}) {
  const safeType = type === 'income' ? 'income' : 'expense';
  const typeLabel = safeType === 'income' ? 'รายรับ' : 'รายจ่าย';
  const typePill = safeType === 'income'
    ? { bg: '#D1FAE5', text: '#047857' }
    : { bg: '#FCE7E7', text: '#DC2626' };

  const safeAmount = Number(amount) || 0;
  const safeCategoryTotal = Number.isFinite(Number(categoryTotal)) ? Number(categoryTotal) : safeAmount;
  const safeNote = String(note || '').trim() || '-';
  const safeCategory = String(categoryName || '').trim() || 'อื่นๆ';
  const isCategoryUnknown = safeCategory === 'อื่นๆ';
  const whenText = formatThaiDateTime(when) || '';
  const safeSource = String(sourceLabel || '').trim();

  const iconDisplay = pickCategoryIconDisplay(categoryIcon);

  return {
    type: 'flex',
    altText: 'บันทึกสำเร็จ',
    contents: {
      type: 'bubble',
      styles: {
        header: { backgroundColor: '#ECFDF5' },
        body: { backgroundColor: '#FFFFFF' },
      },
      header: {
        type: 'box',
        layout: 'horizontal',
        paddingAll: '18px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'บันทึกสำเร็จ', weight: 'bold', size: 'xl', color: '#0F172A', flex: 0 },
                  {
                    type: 'box',
                    layout: 'vertical',
                    width: '22px',
                    height: '22px',
                    cornerRadius: '999px',
                    backgroundColor: '#22C55E',
                    contents: [{ type: 'text', text: '✓', align: 'center', gravity: 'center', color: '#FFFFFF', size: 'sm', weight: 'bold' }],
                  },
                ],
              },
              {
                type: 'text',
                text: 'อย่าลืมตรวจสอบรายละเอียด',
                size: 'sm',
                color: '#64748B',
                margin: 'sm',
                wrap: true,
              },
            ],
          },
          
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '18px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            alignItems: 'center',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: typePill.bg,
                cornerRadius: '999px',
                paddingAll: '6px',
                paddingStart: '14px',
                paddingEnd: '14px',
                flex: 0,
                contents: [
                  { type: 'text', text: typeLabel, size: 'sm', weight: 'bold', color: typePill.text, align: 'center' },
                ],
              },
              { type: 'text', text: `- ${isCategoryUnknown ? 'ไม่ระบุ' : safeCategory}`, size: 'md', weight: 'bold', color: '#0F172A', flex: 1, wrap: true },
              {
                type: 'text',
                text: '↗',
                size: 'lg',
                color: '#94A3B8',
                flex: 0,
                action: { type: 'postback', label: 'open', data: 'action=web_login' },
              },
            ],
          },

          ...(whenText
            ? [
                {
                  type: 'text',
                  text: whenText,
                  size: 'sm',
                  color: '#94A3B8',
                  margin: 'md',
                },
              ]
            : []),

          {
            type: 'text',
            text: safeNote,
            size: 'lg',
            weight: 'bold',
            color: '#0F172A',
            wrap: true,
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            spacing: 'sm',
            contents: [
              { type: 'text', text: formatThb(safeAmount), size: 'xl', weight: 'bold', color: '#22C55E', flex: 1, align: 'end' },
            ],
          },

          { type: 'separator', color: '#E5E7EB', margin: 'lg' },

          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: `รวมหมวด ${isCategoryUnknown ? 'ไม่ระบุ' : safeCategory}`, size: 'md', weight: 'bold', color: '#0F172A', flex: 1, wrap: true },
              { type: 'text', text: formatThb(safeCategoryTotal), size: 'md', weight: 'bold', color: '#22C55E', flex: 0 },
            ],
          },

          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            contents: [
              
                         
            ],
          },

          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#FEF3C7',
            cornerRadius: '14px',
            paddingAll: '14px',
            margin: 'md',
            contents: [
              {
                type: 'text',
                text: '💡 ระบบช่วยจัดหมวดให้อัตโนมัติ',
                size: 'sm',
                color: '#92400E',
                wrap: true,
              },
            ],
          },

          ...(safeSource
            ? [
                {
                  type: 'text',
                  text: `ที่มา: ${safeSource}`,
                  size: 'xs',
                  color: '#CBD5E1',
                  wrap: true,
                },
              ]
            : []),
        ],
      },
    },
  };
}

// simple parser: returns { type: 'income'|'expense', amount, note }
function parseTransactionText(text) {
  const normalizeDigits = (s) => String(s || '').replace(/[๐-๙]/g, (ch) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)));
  const makeBangkokDateTime = ({ year, month, day, hour = 12, minute = 0 } = {}) => {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const hh = Number(hour);
    const mm = Number(minute);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const safeH = Number.isFinite(hh) ? Math.max(0, Math.min(23, hh)) : 12;
    const safeM = Number.isFinite(mm) ? Math.max(0, Math.min(59, mm)) : 0;
    const pad2 = (n) => String(n).padStart(2, '0');
    const iso = `${y}-${pad2(m)}-${pad2(d)}T${pad2(safeH)}:${pad2(safeM)}:00.000+07:00`;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  };

  const extractWhenPrefix = (input) => {
    const raw = normalizeDigits(input).trim();
    let rest = raw;
    let when = null;

    const now = new Date();
    const todayBkk = makeBangkokDateTime({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() });

    const consume = (len) => {
      rest = raw.slice(len).trim();
    };

    // Keywords: วันนี้ / เมื่อวาน
    if (/^(วันนี้)(?:\s|$)/i.test(raw)) {
      when = todayBkk || new Date();
      consume(RegExp.$1.length);
      return { when, rest };
    }
    if (/^(เมื่อวาน|เมื่อวานนี้)(?:\s|$)/i.test(raw)) {
      const base = todayBkk || new Date();
      const dt = new Date(base);
      dt.setDate(dt.getDate() - 1);
      // keep time roughly same; normalize to Bangkok offset via ISO rebuild
      when = makeBangkokDateTime({ year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), hour: dt.getHours(), minute: dt.getMinutes() }) || dt;
      consume(RegExp.$1.length);
      return { when, rest };
    }

    // Relative days: "ย้อนหลัง 3 วัน", "3 วันก่อน"
    const rel = raw.match(/^(?:ย้อนหลัง\s*)?(\d{1,3})\s*วัน(?:ก่อน|ที่แล้ว)?(?:\s|$)/i);
    if (rel) {
      const n = Number(rel[1]);
      const base = todayBkk || new Date();
      const dt = new Date(base);
      if (Number.isFinite(n) && n >= 0 && n <= 3650) dt.setDate(dt.getDate() - n);
      when = makeBangkokDateTime({ year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), hour: dt.getHours(), minute: dt.getMinutes() }) || dt;
      consume(rel[0].length);
      return { when, rest };
    }

    // Date formats: YYYY-MM-DD or DD/MM/YYYY (B.E. supported)
    const d1 = raw.match(/^(?:วันที่\s*)?(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?(?:\s|$)/);
    if (d1) {
      const y = Number(d1[1]);
      const mo = Number(d1[2]);
      const da = Number(d1[3]);
      const hh = d1[4] != null ? Number(d1[4]) : 12;
      const mm = d1[5] != null ? Number(d1[5]) : 0;
      when = makeBangkokDateTime({ year: y, month: mo, day: da, hour: hh, minute: mm });
      if (when) {
        consume(d1[0].length);
        return { when, rest };
      }
    }

    const d2 = raw.match(/^(?:วันที่\s*)?(\d{1,2})[\\/\\-](\d{1,2})[\\/\\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?(?:\s|$)/);
    if (d2) {
      const day = Number(d2[1]);
      const month = Number(d2[2]);
      let year = Number(d2[3]);
      const hh = d2[4] != null ? Number(d2[4]) : 12;
      const mm = d2[5] != null ? Number(d2[5]) : 0;
      if (year < 100) year = year <= 50 ? 2000 + year : 1900 + year;
      if (year >= 2400) year = year - 543; // Buddhist year -> Gregorian
      when = makeBangkokDateTime({ year, month, day, hour: hh, minute: mm });
      if (when) {
        consume(d2[0].length);
        return { when, rest };
      }
    }

    return { when: null, rest: raw };
  };

  const { when, rest } = extractWhenPrefix(text);
  const t = String(rest || '').trim();
  const tl = t.toLowerCase();
  // commands: help, สรุปวันนี้, สรุปเดือนนี้, export
  if (/^help$/i.test(t) || /^ช่วยเหลือ$/i.test(t)) return { command: 'help' };
  if (/^สรุปวันนี้$/i.test(t)) return { command: 'status_day', when };
  if (/^สรุปเดือนนี้$/i.test(t)) return { command: 'status_month', monthText: t };
  if (/^export(\s+.*)?$/i.test(t)) return { command: 'export' };
  if (/^\s*จด(รายการ(บันทึก)?)\s*$/i.test(t)) return { command: 'quick_note' };
  if (/^\s*จด\s*$/i.test(t)) return { command: 'quick_note' };
  if (/^(สถานะการเงิน|ภาพรวม(การเงิน)?|สรุปการเงิน)$/i.test(t)) return { command: 'status_month', monthText: 'เดือนนี้', queryText: t };

  // finance/status queries (today/month)
  const isQuestion = /(เท่าไหร่|เท่าไร|กี่บาท|ยังไง|ไหม|\?)/i.test(t);
  const wantsBalance = /(ยอดคงเหลือ|คงเหลือ|เหลือเงิน|เหลือเท่าไหร่|เหลือเท่าไร)/i.test(t);
  const wantsSpent = /(วันนี้\s*)?(ใช้ไป|จ่ายไป|ใช้จ่าย|รายจ่าย)/i.test(t);
  const wantsIncome = /(รายรับ|รายได้|รับมา|ได้เงิน)/i.test(t);
  const mentionsMonth =
    /(เดือนนี้|เดือนที่แล้ว|เดือนก่อน|เดือนหน้า|เดือนถัดไป)/i.test(t) ||
    MONTH_NAMES_TH.some((m) => t.includes(m)) ||
    /\d{4}\s*-\s*\d{1,2}/.test(t) ||
    /\d{1,2}\s*\/\s*\d{4}/.test(t);

  if ((wantsBalance || wantsSpent || wantsIncome) && (isQuestion || wantsBalance)) {
    if (when) return { command: 'status_day', when, queryText: t };
    if (mentionsMonth) return { command: 'status_month', monthText: t, queryText: t };
    // default to current month if no explicit time specified
    return { command: 'status_month', monthText: 'เดือนนี้', queryText: t };
  }

  // transaction: จ่าย 120 ข้าวมันไก่  OR  รับ 500 เงินลูกค้า
  const m = t.match(/^(จ่าย|จ่่าย|จ|จ\.?)\s*([0-9,\.]+)\s*(.*)$/i) || t.match(/^(รับ|เรีัย|ร)\s*([0-9,\.]+)\s*(.*)$/i);
  if (m) {
    const verb = m[1];
    const amountStr = m[2];
    const note = (m[3] || '').trim();
    const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
    const type = /^(รับ|r|เรีัย|ร)$/i.test(verb) ? 'income' : 'expense';
    return { type, amount, note, typeExplicit: true, when };
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
    return { type: inferredIncome ? 'income' : 'expense', amount, note: t, typeExplicit: false, when };
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
    return null;
  }

  // expense
  if (has('ข้าว', 'ก๋วยเตี๋ยว', 'อาหาร', 'ข้าวมันไก่', 'หมูปิ้ง', 'ข้าวเหนียว', 'ส้มตำ', 'ผัด', 'แกง', 'ไก่', 'หมู', 'ปลา', 'กะเพรา', 'กระเพรา')) {
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

  return null;
}

function normalizeThaiForMatch(text) {
  const normalizeDigits = (s) => String(s || '').replace(/[๐-๙]/g, (ch) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)));
  return normalizeDigits(String(text || ''))
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    // remove numbers/currency tokens for matching category names
    .replace(/[0-9]/g, '')
    .replace(/บาท|฿/g, '')
    // keep Thai/English letters; drop punctuation/spaces
    .replace(/[^a-z\u0E00-\u0E7F]+/g, '');
}

async function findBestUserCategoryMatch({ userId, noteText, preferredType }) {
  if (!userId) return null;
  const needle = normalizeThaiForMatch(noteText);
  if (!needle) return null;

  const safePreferredType = preferredType === 'income' || preferredType === 'expense' ? preferredType : '';
  const cats = await Category.find({
    userId,
    ...(safePreferredType ? { type: safePreferredType } : { type: { $in: ['income', 'expense'] } }),
  })
    .select({ _id: 1, name: 1, type: 1 })
    .lean()
    .catch(() => []);

  let best = null;
  let bestScore = 0;
  for (const c of cats || []) {
    const name = String(c?.name || '').trim();
    if (!name) continue;
    const norm = normalizeThaiForMatch(name);
    if (!norm) continue;
    const hit = needle.includes(norm) || norm.includes(needle);
    if (!hit) continue;
    const score = norm.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

async function ensureUserCategory({ userId, type, name, icon }) {
  const safeType = type === 'income' ? 'income' : 'expense';
  const safeName = String(name || '').trim();
  if (!safeName) return null;
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

async function ensureOtherCategoryId({ userId, type } = {}) {
  if (!userId) return null;
  const safeType = type === 'income' ? 'income' : 'expense';
  const doc = await ensureUserCategory({ userId, type: safeType, name: 'อื่นๆ', icon: 'other' });
  return doc?._id || null;
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

  // Auto-unify: if the web OAuth user was created first (lineUserId exists) and the bot user
  // was created shortly after, unify them automatically when it's unambiguous.
  //
  // We can’t deterministically map lineUserId <-> lineMessagingUserId, so only do this when:
  // - exact same display name
  // - exactly 1 OAuth candidate within a short time window
  // - OAuth candidate has no data (no tx/categories/budgets)
  // This keeps the system “one user record” for most common flows without requiring the link code.
  try {
    const messagingName = String(user?.name || '').trim();
    const hasLineUserIdAlready = Boolean(String(user?.lineUserId || '').trim());
    if (messagingName && !hasLineUserIdAlready) {
      const since = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
      const candidates = await User.find({
        name: messagingName,
        lineUserId: { $exists: true, $ne: '' },
        lineMessagingUserId: { $exists: false },
        email: { $regex: /@line\.local$/i },
        createdAt: { $gte: since },
      }).sort({ createdAt: -1 }).limit(2);

      if (candidates.length === 1) {
        const oauthUser = candidates[0];
        const [txCount, catCount, budCount] = await Promise.all([
          Transaction.countDocuments({ userId: oauthUser._id }).catch(() => 0),
          Category.countDocuments({ userId: oauthUser._id }).catch(() => 0),
          Budget.countDocuments({ userId: oauthUser._id }).catch(() => 0),
        ]);
        const hasAnyData = (Number(txCount) + Number(catCount) + Number(budCount)) > 0;

        // Only merge if OAuth user is empty to avoid accidental merges.
        if (!hasAnyData) {
          await mergeUsers({ fromUserId: oauthUser._id, toUserId: user._id, deleteSource: true });
          user = await User.findById(user._id) || user;
        }
      }
    }
  } catch (e) {
    console.warn('LINE auto-unify oauth->messaging skipped:', e?.message || e);
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

  // Quick-note UI: only when user explicitly triggers the command (e.g., "จด", "จดรายการ")
  if (parsed && parsed.command === 'quick_note') {
    return sendReply(event.replyToken, buildQuickNoteFlexMessage());
  }

  // If user types 'ประกาศ', send a quick-reply URI that opens the LINE profile when tapped.
  // NOTE: the server cannot force the client to open a link automatically — user must tap the quick-reply button.
  const isAnnounce = /^\s*ประกาศ\s*$/i.test(text);
  if (isAnnounce) {
    return sendReply(event.replyToken, buildAnnounceFlexMessage());
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
    const helpText = [
      'คำสั่งตัวอย่าง:',
      '- จ่าย 120 ข้าวมันไก่',
      '- รับ 500 เงินลูกค้า',
      '',
      'ถามสถานะการเงิน:',
      '- วันนี้ใช้ไปเท่าไหร่',
      '- เมื่อวานใช้ไปเท่าไหร่',
      '- เดือนนี้ใช้ไปเท่าไหร่',
      '- ยอดคงเหลือเดือนนี้เท่าไหร่',
      '- ยอดคงเหลือ มีนาคม 2569',
      '',
      'บันทึกย้อนหลังได้:',
      '- เมื่อวาน จ่าย 50 กาแฟ',
      '- ย้อนหลัง 3 วัน รับ 2000 เงินลูกค้า',
      '- 01/03/2569 จ่าย 120 อาหาร',
      '- 2026-03-01 20:30 จ่าย 120 อาหาร',
      '',
      'สรุป:',
      '- สรุปวันนี้',
      '- สรุปเดือนนี้',
      '- export',
    ].join('\n');
    return sendReply(event.replyToken, { type: 'text', text: helpText });
  }

  const buildPeriodStatusReply = async ({ range, label, monthLabelForBudget } = {}) => {
    if (!range?.start || !range?.end) return { type: 'text', text: 'ขออภัย ผมหาช่วงวันที่ไม่เจอ' };

    const txAgg = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          datetime: { $gte: range.start, $lt: range.end },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]).catch(() => []);

    const income = (txAgg || []).find((r) => r?._id === 'income')?.total || 0;
    const expense = (txAgg || []).find((r) => r?._id === 'expense')?.total || 0;
    const txCount = (txAgg || []).reduce((s, r) => s + (Number(r?.count) || 0), 0);
    const remaining = (Number(income) || 0) - (Number(expense) || 0);

    const topExpenses = await getTopExpenseCategories({ userId: user._id, range, limit: 3 });

    let budgetTotal = null;
    let budgetRemaining = null;
    if (monthLabelForBudget) {
      budgetTotal = await getMonthBudgetTotal({ userId: user._id, monthLabel: monthLabelForBudget });
      if (Number.isFinite(Number(budgetTotal))) budgetRemaining = (Number(budgetTotal) || 0) - (Number(expense) || 0);
    }

    return buildFinanceStatusFlexMessage({
      label,
      range,
      income,
      expense,
      remaining,
      txCount,
      topExpenses,
      budgetTotal,
      budgetRemaining,
    });
  };

  if (parsed.command === 'status_day') {
    const when = parsed?.when instanceof Date && !Number.isNaN(parsed.when.getTime()) ? parsed.when : new Date();
    const range = getBangkokDayRange(when);
    const label = /เมื่อวาน/i.test(String(event?.message?.text || ''))
      ? 'เมื่อวาน'
      : 'วันนี้';
    return sendReply(event.replyToken, await buildPeriodStatusReply({ range, label }));
  }

  if (parsed.command === 'status_month') {
    const spec = parseMonthSpecifierFromText(parsed?.monthText || event?.message?.text || '');
    let range = null;
    let label = 'เดือนนี้';
    let budgetMonthLabel = null;

    if (spec?.kind === 'absolute') {
      const d = new Date(`${spec.year}-${String(spec.monthIndex + 1).padStart(2, '0')}-01T12:00:00+07:00`);
      range = getBangkokMonthRange(d);
      label = `${MONTH_NAMES_TH[spec.monthIndex] || ''} ${spec.year + 543}`;
      budgetMonthLabel = label;
    } else {
      const offset = spec?.kind === 'relative' ? (Number(spec.offset) || 0) : 0;
      const now = new Date();
      const bangkokMs = now.getTime() + 7 * 60 * 60 * 1000;
      const bd = new Date(bangkokMs);
      const year = bd.getUTCFullYear();
      const month = bd.getUTCMonth() + offset;
      const pivot = new Date(Date.UTC(year, month, 15, 12, 0, 0, 0) - 7 * 60 * 60 * 1000);
      range = getBangkokMonthRange(pivot);
      const b2 = new Date(pivot.getTime() + 7 * 60 * 60 * 1000);
      const y2 = b2.getUTCFullYear();
      const m2 = b2.getUTCMonth();
      const ymLabel = `${MONTH_NAMES_TH[m2] || ''} ${y2 + 543}`;
      label = offset === -1 ? `เดือนที่แล้ว (${ymLabel})` : offset === 1 ? `เดือนหน้า (${ymLabel})` : ymLabel;
      budgetMonthLabel = ymLabel;
    }

    return sendReply(event.replyToken, await buildPeriodStatusReply({ range, label, monthLabelForBudget: budgetMonthLabel }));
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
    // 1) Prefer matching an existing user-defined category name (works for custom income categories)
    try {
      const preferredType = parsed?.typeExplicit ? parsed.type : '';
      const matched = await findBestUserCategoryMatch({ userId: user._id, noteText: notesText, preferredType });
      if (matched?._id) {
        categoryId = matched._id;
        // Only override the parsed type when the user didn't explicitly say "จ่าย/รับ".
        if (!parsed?.typeExplicit && (matched?.type === 'income' || matched?.type === 'expense')) parsed.type = matched.type;
      }
    } catch (e) {
      console.warn('LINE category name match failed:', e?.message || e);
    }

    // 2) Otherwise, auto-categorize from keywords
    try {
      if (!categoryId) {
        const cat = classifyCategoryFromNote(notesText, parsed.type);
        if (cat && cat.name) {
          // Do NOT auto-create categories from LINE messages.
          // If the category doesn't exist, fall back to "อื่นๆ".
          const doc = await Category.findOne({ userId: user._id, type: parsed.type, name: String(cat.name).trim() })
            .select({ _id: 1 })
            .lean();
          categoryId = doc?._id || null;
        }
      }
    } catch (e) {
      console.warn('LINE auto-categorize failed:', e?.message || e);
    }

    // 3) Fallback: always map to "อื่นๆ" instead of leaving category blank (uncategorized)
    try {
      if (!categoryId) {
        categoryId = await ensureOtherCategoryId({ userId: user._id, type: parsed.type });
      }
    } catch (e) {
      console.warn('LINE other-category fallback failed:', e?.message || e);
    }
    // save transaction
    const txWhen = parsed?.when instanceof Date && !Number.isNaN(parsed.when.getTime()) ? parsed.when : new Date();
    const tx = new Transaction({
      userId: user._id,
      type: parsed.type,
      amount: parsed.amount,
      notes: notesText,
      note: notesText,
      categoryId,
      datetime: txWhen,
      source: 'text',
      rawMessage: event
    });
    await tx.save();
    let categoryName = '';
    let categoryIcon = '';
    try {
      if (categoryId) {
        const catDoc = await Category.findById(categoryId).select('name icon').lean();
        categoryName = String(catDoc?.name || '').trim();
        categoryIcon = String(catDoc?.icon || '').trim();
      }
    } catch {
      // ignore
    }
    if (!categoryName) categoryName = 'อื่นๆ';
    if (!categoryIcon) categoryIcon = 'other';

		    const flexMessage = buildRecordedSuccessFlexMessage({
		      txId: tx?._id,
		      type: parsed.type,
		      amount: parsed.amount,
		      categoryTotal: await sumCategoryTotalForMonth({ userId: user._id, categoryId, type: parsed.type, when: tx?.datetime || txWhen }),
		      note: notesText,
		      categoryName,
		      categoryIcon,
		      when: tx?.datetime || txWhen,
		      sourceLabel: 'ข้อความ',
		    });

    return sendReply(event.replyToken, flexMessage);
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

function parseSlipDateTimeToDate({ date, time } = {}) {
  const d = String(date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = String(time || '').trim();
  const hhmm = /^\d{2}:\d{2}$/.test(t) ? t : '00:00';
  const dt = new Date(`${d}T${hhmm}:00.000+07:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

async function handleImageEvent(event) {
  const lineMessagingUserId = event.source && event.source.userId;
  const pushTargetId = getPushTargetId(event.source);
  const messageId = event.message && event.message.id;
  if (!lineMessagingUserId || !pushTargetId || !messageId) {
    return sendReply(event.replyToken, { type: 'text', text: 'อ่านรูปไม่สำเร็จ (missing user/message id)' });
  }

  // Ack quickly, then OCR + save transaction asynchronously (replyToken can be used only once).
  await sendReply(event.replyToken, { type: 'text', text: 'รับรูปแล้ว กำลังอ่านสลิปด้วย AI ให้...' });

  (async () => {
    try {
      ensureClient();
      const { user } = await resolveMessagingUser(lineMessagingUserId);
      if (!user) {
        await pushToUser(pushTargetId, { type: 'text', text: 'ไม่พบบัญชีผู้ใช้ของคุณ' });
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
      const buf = await bufferFromStream(stream);
      const debugParse = String(process.env.LINE_IMAGE_DEBUG || '0') === '1';

      const parsed = await parseSlipImageBuffer({ buffer: buf, mimeType: contentType || 'image/jpeg' });
      const aiAmount = parsed?.amount;
      if (!(Number(aiAmount) > 0)) {
        await pushToUser(pushTargetId, { type: 'text', text: 'AI อ่านรูปได้ แต่ยังจับ “ยอดเงิน” ไม่เจอ ลองส่งรูปที่ชัดขึ้น/เต็มใบอีกครั้ง' });
        return;
      }

      const direction = String(parsed?.direction || 'unknown');
      const type = direction === 'in' ? 'income' : direction === 'out' ? 'expense' : 'expense';
      const whenFromSlip = parseSlipDateTimeToDate({ date: parsed?.date, time: parsed?.time });

      let note = String(parsed?.notes || '').trim() || 'สลิปโอนเงิน';
      const sender = String(parsed?.sender_name || '').trim();
      const recipient = String(parsed?.recipient_name || '').trim();
      const ref = String(parsed?.reference || '').trim();
      const noteBits = [
        note,
        sender ? `ผู้โอน: ${sender}` : null,
        recipient ? `ผู้รับ: ${recipient}` : null,
        ref ? `อ้างอิง: ${ref}` : null,
      ].filter(Boolean);
      note = noteBits.join(' • ').slice(0, 280);

      let categoryId = null;
      try {
        const cat = classifyCategoryFromNote(note, type);
        if (cat && cat.name) {
          // Do NOT auto-create categories from LINE messages.
          // If the category doesn't exist, fall back to "อื่นๆ".
          const doc = await Category.findOne({ userId: user._id, type, name: String(cat.name).trim() })
            .select({ _id: 1 })
            .lean();
          categoryId = doc?._id || null;
        }
      } catch (e) {
        console.warn('LINE slip AI auto-categorize failed:', e?.message || e);
      }

      try {
        if (!categoryId) {
          const catName = type === 'income' ? 'รับโอน/เงินเข้า' : 'โอนเงิน/ชำระเงิน';
          const doc = await Category.findOne({ userId: user._id, type, name: String(catName).trim() })
            .select({ _id: 1 })
            .lean();
          categoryId = doc?._id || null;
        }
      } catch (e) {
        console.warn('LINE slip AI category create failed:', e?.message || e);
      }

      try {
        if (!categoryId) {
          categoryId = await ensureOtherCategoryId({ userId: user._id, type });
        }
      } catch (e) {
        console.warn('LINE slip AI other-category fallback failed:', e?.message || e);
      }

      const tx = new Transaction({
        userId: user._id,
        type,
        amount: Number(aiAmount),
        notes: note,
        note,
        categoryId,
        datetime: whenFromSlip || new Date(),
        source: 'slip_ai',
        rawMessage: { event, parsed },
      });
      await tx.save();

      let categoryName = '';
      let categoryIcon = '';
      try {
        if (categoryId) {
          const catDoc = await Category.findById(categoryId).select('name icon').lean();
          categoryName = String(catDoc?.name || '').trim();
          categoryIcon = String(catDoc?.icon || '').trim();
        }
      } catch {
        // ignore
      }
      if (!categoryName) categoryName = 'อื่นๆ';
      if (!categoryIcon) categoryIcon = 'other';

	      const flexMessage = buildRecordedSuccessFlexMessage({
	        txId: tx?._id,
	        type,
	        amount: Number(aiAmount),
	        categoryTotal: await sumCategoryTotalForMonth({ userId: user._id, categoryId, type, when: tx?.datetime || new Date() }),
	        note,
	        categoryName,
	        categoryIcon,
	        when: tx?.datetime || new Date(),
	        sourceLabel: 'รูปภาพ (AI)',
	      });

      await pushToUser(pushTargetId, flexMessage);
      if (debugParse) {
        await pushToUser(pushTargetId, {
          type: 'text',
          text: `DEBUG(AI)\namount=${aiAmount} date=${parsed?.date || '-'} time=${parsed?.time || '-'} dir=${direction}`,
        });
      }
    } catch (e) {
      console.error('handleImageEvent error', e);
      const msg = buildAiUserErrorMessage(e);
      await pushToUser(pushTargetId, { type: 'text', text: `ขออภัย AI อ่านรูปไม่สำเร็จ: ${msg}\nแนะนำ: รูปชัด/ไม่เอียง/เต็มใบ` });
    }
  })();
}

async function handleAudioEvent(event) {
  const lineMessagingUserId = event.source && event.source.userId;
  const pushTargetId = getPushTargetId(event.source);
  const messageId = event.message && event.message.id;
  if (!lineMessagingUserId || !pushTargetId || !messageId) {
    return sendReply(event.replyToken, { type: 'text', text: 'ถอดเสียงไม่สำเร็จ (missing user/message id)' });
  }

  // Ack quickly, then transcribe + save transaction asynchronously.
  await sendReply(event.replyToken, { type: 'text', text: 'รับเสียงแล้ว กำลังถอดเสียงให้...' });

  (async () => {
    try {
      ensureClient();
      const { user } = await resolveMessagingUser(lineMessagingUserId);
      if (!user) {
        await pushToUser(pushTargetId, { type: 'text', text: 'ไม่พบบัญชีผู้ใช้ของคุณ' });
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
      const fileName = `line-audio-${Date.now()}-${messageId}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      const buf = await bufferFromStream(stream);
      fs.writeFileSync(filePath, buf);

      const keepAudio = String(process.env.KEEP_LINE_AUDIO || '1') !== '0';
      const backendBase = process.env.BACKEND_URL || 'http://localhost:5050';
      const audioUrl = `${backendBase}/uploads/line/audio/${encodeURIComponent(fileName)}`;
      const durationMs = Number(event?.message?.duration ?? 0) || 0;

      const tr = await transcribeAudioFile({ filePath, mimeType: contentType || 'audio/*', language: 'th' });
      if (!keepAudio) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }

      if (tr?.disabled) {
        const hint = tr?.hint ? `\nวิธีเปิดใช้งาน: ${String(tr.hint)}` : '';
        const msg = keepAudio
          ? `บันทึกเสียงไว้แล้ว แต่ยังถอดเสียงไม่ได้\nไฟล์เสียง: ${audioUrl}${hint}`
          : `ถอดเสียงยังไม่พร้อมใช้งาน${hint}`;
        await pushToUser(pushTargetId, { type: 'text', text: msg });
        return;
      }

      const transcript = String(tr?.text || '').trim();
      if (!transcript) {
        await pushToUser(pushTargetId, { type: 'text', text: 'ถอดเสียงไม่เจอข้อความ ลองอัดใหม่ให้ชัดขึ้นอีกนิดนะ' });
        return;
      }

      const parsed = parseTransactionText(transcript);
      if (!(parsed?.type && parsed?.amount)) {
        await pushToUser(pushTargetId, { type: 'text', text: `ผมได้ยินว่า: "${transcript}"\nแต่ยังจับ “จำนวนเงิน” ไม่ได้ ลองพูดแบบนี้:\n- จ่าย 107 ข้าวมันไก่\n- รับ 20000 เงินเดือน${extra}` });
        return;
      }

      const notesText = parsed.note || parsed.notes || transcript;

      let categoryId = null;
      try {
        const cat = classifyCategoryFromNote(notesText, parsed.type);
        if (cat && cat.name) {
          const doc = await Category.findOne({ userId: user._id, type: parsed.type, name: String(cat.name).trim() })
            .select({ _id: 1 })
            .lean();
          categoryId = doc?._id || null;
        }
      } catch (e) {
        console.warn('VOICE auto-categorize failed:', e?.message || e);
      }

      try {
        if (!categoryId) {
          categoryId = await ensureOtherCategoryId({ userId: user._id, type: parsed.type });
        }
      } catch (e) {
        console.warn('VOICE other-category fallback failed:', e?.message || e);
      }

      const txWhen = parsed?.when instanceof Date && !Number.isNaN(parsed.when.getTime()) ? parsed.when : new Date();
      const tx = new Transaction({
        userId: user._id,
        type: parsed.type,
        amount: parsed.amount,
        notes: notesText,
        note: notesText,
        categoryId,
        datetime: txWhen,
        source: 'voice',
        rawMessage: {
          event,
          transcript,
          stt: { provider: tr.provider, model: tr.model },
          audio: {
            url: keepAudio ? audioUrl : '',
            contentType: String(contentType || ''),
            durationMs,
          },
        },
      });
      await tx.save();
      let categoryName = '';
      let categoryIcon = '';
      try {
        if (categoryId) {
          const catDoc = await Category.findById(categoryId).select('name icon').lean();
          categoryName = String(catDoc?.name || '').trim();
          categoryIcon = String(catDoc?.icon || '').trim();
        }
      } catch {
        // ignore
      }
      if (!categoryName) categoryName = 'อื่นๆ';
      if (!categoryIcon) categoryIcon = 'other';

		      const flexMessage = buildRecordedSuccessFlexMessage({
		        txId: tx?._id,
		        type: parsed.type,
		        amount: parsed.amount,
		        categoryTotal: await sumCategoryTotalForMonth({ userId: user._id, categoryId, type: parsed.type, when: tx?.datetime || txWhen }),
		        note: notesText,
		        categoryName,
		        categoryIcon,
		        when: tx?.datetime || txWhen,
		        sourceLabel: 'เสียง (ถอดเสียง)',
		      });
      await pushToUser(pushTargetId, flexMessage);


    } catch (e) {
      console.error('handleAudioEvent error', e);
      await pushToUser(pushTargetId, { type: 'text', text: 'ขออภัย ถอดเสียงไม่สำเร็จ ลองใหม่อีกครั้ง' });
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
      return sendReply(event.replyToken, buildQuickNoteFlexMessage());
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
    const range = getBangkokDayRange(new Date());
    if (!range) return sendReply(event.replyToken, { type: 'text', text: 'ขออภัย ผมหาช่วงวันที่ไม่เจอ' });

    const txAgg = await Transaction.aggregate([
      { $match: { userId: user._id, datetime: { $gte: range.start, $lt: range.end } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).catch(() => []);

    const income = (txAgg || []).find((r) => r?._id === 'income')?.total || 0;
    const expense = (txAgg || []).find((r) => r?._id === 'expense')?.total || 0;
    const txCount = (txAgg || []).reduce((s, r) => s + (Number(r?.count) || 0), 0);
    const remaining = (Number(income) || 0) - (Number(expense) || 0);
    const topExpenses = await getTopExpenseCategories({ userId: user._id, range, limit: 3 });

    let aiSummary = '';
    try {
      const dateLabel = formatThaiDate(range.start) || 'วันนี้';
      aiSummary = await summarizeFinanceDay({
        language: 'th',
        dateLabel,
        income,
        expense,
        remaining,
        txCount,
        topExpenses,
      });
    } catch (e) {
      console.warn('AI daily finance summary failed', e);
      aiSummary = `AI ยังไม่พร้อม: ${buildAiUserErrorMessage(e)}`;
    }

    return sendReply(
      event.replyToken,
      buildFinanceStatusFlexMessage({
        label: 'วันนี้',
        range,
        income,
        expense,
        remaining,
        txCount,
        topExpenses,
        aiSummary,
      })
    );
  }

  if (actionValue === 'summary_month') {
    const now = new Date();
    const range = getBangkokMonthRange(now);
    if (!range) return sendReply(event.replyToken, { type: 'text', text: 'ขออภัย ผมหาช่วงวันที่ไม่เจอ' });

    // Bangkok month label for budget lookup
    const b2 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const y2 = b2.getUTCFullYear();
    const m2 = b2.getUTCMonth();
    const monthLabel = `${MONTH_NAMES_TH[m2] || ''} ${y2 + 543}`;

    const txAgg = await Transaction.aggregate([
      { $match: { userId: user._id, datetime: { $gte: range.start, $lt: range.end } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).catch(() => []);

    const income = (txAgg || []).find((r) => r?._id === 'income')?.total || 0;
    const expense = (txAgg || []).find((r) => r?._id === 'expense')?.total || 0;
    const txCount = (txAgg || []).reduce((s, r) => s + (Number(r?.count) || 0), 0);
    const remaining = (Number(income) || 0) - (Number(expense) || 0);
    const topExpenses = await getTopExpenseCategories({ userId: user._id, range, limit: 3 });

    const budgetTotal = await getMonthBudgetTotal({ userId: user._id, monthLabel });
    const budgetRemaining = Number.isFinite(Number(budgetTotal)) ? (Number(budgetTotal) || 0) - (Number(expense) || 0) : null;

    return sendReply(
      event.replyToken,
      buildFinanceStatusFlexMessage({
        label: monthLabel,
        range,
        income,
        expense,
        remaining,
        txCount,
        topExpenses,
        budgetTotal,
        budgetRemaining,
      })
    );
  }

  if (actionValue === 'help') {
    const helpText = 'คำสั่งตัวอย่าง:\n- จ่าย 120 ข้าวมันไก่\n- รับ 500 เงินลูกค้า\n- สรุปวันนี้\n- สรุปเดือนนี้\n- export';
    return sendReply(event.replyToken, { type: 'text', text: helpText });
  }

  if (actionValue === 'txn_delete') {
    let txnId = '';
    try {
      const params = new URLSearchParams(String(data || ''));
      txnId = String(params.get('id') || '').trim();
    } catch {
      txnId = '';
    }

    if (!txnId) return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบรหัสรายการที่ต้องการลบ' });

    const tx = await Transaction.findOne({ _id: txnId, userId: user._id }).select('type amount note notes datetime').lean();
    if (!tx) return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบรายการนี้ หรือคุณไม่มีสิทธิ์ลบ' });

    const noteText = String(tx?.notes || tx?.note || '').trim() || '-';
    const whenText = formatThaiDateTime(tx?.datetime) || '';
    const text = `ต้องการลบรายการนี้ใช่ไหม?\n${tx.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${formatThb(tx.amount)}\n${noteText}${whenText ? `\n${whenText}` : ''}`;

    return sendReply(event.replyToken, {
      type: 'template',
      altText: 'ยืนยันการลบรายการ',
      template: {
        type: 'confirm',
        text,
        actions: [
          { type: 'postback', label: 'ยืนยันลบ', data: `action=txn_delete_confirm&id=${encodeURIComponent(String(txnId))}` },
          { type: 'postback', label: 'ยกเลิก', data: 'action=txn_delete_cancel' },
        ],
      },
    });
  }

  if (actionValue === 'txn_delete_cancel') {
    return sendReply(event.replyToken, { type: 'text', text: 'ยกเลิกการลบแล้ว' });
  }

  if (actionValue === 'txn_delete_confirm') {
    let txnId = '';
    try {
      const params = new URLSearchParams(String(data || ''));
      txnId = String(params.get('id') || '').trim();
    } catch {
      txnId = '';
    }
    if (!txnId) return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบรหัสรายการที่ต้องการลบ' });

    const deleted = await Transaction.findOneAndDelete({ _id: txnId, userId: user._id }).lean();
    if (!deleted) return sendReply(event.replyToken, { type: 'text', text: 'ไม่พบรายการนี้ หรือถูกลบไปแล้ว' });

    return sendReply(event.replyToken, { type: 'text', text: 'ลบรายการเรียบร้อยแล้ว' });
  }

  if (actionValue === 'announce' || actionValue === 'ประกาศ') {
    return sendReply(event.replyToken, buildAnnounceFlexMessage());
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
