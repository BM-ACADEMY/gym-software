#!/usr/bin/env node
'use strict';
// Writes docs/WHATSAPP_TEMPLATES_AFRA.md from packages/core-whatsapp/src/afraTemplates.js. Run: node scripts/gen-template-doc.js
const fs = require('fs'); const path = require('path');
const { TEMPLATES } = require('../packages/core-whatsapp/src/afraTemplates');
const doc = (check) => {
  const out = ['# WhatsApp templates: Afra to business owners (B2B), all products', '',
    'Generated from `packages/core-whatsapp/src/afraTemplates.js`. Do not edit by hand: change the code and run `node scripts/gen-template-doc.js`.',
    'Submit in WhatsApp Manager > Message templates, language English, body only (no header, footer or buttons). Name, wording and the order of {{1}}, {{2}} must match exactly.',
    'Sent from Afra\'s own business number to owners who signed up or asked to be contacted. Meta decides the final category; accept a re-label and tell Kamarudeen.', ''];
  for (const [name, t] of Object.entries(TEMPLATES)) {
    out.push(`## ${name}`, '', `- Category: ${t.category}`, `- Parameters in order: ${t.params.map((p, i) => `{{${i + 1}}} = ${p}`).join(', ')}`, '- Body:', '', `> ${t.body}`, '', `- Sample values for Meta: ${t.sample.join(' | ')}`, '');
  }
  return out.join('\n');
};
module.exports = { doc };
if (require.main === module) { fs.writeFileSync(path.join(__dirname, '../docs/WHATSAPP_TEMPLATES_AFRA.md'), doc()); console.log('written'); }
