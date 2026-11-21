const Admin = require('../models/Admin');
const Subscriber = require('../models/Subscriber');
const Ticket = require('../models/Ticket');
const SupportMessage = require('../models/SupportMessage');
const { sendText, normalizePhone } = require('../utils/whatsapp');
const ai = require('./aiAssist');

const DAY = 86400000;
const MAX_BOT_REPLIES_PER_DAY = 20;
const product = () => process.env.PRODUCT_NAME || 'GymDesk';

const HANDOVER_WORDS = /\b(agent|human|person|someone|staff|call me|speak|talk to|complaint|refund|not working|urgent|help me|support team)\b/i;

// Pure: does this message ask for a person?
const wantsHuman = (text) => HANDOVER_WORDS.test(String(text || ''));

// Pure: pull plain text messages out of Meta's webhook payload.
const extractMessages = (body) => {
  const out = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      for (const m of change.value?.messages || []) {
        out.push({ id: m.id, from: m.from, type: m.type, text: m.type === 'text' ? String(m.text?.body || '').slice(0, 1000) : null });
      }
    }
  }
  return out;
};

// The last 10 digits identify an Indian mobile whatever the stored format is.
const tail10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const findOwner = async (from) => {
  const t = tail10(from);
  if (t.length < 10) return null;
  const admin = await Admin.findOne({ phone: { $regex: `${t}$` } }).select('name phone subscriberId email');
  return admin || null;
};

const reply = async (phone, subscriberId, text, extra = {}) => {
  const r = await sendText({ to: phone, text });
  await SupportMessage.create({ phone, subscriberId, direction: 'out', text, ...extra });
  return r;
};

// Handles ONE inbound message. Never throws.
const handleInbound = async (msg, now = new Date()) => {
  try {
    const phone = normalizePhone(msg.from) || String(msg.from);
    try {
      await SupportMessage.create({ phone, direction: 'in', text: msg.text || `[${msg.type}]`, messageId: msg.id });
    } catch (err) {
      if (err.code === 11000) return 'duplicate';
      throw err;
    }

    const owner = await findOwner(msg.from);
    const subscriberId = owner?.subscriberId;
    if (subscriberId) await SupportMessage.updateMany({ phone, subscriberId: { $exists: false } }, { $set: { subscriberId } });

    // After a hand-over the person replies from the WhatsApp Business inbox; the bot stays quiet for a day.
    const recentHandover = await SupportMessage.findOne({ phone, handover: true, createdAt: { $gte: new Date(now.getTime() - DAY) } });
    if (recentHandover) return 'quiet_after_handover';

    const botToday = await SupportMessage.countDocuments({ phone, direction: 'out', createdAt: { $gte: new Date(now.getTime() - DAY) } });
    if (botToday >= MAX_BOT_REPLIES_PER_DAY) return 'rate_limited';

    if (!owner) {
      await reply(phone, undefined, `Hi! This is the ${product()} support line for gym owners. To try ${product()} free for 14 days, visit our website. If you already have an account, please message from the phone number you registered with.`);
      return 'unknown_number';
    }

    if (msg.type !== 'text' || !msg.text) {
      await reply(phone, subscriberId, 'I can read text messages only. Please type your question.');
      return 'non_text';
    }

    const sub = await Subscriber.findById(subscriberId);

    if (wantsHuman(msg.text)) return handover(owner, sub, phone, msg.text);

    const out = await ai.ask(sub, msg.text, now);
    const hasAnswer = out.status === 200 && out.data.articles.length > 0;
    if (!hasAnswer) return handover(owner, sub, phone, msg.text, true);

    const body = out.data.source === 'ai'
      ? out.data.answer
      : out.data.answer.split('\n\n')[0].slice(0, 700);
    await reply(phone, subscriberId, `${body}\n\nReply AGENT any time to talk to a person.`);
    return out.data.source === 'ai' ? 'answered_ai' : 'answered_articles';
  } catch (err) {
    console.error('Support bot failed:', err.message);
    return 'error';
  }
};

// Creates (or reuses) one open ticket and tells the owner a person will reply.
const handover = async (owner, sub, phone, text, notSure = false) => {
  let ticket = await Ticket.findOne({ subscriberId: owner.subscriberId, raisedByAdminId: owner._id, status: { $in: ['open', 'in_progress'] }, subject: /^WhatsApp:/ }).sort({ createdAt: -1 });
  if (!ticket) {
    ticket = await Ticket.create({
      subscriberId: owner.subscriberId, raisedByAdminId: owner._id,
      subject: `WhatsApp: ${String(text).replace(/\s+/g, ' ').slice(0, 80)}`,
      description: `From ${owner.name || 'owner'} (${phone}) at ${sub?.gymName || 'unknown gym'}, via WhatsApp:\n\n${String(text).slice(0, 1000)}`,
    });
  }
  await reply(phone, owner.subscriberId, `${notSure ? 'I am not sure about that one. ' : ''}I have passed this to our team. A person will reply here on WhatsApp or by email. Your request number is ${String(ticket._id).slice(-6).toUpperCase()}.`, { handover: true });
  return 'handover';
};

module.exports = { wantsHuman, extractMessages, tail10, handleInbound, handover };
