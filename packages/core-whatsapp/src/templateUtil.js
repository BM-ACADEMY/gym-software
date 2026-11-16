'use strict';
// Works on any template set: { name: { params: [...], body: 'Hi {{1}} ...', category } }.
const get = (set, name) => { const t = set && set[name]; if (!t) throw new Error(`Unknown WhatsApp template ${name}`); return t; };
const render = (set, name, params = {}) => { const t = get(set, name); return t.body.replace(/{{(\d+)}}/g, (m, i) => String(params[t.params[Number(i) - 1]] ?? '')); };
const orderedParams = (set, name, params = {}) => get(set, name).params.map((k) => String(params[k] ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 200) || '-');
module.exports = { render, orderedParams };
