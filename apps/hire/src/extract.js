'use strict';
// Reads text out of an uploaded resume (PDF or Word .docx). The two libraries are loaded only when needed so the
// rest of Hire works without them. Scanned (image-only) PDFs give no text: the recruiter is told to fill by hand.
const MAX_BYTES = 4 * 1024 * 1024;
const fail = (code, msg) => Object.assign(new Error(msg), { code });

function detectType(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx'; // zip; checked again by the reader
  return null;
}

function fromBase64(b64) {
  if (typeof b64 !== 'string' || !b64) throw fail('FILE_EMPTY', 'No file received.');
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  if (clean.length > Math.ceil(MAX_BYTES * 4 / 3) + 8) throw fail('FILE_TOO_BIG', 'File is larger than 4 MB.');
  const buf = Buffer.from(clean, 'base64');
  if (!buf.length) throw fail('FILE_EMPTY', 'No file received.');
  if (buf.length > MAX_BYTES) throw fail('FILE_TOO_BIG', 'File is larger than 4 MB.');
  return buf;
}

// deps lets tests pass fake readers. Real use leaves it empty.
async function extractText(buf, deps = {}) {
  const type = detectType(buf);
  if (!type) throw fail('FILE_TYPE', 'Only PDF and Word (.docx) files are accepted.');
  let text = '';
  try {
    if (type === 'pdf') { const pdf = deps.pdf || require('pdf-parse'); text = (await pdf(buf)).text; }
    else { const m = deps.mammoth || require('mammoth'); text = (await m.extractRawText({ buffer: buf })).value; }
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND') throw fail('READER_MISSING', 'File reading is not installed on the server yet.');
    throw fail('FILE_UNREADABLE', 'This file could not be read. Ask for another copy.');
  }
  text = String(text || '').replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 40) throw fail('FILE_NO_TEXT', 'No readable text found (maybe a scanned picture). Fill the candidate by hand or ask for a text version.');
  return { type, text };
}
module.exports = { detectType, fromBase64, extractText, MAX_BYTES };
