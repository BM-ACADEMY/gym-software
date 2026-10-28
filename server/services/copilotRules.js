// Renewal Copilot: pure rules (no database, no network, no AI). AI-01.
// Ranks which members the owner should contact today, explains why, and prepares the
// message in English, Tamil or Hindi. Tamil and Hindi wording needs a native-speaker review.
const DAY = 24 * 60 * 60 * 1000;

const KINDS = ['renew', 'lapsed', 'dues', 'absent'];

// Placeholders: {name} {gym} {days} {amount}
const TEMPLATES = {
  en: {
    renew: 'Hi {name}, your {gym} membership ends in {days} days. Renew now to keep your routine going. Reply here and we will help you.',
    lapsed: 'Hi {name}, we miss you at {gym}! Your membership ended {days} days ago. Come back this week and we will help you restart.',
    dues: 'Hi {name}, a gentle reminder: Rs {amount} is pending at {gym}. Please pay at the front desk or by UPI. Thank you!',
    absent: 'Hi {name}, we have not seen you at {gym} for {days} days. Is everything okay? Your next workout is waiting for you.',
  },
  ta: {
    renew: 'வணக்கம் {name}, உங்கள் {gym} உறுப்பினர் காலம் {days} நாட்களில் முடிகிறது. தொடர்ந்து பயிற்சி செய்ய இப்போதே புதுப்பிக்கவும். இங்கே பதில் அனுப்புங்கள், நாங்கள் உதவுவோம்.',
    lapsed: 'வணக்கம் {name}, {gym}-ல் உங்களை மிஸ் செய்கிறோம்! உங்கள் உறுப்பினர் காலம் {days} நாட்களுக்கு முன் முடிந்தது. இந்த வாரம் திரும்பி வாருங்கள், மீண்டும் தொடங்க உதவுவோம்.',
    dues: 'வணக்கம் {name}, {gym}-ல் ₹{amount} நிலுவையில் உள்ளது. முன் மேசையிலோ UPI மூலமாகவோ செலுத்தவும். நன்றி!',
    absent: 'வணக்கம் {name}, {days} நாட்களாக உங்களை {gym}-ல் காணவில்லை. எல்லாம் நலமா? உங்கள் அடுத்த பயிற்சி காத்திருக்கிறது.',
  },
  hi: {
    renew: 'नमस्ते {name}, आपकी {gym} की मेंबरशिप {days} दिन में खत्म हो रही है। वर्कआउट जारी रखने के लिए अभी रिन्यू करें। यहाँ जवाब दें, हम मदद करेंगे।',
    lapsed: 'नमस्ते {name}, {gym} में हम आपको याद कर रहे हैं! आपकी मेंबरशिप {days} दिन पहले खत्म हुई थी। इस हफ्ते वापस आइए, हम फिर से शुरू करने में मदद करेंगे।',
    dues: 'नमस्ते {name}, {gym} में ₹{amount} बाकी है। कृपया फ्रंट डेस्क पर या UPI से भुगतान करें। धन्यवाद!',
    absent: 'नमस्ते {name}, आप {days} दिन से {gym} नहीं आए। सब ठीक है? आपका अगला वर्कआउट इंतज़ार कर रहा है।',
  },
};

const template = (lang, kind) => (TEMPLATES[lang] || TEMPLATES.en)[kind];

const fill = (tpl, params = {}) =>
  String(tpl).replace(/\{(name|gym|days|amount)\}/g, (_, k) => (params[k] === undefined || params[k] === null ? '' : String(params[k])));

const placeholders = (text) => (String(text).match(/\{(?:name|gym|days|amount)\}/g) || []).sort();

// An AI-rewritten template is accepted only if it keeps exactly the same placeholders,
// contains no link, and stays short. Otherwise the caller keeps the original template.
const polishValid = (original, rewritten) => {
  if (typeof rewritten !== 'string') return false;
  const t = rewritten.trim();
  if (t.length < 20 || t.length > 600) return false;
  if (/https?:\/\/|www\./i.test(t)) return false;
  const a = placeholders(original);
  const b = placeholders(t);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

// Digits with country code for a wa.me link, or null if the number looks wrong.
const waNumber = (phone, country = 'IN') => {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (country === 'IN') {
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) d = `91${d}`;
  }
  return d.length >= 11 && d.length <= 15 ? d : null;
};

const waLink = (number, text) => (number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null);

// Score every reason a member has, keep the strongest as the main kind.
// input: { expiresAt, balance, overdueDays, absentDays, att14, attPrior }
const assess = (input, now = new Date()) => {
  const reasons = [];
  const found = [];
  const exp = input.expiresAt ? new Date(input.expiresAt) : null;

  if (exp) {
    const diff = exp.getTime() - now.getTime();
    if (diff > 0) {
      const days = Math.ceil(diff / DAY);
      if (days <= 14) {
        let score = days <= 7 ? 60 + (8 - days) * 3 : 35;
        const dropped = input.attPrior > 0 && input.att14 < input.attPrior * 0.5;
        if (dropped) score += 15;
        reasons.push(days === 1 ? 'Membership ends tomorrow' : `Membership ends in ${days} days`);
        if (dropped) reasons.push('Visits dropped in the last two weeks');
        found.push({ kind: 'renew', score, days });
      }
    } else {
      const since = Math.floor(-diff / DAY);
      if (since >= 1 && since <= 30) {
        found.push({ kind: 'lapsed', score: Math.max(20, Math.round(75 - since * 1.5)), days: since });
        reasons.push(`Membership ended ${since} days ago`);
      }
    }
  }
  if (input.balance > 0 && input.overdueDays > 0) {
    found.push({ kind: 'dues', score: Math.min(80, 40 + Math.min(Math.floor(input.balance / 100), 25) + Math.min(input.overdueDays, 15)), amount: Math.round(input.balance) });
    reasons.push(`Rs ${Math.round(input.balance)} pending for ${input.overdueDays} days`);
  }
  if (input.absentDays && input.absentDays >= 10) {
    found.push({ kind: 'absent', score: 30 + Math.min(input.absentDays, 30), days: input.absentDays });
    reasons.push(`No visit for ${input.absentDays} days`);
  }
  if (!found.length) return null;
  found.sort((a, b) => b.score - a.score);
  const main = found[0];
  return {
    kind: main.kind,
    score: Math.min(100, main.score + (found.length - 1) * 5),
    reasons,
    params: { days: main.days, amount: main.amount },
  };
};

module.exports = { DAY, KINDS, TEMPLATES, template, fill, placeholders, polishValid, waNumber, waLink, assess };
