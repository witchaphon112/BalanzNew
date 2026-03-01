const fs = require('fs');
const path = require('path');
const { Blob } = require('buffer');

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function transcribeWithOpenAI({ filePath, mimeType, language = 'th' } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { text: '', provider: 'openai', disabled: true };
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
  const url = process.env.OPENAI_TRANSCRIBE_URL || 'https://api.openai.com/v1/audio/transcriptions';

  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], { type: mimeType || 'application/octet-stream' });
  const form = new FormData();
  form.append('model', model);
  if (language) form.append('language', language);
  form.append('file', blob, path.basename(filePath));

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS || 60000) || 60000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = safeJson(text) || {};
    if (!res.ok) {
      const msg = data?.error?.message || text || `OpenAI transcription failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return { text: String(data.text || '').trim(), provider: 'openai', model };
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeAudioFile({ filePath, mimeType, language } = {}) {
  // For now we support a single provider behind a stable interface.
  return transcribeWithOpenAI({ filePath, mimeType, language });
}

module.exports = { transcribeAudioFile };

