// WhatsApp message templates. Business-initiated WhatsApp messages MUST use
// templates approved by Meta. All 8 below are APPROVED (27 Nov 2026) in the AFRA Ventures
// WhatsApp account, language en; the text here is the approved text word for word.
// Category is what Meta approved: absence_checkin, plan_expired and winback are MARKETING
// (dearer, and Meta may cap how many one person gets a day); the rest are UTILITY.
// Names and parameter order must match exactly. {{1}}, {{2}} ... are filled from `params` in order.
// See docs/WHATSAPP_TEMPLATES.md.

const TEMPLATES = {
  gymdesk_renewal_reminder: {
    category: 'UTILITY',
    params: ['name', 'gym', 'days', 'phone'],
    body: 'Hi {{1}}, your membership at {{2}} ends in {{3}} day(s). Renew now to keep your access without a break. Questions? Call {{4}} for help.',
  },
  gymdesk_plan_expired: {
    category: 'MARKETING',
    params: ['name', 'gym', 'phone'],
    body: 'Hi {{1}}, your membership at {{2}} has ended. Renew to start training again. Call {{3}} and we will set it up for you.',
  },
  gymdesk_winback: {
    category: 'MARKETING',
    params: ['name', 'gym', 'phone'],
    body: 'Hi {{1}}, we miss you at {{2}}! Your membership ended recently. Come back this week and we will get you started again. Call {{3}} to book your visit.',
  },
  gymdesk_dues_reminder: {
    category: 'UTILITY',
    params: ['name', 'gym', 'amount', 'upi', 'phone'],
    body: 'Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. You can pay by UPI to {{4}}. Already paid? Please ignore this. Call {{5}} for help.',
  },
  gymdesk_absence_checkin: {
    category: 'MARKETING',
    params: ['name', 'gym', 'days'],
    body: 'Hi {{1}}, we have not seen you at {{2}} for {{3}} days. Everything okay? Your trainers are ready whenever you are.',
  },
  gymdesk_owner_daily_summary: {
    category: 'UTILITY',
    params: ['gym', 'checkins', 'collected', 'dues', 'renewals'],
    body: 'Daily summary for {{1}}: {{2}} check-ins today, Rs {{3}} collected, Rs {{4}} dues pending, {{5}} memberships ending in the next 7 days.',
  },
  gymdesk_owner_weekly_report: {
    category: 'UTILITY',
    params: ['gym', 'label', 'collected', 'newMembers', 'checkins', 'dues', 'step'],
    body: 'Weekly report for {{1}} ({{2}}): Rs {{3}} collected, {{4}} new members, {{5}} check-ins, Rs {{6}} dues pending. Next step: {{7}} Open GymDesk to see the full report.',
  },
  gymdesk_owner_monthly_report: {
    category: 'UTILITY',
    params: ['gym', 'label', 'collected', 'newMembers', 'checkins', 'dues', 'step'],
    body: 'Monthly report for {{1}} ({{2}}): Rs {{3}} collected, {{4}} new members, {{5}} check-ins, Rs {{6}} dues pending. Next step: {{7}} Open GymDesk to see the full report.',
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
