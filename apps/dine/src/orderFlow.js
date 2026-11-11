'use strict';
// Table / KOT order state machine: open -> sent -> served -> billed -> paid. Pure and immutable: every function returns a
// new order and never changes the one it was given. Clock and ids are passed in, so tests are exact.
// order: { id, type: 'dine_in'|'takeaway'|'bar', table?, status, lines: [{ id, name, qty, unitPrice, gstRate, station, note, status: 'new'|'sent'|'served'|'void', voidReason? }], events: [] }
const STATUSES = ['open', 'sent', 'served', 'billed', 'paid'];
const TYPES = ['dine_in', 'takeaway', 'bar'];
const bad = (m, code = 'ORDER_INVALID') => { const e = new Error(m); e.code = code; throw e; };
const live = (o) => o.lines.filter((l) => l.status !== 'void');

const newOrder = ({ id, type = 'dine_in', table = null, by = null }, now) => {
  if (!TYPES.includes(type)) bad('Unknown order type.');
  if (type === 'dine_in' && !table) bad('A dine-in order needs a table.');
  return { id, type, table, status: 'open', lines: [], events: [{ at: now, by, what: 'open' }] };
};
const ev = (o, what, now, by, extra) => [...o.events, { at: now, by: by || null, what, ...(extra || {}) }];
const locked = (o) => o.status === 'billed' || o.status === 'paid';

// New lines are always 'new' (not yet sent to the kitchen or bar). Adding to a sent or served order is allowed: only the new lines go on the next KOT.
function addLine(o, line, now, by) {
  if (locked(o)) bad('This order is already billed. Reopen it to add items.');
  if (!line || !line.id || !Number.isInteger(line.unitPrice) || line.unitPrice < 0 || !Number.isInteger(line.qty) || line.qty < 1) bad('The line needs an id, a whole-rupee price and a quantity.');
  if (o.lines.some((l) => l.id === line.id)) bad('That line id is already used.');
  return { ...o, status: o.status === 'served' ? 'sent' : o.status, lines: [...o.lines, { ...line, status: 'new' }], events: ev(o, 'add', now, by, { line: line.id }) };
}
// Send every new line to its station. Returns { order, tickets: { kitchen: [...], bar: [...] } } so bar and kitchen print separately.
function sendKot(o, now, by) {
  if (locked(o)) bad('This order is already billed.');
  const fresh = o.lines.filter((l) => l.status === 'new');
  if (!fresh.length) bad('Nothing new to send.');
  const tickets = {};
  for (const l of fresh) (tickets[l.station || 'kitchen'] = tickets[l.station || 'kitchen'] || []).push({ id: l.id, name: l.name, qty: l.qty, note: l.note || '' });
  const lines = o.lines.map((l) => (l.status === 'new' ? { ...l, status: 'sent' } : l));
  return { order: { ...o, status: 'sent', lines, events: ev(o, 'kot', now, by, { count: fresh.length }) }, tickets };
}
// A line still 'new' can be removed without a trace. A line already sent is a VOID: it needs a reason and is counted for the leakage report.
function voidLine(o, lineId, { reason, by }, now) {
  if (locked(o)) bad('This order is already billed.');
  const l = o.lines.find((x) => x.id === lineId);
  if (!l || l.status === 'void') bad('Line not found.');
  const r = String(reason || '').trim();
  if (l.status !== 'new' && r.length < 3) bad('Write a reason (at least 3 characters) to void an item that was already sent.');
  const lines = o.lines.map((x) => (x.id === lineId ? { ...x, status: 'void', voidReason: r || null, wasSent: x.status !== 'new' } : x));
  return { ...o, lines, events: ev(o, 'void', now, by, { line: lineId, sent: l.status !== 'new', reason: r }) };
}
function markServed(o, lineIds, now, by) {
  if (locked(o)) bad('This order is already billed.');
  const ids = new Set(lineIds && lineIds.length ? lineIds : o.lines.filter((l) => l.status === 'sent').map((l) => l.id));
  if (![...ids].every((i) => o.lines.some((l) => l.id === i && l.status === 'sent'))) bad('Only sent items can be marked served.');
  const lines = o.lines.map((l) => (ids.has(l.id) ? { ...l, status: 'served' } : l));
  const allServed = live({ lines }).every((l) => l.status === 'served');
  return { ...o, status: allServed ? 'served' : 'sent', lines, events: ev(o, 'served', now, by) };
}
// Billing is allowed once nothing is waiting to be sent. Takeaway and bar tabs may be billed straight after the KOT.
function requestBill(o, now, by) {
  if (o.status === 'billed') return o;
  if (o.status === 'paid') bad('This order is already paid.');
  if (!live(o).length) bad('There is nothing to bill.');
  if (o.lines.some((l) => l.status === 'new')) bad('Send the new items to the kitchen first, or remove them.');
  return { ...o, status: 'billed', events: ev(o, 'bill', now, by) };
}
// The bill was not final (guest wants to add a dish): reopen needs a reason and is logged.
function reopen(o, { reason, by }, now) {
  if (o.status !== 'billed') bad('Only a billed order can be reopened.');
  if (String(reason || '').trim().length < 3) bad('Write a reason to reopen a bill.');
  return { ...o, status: 'sent', events: ev(o, 'reopen', now, by, { reason: String(reason).trim() }) };
}
function markPaid(o, now, by) {
  if (o.status !== 'billed') bad('Bill the order before taking payment.');
  return { ...o, status: 'paid', events: ev(o, 'paid', now, by) };
}
const counts = (o) => ({ voidsAfterSend: o.lines.filter((l) => l.status === 'void' && l.wasSent).length, reopens: o.events.filter((e) => e.what === 'reopen').length });
module.exports = { STATUSES, TYPES, newOrder, addLine, sendKot, voidLine, markServed, requestBill, reopen, markPaid, counts, live };
