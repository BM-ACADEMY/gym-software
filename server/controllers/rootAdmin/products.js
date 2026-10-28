// Product launch tracker for Super Admin. Read-only: Claude updates server/data/productStatus.json each session.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../data/productStatus.json');
const CONFIDENCE = ['low', 'medium', 'high'];

// Pure: adds progress counts and a days-left figure. today is a Date, so tests do not depend on the clock.
exports.shape = (raw, today = new Date()) => {
  const products = (raw.products || []).map((p) => {
    const list = p.launchChecklist || [];
    const doneCount = list.filter((c) => c.done).length;
    const days = p.targetDate ? Math.ceil((new Date(`${p.targetDate}T00:00:00Z`) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000) : null;
    return { ...p, confidence: CONFIDENCE.includes(p.confidence) ? p.confidence : 'low', checklistDone: doneCount, checklistTotal: list.length, daysToTarget: days };
  });
  return { updatedAt: raw.updatedAt, note: raw.note, products };
};

exports.getProducts = (req, res) => {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    res.json({ success: true, data: exports.shape(raw) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not read the product status file.' });
  }
};
