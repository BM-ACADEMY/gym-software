// WhatsApp message templates. Business-initiated WhatsApp messages MUST use
// templates approved by Meta. The text below is what we submit for approval
// (category: UTILITY, language: en). Names and parameter order must match
// exactly what is approved. {{1}}, {{2}} ... are filled from `params` in order.
// See docs/WHATSAPP_TEMPLATES.md for the submission checklist.

const TEMPLATES = {
  gymdesk_renewal_reminder: {
    params: ['name', 'gym', 'days', 'phone'],
    body: 'Hi {{1}}, your membership at {{2}} ends in {{3}} day(s). Renew now to keep your access without a break. Questions? Call {{4}}.',
  },
  gymdesk_plan_expired: {
    params: ['name', 'gym', 'phone'],
    body: 'Hi {{1}}, your membership at {{2}} has ended. Renew to start training again. Call {{3}} and we will set it up for you.',
  },
  gymdesk_winback: {
    params: ['name', 'gym', 'phone'],
    body: 'Hi {{1}}, we miss you at {{2}}! Your membership ended a week ago. Come back this week and we will get you started again. Call {{3}}.',
  },
  gymdesk_dues_reminder: {
    params: ['name', 'gym', 'amount', 'upi', 'phone'],
    body: 'Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. You can pay by UPI to {{4}}. Already paid? Please ignore this. Call {{5}} for help.',
  },
  gymdesk_absence_checkin: {
    params: ['name', 'gym', 'days'],
    body: 'Hi {{1}}, we have not seen you at {{2}} for {{3}} days. Everything okay? Your trainers are ready whenever you are.',
  },
  gymdesk_owner_daily_summary: {
    params: ['gym', 'checkins', 'collected', 'dues', 'renewals'],
    body: 'Daily summary for {{1}}: {{2}} check-ins today, Rs {{3}} collected, Rs {{4}} dues pending, {{5}} memberships ending in the next 7 days.',
  },
};

const render = (name, params) => {
  const t = TEMPLATES[name];
  if (!t) throw new Error(`Unknown WhatsApp template ${name}`);
  return t.body.replace(/{{(\d+)}}/g, (m, i) => String(params[t.params[Number(i) - 1]] ?? ''));
};

// Ordered list of values for the Meta API from a params object.
const orderedParams = (name, params) => {
  const t = TEMPLATES[name];
  if (!t) throw new Error(`Unknown WhatsApp template ${name}`);
  return t.params.map((k) => String(params[k] ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 200) || '-');
};

module.exports = { TEMPLATES, render, orderedParams };
