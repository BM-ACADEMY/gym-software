'use strict';
// Builds the gym and Afra sections of docs/marketing/WHATSAPP_TEMPLATE_BATCHES.md from the code (the source of truth), with sample values taken from the docs.
// Run: node marketing/gen_template_batches.js   (prints Markdown). Written 13 Nov 2026.
const fs = require('fs');
const gym = require('../server/config/whatsappTemplates.js'); const gymT = gym.TEMPLATES || gym;
const afraM = require('../packages/core-whatsapp/src/afraTemplates.js'); const afraT = afraM.AFRA_TEMPLATES || afraM.TEMPLATES || afraM;
const samples = {}; const cats = {};
for (const f of ['docs/WHATSAPP_TEMPLATES.md', 'docs/WHATSAPP_TEMPLATES_AFRA.md']) {
  const md = fs.readFileSync(f, 'utf8');
  md.split(/^## /m).slice(1).forEach((s) => { const n = s.split('\n')[0].trim(); const m = s.match(/Sample values for Meta: (.*)/); const c = s.match(/Category: ([A-Z]+)/); samples[n] = m ? m[1].trim().replace(/ \| /g, ' ; ') : '(none in doc)'; cats[n] = c ? c[1] : '?'; });
}
const arr = (t) => Array.isArray(t) ? t.map((v) => [v.name || v.key, v]) : Object.entries(t);
const section = (t) => arr(t).map(([n, v]) => `| \`${n}\` | ${cats[n]} | ${(v.params || []).map((p, i) => `{{${i + 1}}} ${p}`).join(', ')} | ${String(v.body || v.text).replace(/\|/g, '\\|')} | ${samples[n]} |`).join('\n');
const head = '| Name | Category | Variables | Text (exactly as the code sends it) | Sample values |\n| --- | --- | --- | --- | --- |\n';
console.log('GYM\n' + head + section(gymT) + '\nAFRA\n' + head + section(afraT));
