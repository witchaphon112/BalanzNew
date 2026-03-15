function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildPrompt({ language = 'th' } = {}) {
  const lang = String(language || 'th').trim().toLowerCase();
  if (lang === 'en') {
    return [
      'You are a personal finance assistant.',
      'Summarize the user’s finances for the given day using ONLY the provided data.',
      'Be concise and actionable.',
      '',
      'Output rules:',
      '- Plain text only (no markdown).',
      '- Max 4 short bullet lines, each starting with "- ".',
      '- Do not invent numbers or transactions.',
      '- Include exactly 1 practical suggestion at the end (also a bullet).',
    ].join('\n');
  }
  return [
    'คุณเป็นผู้ช่วยสรุปการเงินรายวัน',
    'สรุปการเงินของวันนั้นโดยใช้ “เฉพาะข้อมูลที่ให้มา” ห้ามแต่งตัวเลขเพิ่ม',
    'สั้น กระชับ และให้คำแนะนำที่ทำได้จริง',
    '',
    'กติกา output:',
    '- เป็นข้อความล้วน (ไม่ใช้ markdown)',
    '- ไม่เกิน 4 บรรทัด และแต่ละบรรทัดขึ้นต้นด้วย "- "',
    '- ต้องมีคำแนะนำที่ทำได้จริง “1 ข้อ” เป็นบรรทัดสุดท้าย',
  ].join('\n');
}

async function summarizeFinanceDay({
  language = 'th',
  dateLabel = '',
  income = 0,
  expense = 0,
  remaining = 0,
  txCount = 0,
  topExpenses = [],
  model,
} = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not set on the server');
    err.code = 'missing_openai_api_key';
    throw err;
  }

  const usedModel = model || process.env.OPENAI_FINANCE_SUMMARY_MODEL || 'gpt-4o-mini';
  const timeoutMs = Number(process.env.OPENAI_FINANCE_SUMMARY_TIMEOUT_MS || 20000) || 20000;

  const top = Array.isArray(topExpenses)
    ? topExpenses
        .filter(Boolean)
        .slice(0, 3)
        .map((x) => ({
          name: String(x?.categoryName || x?.name || '').trim(),
          total: Number(x?.total ?? x?.spent ?? x?.amount) || 0,
        }))
        .filter((x) => x.name && x.total > 0)
    : [];

  const userPayload = {
    dateLabel: String(dateLabel || '').trim(),
    income: Number(income) || 0,
    expense: Number(expense) || 0,
    remaining: Number(remaining) || 0,
    txCount: Number(txCount) || 0,
    topExpenses: top,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: usedModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildPrompt({ language }) },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
      signal: controller.signal,
    });

    const text = await resp.text();
    const data = safeJson(text) || {};
    if (!resp.ok) {
      const msg = data?.error?.message || text || `OpenAI finance summary failed (${resp.status})`;
      const err = new Error(msg);
      err.status = resp.status;
      err.payload = data;
      err.model = usedModel;
      throw err;
    }

    const content = String(data?.choices?.[0]?.message?.content || '').trim();
    return content;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { summarizeFinanceDay };

