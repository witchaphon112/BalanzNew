const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

// Thai bank patterns for detection
const BANK_PATTERNS = {
  KBANK: { names: ['กสิกร', 'kbank', 'kasikorn', 'kasikornbank'], fullName: 'ธนาคารกสิกรไทย', color: '#138f2d' },
  SCB: { names: ['ไทยพาณิชย์', 'scb', 'siam commercial', 'scbeasy'], fullName: 'ธนาคารไทยพาณิชย์', color: '#4e2a84' },
  BBL: { names: ['กรุงเทพ', 'bbl', 'bangkok bank'], fullName: 'ธนาคารกรุงเทพ', color: '#1e3a8a' },
  KTB: { names: ['กรุงไทย', 'ktb', 'krungthai'], fullName: 'ธนาคารกรุงไทย', color: '#00a4e4' },
  BAY: { names: ['กรุงศรี', 'krungsri', 'bay', 'ayudhya'], fullName: 'ธนาคารกรุงศรีอยุธยา', color: '#ffc600' },
  TTB: { names: ['ttb', 'ทหารไทยธนชาต', 'tmbthanachart'], fullName: 'ธนาคารทหารไทยธนชาต', color: '#0066b3' },
  GSB: { names: ['ออมสิน', 'gsb', 'government savings'], fullName: 'ธนาคารออมสิน', color: '#e91e63' },
  BAAC: { names: ['ธกส', 'baac', 'เกษตร'], fullName: 'ธ.ก.ส.', color: '#4caf50' },
  GHB: { names: ['อาคารสงเคราะห์', 'ghb', 'ธอส'], fullName: 'ธนาคารอาคารสงเคราะห์', color: '#ff9800' },
  PROMPTPAY: { names: ['พร้อมเพย์', 'promptpay'], fullName: 'พร้อมเพย์', color: '#0052cc' },
};

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

// Preprocess image for better OCR
async function preprocessImage(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(2000, null, { withoutEnlargement: false, fit: 'inside' })
      .grayscale()
      .normalize()
      .sharpen()
      .threshold(180)
      .toFile(outputPath);
    return outputPath;
  } catch (error) {
    console.error('Image preprocessing error:', error);
    return inputPath;
  }
}

// Detect bank from text
function detectBank(text) {
  const lowerText = String(text || '').toLowerCase();
  for (const [code, bank] of Object.entries(BANK_PATTERNS)) {
    for (const name of bank.names) {
      if (lowerText.includes(String(name).toLowerCase())) {
        return { code, ...bank };
      }
    }
  }
  return null;
}

// Extract amount from text with improved accuracy
function extractAmount(text, lines) {
  const amountKeywords = ['จำนวนเงิน', 'จำนวน', 'amount', 'total', 'ยอดเงิน', 'ยอดโอน', 'โอนเงิน'];
  const excludeKeywords = ['ค่าธรรมเนียม', 'fee', 'ธรรมเนียม', 'รหัส', 'อ้างอิง', 'reference', 'balance', 'คงเหลือ'];

  let foundAmount = null;
  let confidence = 0;
  const safeLines = Array.isArray(lines) ? lines : [];
  const fullText = String(text || '');

  // Method 1: Look for amount keywords
  for (let i = 0; i < safeLines.length; i++) {
    const line = safeLines[i];
    const lowerLine = String(line || '').toLowerCase();

    const hasAmountKeyword = amountKeywords.some((k) => lowerLine.includes(k));
    const hasExcludeKeyword = excludeKeywords.some((k) => lowerLine.includes(k));

    if (hasAmountKeyword && !hasExcludeKeyword) {
      const amountMatch = String(line || '').match(/(\d{1,7}(?:[,\s]\d{3})*(?:\.\d{2})?)/);
      if (amountMatch) {
        const amount = amountMatch[1].replace(/[,\s]/g, '');
        const numAmount = parseFloat(amount);
        if (numAmount > 0 && numAmount <= 10000000) {
          foundAmount = amount;
          confidence = 0.9;
          break;
        }
      }

      for (let j = i + 1; j < Math.min(i + 4, safeLines.length); j++) {
        const nextLine = safeLines[j];
        const nextLower = String(nextLine || '').toLowerCase();
        if (excludeKeywords.some((k) => nextLower.includes(k))) continue;
        const nextMatch = String(nextLine || '').match(/^\s*(\d{1,7}(?:[,\s]\d{3})*(?:\.\d{2})?)\s*$/);
        if (nextMatch) {
          const amount = nextMatch[1].replace(/[,\s]/g, '');
          const numAmount = parseFloat(amount);
          if (numAmount > 0 && numAmount <= 10000000) {
            foundAmount = amount;
            confidence = 0.85;
            break;
          }
        }
      }
      if (foundAmount) break;
    }
  }

  // Method 2: Find standalone decimal numbers
  if (!foundAmount) {
    for (const line of safeLines) {
      const trimmed = String(line || '').trim();
      const match = trimmed.match(/^(\d{1,7}(?:[,\s]\d{3})*\.\d{2})$/);
      if (match) {
        const amount = match[1].replace(/[,\s]/g, '');
        const numAmount = parseFloat(amount);
        if (numAmount > 0 && numAmount <= 10000000) {
          foundAmount = amount;
          confidence = 0.7;
          break;
        }
      }
    }
  }

  // Method 3: Find largest reasonable number
  if (!foundAmount) {
    const allNumbers = fullText.match(/\b(\d{1,7}(?:[,\s]\d{3})*\.\d{2})\b/g);
    if (allNumbers) {
      const amounts = allNumbers
        .map((n) => ({ original: n, value: parseFloat(String(n).replace(/[,\s]/g, '')) }))
        .filter((n) => n.value > 0 && n.value < 1000000)
        .sort((a, b) => b.value - a.value);
      if (amounts.length > 0) {
        foundAmount = String(amounts[0].original).replace(/[,\s]/g, '');
        confidence = 0.5;
      }
    }
  }

  return { amount: foundAmount, confidence };
}

function extractDate(_text, lines) {
  const patterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{1,2})\s+(ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?)\s+(\d{2,4})/i,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{2,4})/i,
  ];
  const safeLines = Array.isArray(lines) ? lines : [];
  for (const line of safeLines) {
    for (const pattern of patterns) {
      const match = String(line || '').match(pattern);
      if (match) return match[0];
    }
  }
  return null;
}

function extractTime(_text, lines) {
  const safeLines = Array.isArray(lines) ? lines : [];
  for (const line of safeLines) {
    const match = String(line || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM|น\.))?/i);
    if (match) return match[0];
  }
  return null;
}

function extractRecipient(_text, lines) {
  const keywords = ['ผู้รับ', 'to', 'recipient', 'ไปยัง', 'payee', 'ชื่อ'];
  const safeLines = Array.isArray(lines) ? lines : [];
  for (let i = 0; i < safeLines.length; i++) {
    const line = safeLines[i];
    const lowerLine = String(line || '').toLowerCase();
    if (keywords.some((k) => lowerLine.includes(k))) {
      const nameMatch = String(line || '').match(/[ก-๙a-zA-Z\s]{3,40}/g);
      if (nameMatch) {
        for (const name of nameMatch) {
          const trimmed = String(name || '').trim();
          if (trimmed.length >= 3 && !keywords.some((k) => trimmed.toLowerCase().includes(k))) {
            return trimmed;
          }
        }
      }
      if (i + 1 < safeLines.length) {
        const nextLine = String(safeLines[i + 1] || '').trim();
        if (nextLine.length >= 3 && nextLine.length <= 40 && !/^\d+$/.test(nextLine)) return nextLine;
      }
    }
  }
  return null;
}

async function scanImageFile(originalPath, { cleanupOriginal = true } = {}) {
  const startTime = Date.now();
  const processedPath = originalPath.replace(/\.[^.]+$/, '-processed.png');

  await preprocessImage(originalPath, processedPath);

  const { data } = await Tesseract.recognize(processedPath, 'tha+eng', {
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    preserve_interword_spaces: '1',
  });

  const text = data.text || '';
  const lines = String(text).split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const fullText = String(text).toLowerCase();

  const transferKeywords = ['โอนเงิน', 'transfer', 'successful', 'สำเร็จ', 'จากบัญชี', 'ไปยังบัญชี'];
  const receiptKeywords = ['total', 'ยอดรวม', 'vat', 'receipt', 'ใบเสร็จ', 'tax'];
  const isTransferSlip = transferKeywords.some((k) => fullText.includes(k));
  const isReceipt = receiptKeywords.some((k) => fullText.includes(k));

  const bank = detectBank(text);
  const { amount, confidence: amountConfidence } = extractAmount(text, lines);
  const date = extractDate(text, lines);
  const time = extractTime(text, lines);
  const recipient = isTransferSlip ? extractRecipient(text, lines) : null;
  const processingTime = Date.now() - startTime;

  let documentType = 'unknown';
  if (isTransferSlip) documentType = 'transfer_slip';
  else if (isReceipt) documentType = 'receipt';

  const extraction = {
    documentType,
    bank: bank ? { code: bank.code, name: bank.fullName, color: bank.color } : null,
    amount: amount ? parseFloat(amount) : null,
    amountConfidence,
    date,
    time,
    recipient,
    rawText: text,
    lineCount: lines.length,
    processingTimeMs: processingTime,
  };

  safeUnlink(processedPath);
  if (cleanupOriginal) safeUnlink(originalPath);

  return {
    extraction,
    ocrConfidence: data.confidence,
    tesseractVersion: Tesseract.version,
  };
}

module.exports = {
  scanImageFile,
};

