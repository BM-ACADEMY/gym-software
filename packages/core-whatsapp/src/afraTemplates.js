'use strict';
// Afra -> business owner messages (B2B), sent from Afra's own WhatsApp business number for every product.
// Source of truth for names, parameter order and wording. docs/WHATSAPP_TEMPLATES_AFRA.md is generated from this file
// (node scripts/gen-template-doc.js) and a test fails if they differ. Language en; Tamil/Hindi later with the same names plus _ta/_hi.
// Consent: only owners who signed up or asked to be contacted; stop at once on "stop". Quiet hours 9 pm to 8 am IST.
// Meta decides the category. Sample values are for the Meta form only (fake data).
const TEMPLATES = {
  afra_welcome: { category: 'UTILITY', params: ['name', 'product', 'trial_end', 'phone'], sample: ['Ravi', 'Fit', '12 Nov 2026', '9876543210'],
    body: 'Hi {{1}}, welcome to {{2}}. Your free trial has started and ends on {{3}}. Need help? Call {{4}}, Monday to Saturday, 10 am to 6 pm.' },
  afra_trial_ending: { category: 'UTILITY', params: ['name', 'product', 'days', 'end_date', 'phone'], sample: ['Ravi', 'Fit', '3', '12 Nov 2026', '9876543210'],
    body: 'Hi {{1}}, your {{2}} free trial ends in {{3}} day(s), on {{4}}. To keep your data and continue, choose a plan in the app. Help: {{5}}.' },
  afra_payment_received: { category: 'UTILITY', params: ['name', 'amount', 'product', 'invoice', 'paid_until'], sample: ['Ravi', '999', 'Fit', 'AV/2026-27/0007', '12 Dec 2026'],
    body: 'Hi {{1}}, we received Rs {{2}} for your {{3}} plan. Invoice {{4}}. Your plan is active until {{5}}. Thank you.' },
  afra_renewal_reminder: { category: 'UTILITY', params: ['name', 'product', 'days', 'end_date', 'phone'], sample: ['Ravi', 'Fit', '7', '12 Dec 2026', '9876543210'],
    body: 'Hi {{1}}, your {{2}} plan ends in {{3}} day(s), on {{4}}. Renew in the app to avoid a break. Help: {{5}}.' },
  afra_plan_expired: { category: 'UTILITY', params: ['name', 'product', 'grace_days', 'phone'], sample: ['Ravi', 'Fit', '3', '9876543210'],
    body: 'Hi {{1}}, your {{2}} plan has ended. You have {{3}} more day(s) before the account becomes read-only. Renew in the app. Help: {{4}}.' },
  afra_account_readonly: { category: 'UTILITY', params: ['name', 'product', 'end_date', 'phone'], sample: ['Ravi', 'Fit', '15 Dec 2026', '9876543210'],
    body: 'Hi {{1}}, your {{2}} account is now read-only because the plan ended on {{3}}. Your data is safe. Renew in the app to make changes again. Help: {{4}}.' },
  afra_refund_update: { category: 'UTILITY', params: ['name', 'amount', 'product', 'phone'], sample: ['Ravi', '999', 'Fit', '9876543210'],
    body: 'Hi {{1}}, your refund of Rs {{2}} for {{3}} is approved. It should reach you in 7 to 14 working days. Questions? Call {{4}}.' },
  afra_support_update: { category: 'UTILITY', params: ['name', 'ticket', 'status', 'phone'], sample: ['Ravi', 'T-1042', 'resolved', '9876543210'],
    body: 'Hi {{1}}, your support request {{2}} is now {{3}}. Reply here or call {{4}} if you need more help.' },
  afra_callback: { category: 'UTILITY', params: ['name', 'product', 'day', 'phone'], sample: ['Ravi', 'Fit', 'Friday', '9876543210'],
    body: 'Hi {{1}}, as you asked, our team will call you about {{2}} on {{3}} between 10 am and 6 pm. Another time suits you? Call {{4}}.' },
  afra_winback: { category: 'MARKETING', params: ['name', 'product', 'days', 'phone'], sample: ['Ravi', 'Fit', '30', '9876543210'],
    body: 'Hi {{1}}, your {{2}} account is paused and your data is saved for {{3}} more days. You can renew in the app any time, or call {{4}} and we will help.' },
};
const render = (name, params) => { const t = TEMPLATES[name]; if (!t) throw new Error(`Unknown WhatsApp template ${name}`); return t.body.replace(/{{(\d+)}}/g, (m, i) => String(params[t.params[Number(i) - 1]] ?? '')); };
const orderedParams = (name, params) => { const t = TEMPLATES[name]; if (!t) throw new Error(`Unknown WhatsApp template ${name}`); return t.params.map((k) => String(params[k] ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 200) || '-'); };
module.exports = { TEMPLATES, render, orderedParams };
