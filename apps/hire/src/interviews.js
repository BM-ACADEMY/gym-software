'use strict';
// Interview scheduling. Pure checks. Times are stored as ISO instants; the screen shows IST.
const MODES = ['phone', 'video', 'in_person'];
const OK_STAGES = ['submitted', 'interview'];
const SLOT_MIN = 60;
function validInterview(b, { now = new Date() } = {}) {
  const at = new Date(b && b.at); if (!b || Number.isNaN(at.getTime())) return { error: 'Pick the interview date and time.' };
  if (at.getTime() < now.getTime() - 60000) return { error: 'That time has already passed.' };
  if (at.getTime() > now.getTime() + 180 * 864e5) return { error: 'Pick a date within the next 6 months.' };
  const mode = MODES.includes(b.mode) ? b.mode : null; if (!mode) return { error: 'Mode must be phone, video or in_person.' };
  const minutes = b.minutes === undefined ? 30 : b.minutes; if (!Number.isInteger(minutes) || minutes < 10 || minutes > 240) return { error: 'Length must be 10 to 240 minutes.' };
  return { value: { at, mode, minutes, note: String(b.note || '').trim().slice(0, 200), place: String(b.place || '').trim().slice(0, 120) } };
}
// A candidate cannot be in two interviews that overlap, and a stage gate: only submitted or interview entries.
function clash(existing, at, minutes) {
  const s = at.getTime(); const e = s + minutes * 60000;
  return (existing || []).some((x) => x.status === 'scheduled' && new Date(x.at).getTime() < e && new Date(x.at).getTime() + (x.minutes || 30) * 60000 > s);
}
const stageOk = (stage) => OK_STAGES.includes(stage);
const istText = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
module.exports = { MODES, OK_STAGES, SLOT_MIN, validInterview, clash, stageOk, istText };
