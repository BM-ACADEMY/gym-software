'use strict';
// Customer CSV import with a preview (nothing is saved until the owner commits). Pure: the route supplies the phones
// that already exist. Parsing comes from packages/core-pos csvImport (Excel, Sheets, Vyapar and similar headers).
// Salon needs a phone for every customer, so a row without one is reported, not silently dropped.
const { csvImport } = (() => { try { return { csvImport: require('../../../packages/core-pos/src/csvImport') }; } catch (e) { return {}; } })();

function planImport({ text, existingPhones = new Set(), consentConfirmed = false }) {
  const parsed = csvImport.parseCustomers(text);
  const rows = []; let noPhone = 0; let debtSkipped = 0;
  for (const r of parsed.ok) {
    if (!r.phone) { noPhone += 1; parsed.errors.push({ row: r._row, message: 'Needs a phone number (every customer is found by phone).' }); continue; }
    if (r.credit > 0) debtSkipped += 1; // owed money is not imported: Salon records dues on bills, not on import
    const dup = existingPhones.has(r.phone);
    rows.push({ row: r._row, name: r.name, phone: r.phone, email: r.email, note: r.note, points: r.points || 0, status: dup ? 'duplicate' : 'new' });
  }
  const news = rows.filter((x) => x.status === 'new');
  return { rows, errors: parsed.errors, summary: { total: rows.length + parsed.errors.length - noPhone, new: news.length, duplicates: rows.length - news.length, invalid: parsed.errors.length, debtNotImported: debtSkipped, consentWillBeRecorded: consentConfirmed === true }, toCreate: news };
}
module.exports = { planImport };
