'use strict';
// Bay and queue timing, in whole minutes from midnight. Greedy: the next job goes to the bay that frees first.
// bays: [{ id, freeAt }]  queue: [{ id, mins }]  now: minutes. Returns when each queued job will start and be ready.
function schedule(bays, queue, now) {
  if (!Array.isArray(bays) || !bays.length) return { error: 'No bays set up' };
  const free = bays.map((b) => ({ id: b.id, at: Math.max(now, b.freeAt || 0) }));
  const out = [];
  for (const j of queue || []) {
    if (!Number.isInteger(j.mins) || j.mins < 1) return { error: 'Job time must be whole minutes' };
    free.sort((a, b) => a.at - b.at);
    const bay = free[0]; const start = bay.at; bay.at = start + j.mins;
    out.push({ id: j.id, bayId: bay.id, start, ready: bay.at });
  }
  return { plan: out };
}
// Idle minutes inside opening hours: open..close minus time covered by jobs (per bay, jobs may not overlap).
function idleMinutes(open, close, jobs) {
  let busy = 0;
  const sorted = (jobs || []).map((j) => [Math.max(open, j.start), Math.min(close, j.end)]).filter((j) => j[1] > j[0]).sort((a, b) => a[0] - b[0]);
  let curEnd = open;
  for (const [s, e] of sorted) { const from = Math.max(s, curEnd); if (e > from) { busy += e - from; curEnd = e; } }
  return Math.max(0, close - open) - busy;
}
// Which bay a job is in: a short label the owner chooses (Bay 1, A, Outside). Empty clears it. Letters, digits, space and dash only.
const BAY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,11}$/;
function checkBay(v) {
  if (v === undefined || v === null || v === '') return { value: undefined };
  const s = typeof v === 'string' ? v.trim() : '';
  return BAY.test(s) ? { value: s } : { error: 'A bay name is 1 to 12 letters, digits, spaces or dashes' };
}
module.exports = { schedule, idleMinutes, checkBay };
