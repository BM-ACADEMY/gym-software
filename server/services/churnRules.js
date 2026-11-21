// Churn risk with reasons, and the win-back sequence (AI-04). Pure rules: no database, no network, no AI, free, same answer every time.
// Risk is only worked out for members who are still paid up. The reasons are plain sentences the owner can act on.
// A win-back sequence is three gentle messages after a membership ends; each step is SUGGESTED to the owner (one tap opens WhatsApp).
// Nothing is sent automatically: auto-sending needs Meta-approved templates and the autopilot guards (packages/core-autopilot), which are not switched on.
const DAY = 86400000;
const WINBACK_STEPS = [{ step: 1, fromDay: 1 }, { step: 2, fromDay: 5 }, { step: 3, fromDay: 14 }];
const WINBACK_LAST_DAY = 30;
const WINBACK_TEXT = {
  1: 'Hi {name}, we miss you at {gym}! Your membership ended {days} days ago. Come back this week and we will help you restart.',
  2: 'Hi {name}, your spot at {gym} is still here. Even two visits a week bring the habit back. Want us to set up your restart?',
  3: 'Hi {name}, one last friendly note from {gym}. If now is not the right time, no problem. Whenever you are ready, we are here.',
};

// input: { expiresAt, createdAt, absentDays, att14, attPrior, balance, overdueDays }
// Returns null (no meaningful risk) or { level: 'high'|'medium', score, reasons: [..] }.
function risk(input, now = new Date()) {
  const exp = input.expiresAt ? new Date(input.expiresAt) : null;
  if (!exp || exp <= now) return null; // lapsed members are handled by the win-back sequence
  let score = 0; const reasons = [];
  const prior = input.attPrior || 0, recent = input.att14 || 0;
  if (prior >= 2 && recent === 0) { score += 40; reasons.push('No visits in the last two weeks, after coming regularly before'); }
  else if (prior >= 2 && recent < prior * 0.5) { score += 25; reasons.push('Visits dropped by half or more in the last two weeks'); }
  if (input.absentDays >= 10) { score += Math.min(30, 10 + input.absentDays); reasons.push(`No visit for ${input.absentDays} days`); }
  const tenure = input.createdAt ? Math.floor((now - new Date(input.createdAt)) / DAY) : null;
  if (tenure !== null && tenure <= 45 && tenure >= 14 && recent < 4) { score += 25; reasons.push('New member who has not built a routine yet'); }
  const left = Math.ceil((exp - now) / DAY);
  if (left <= 14) { score += 15; reasons.push(left === 1 ? 'Membership ends tomorrow' : `Membership ends in ${left} days`); }
  if (input.balance > 0 && input.overdueDays > 0) { score += 15; reasons.push(`Rs ${Math.round(input.balance)} pending for ${input.overdueDays} days`); }
  if (score < 35) return null;
  return { level: score >= 60 ? 'high' : 'medium', score: Math.min(100, score), reasons };
}

// daysSinceLapsed: whole days since the membership ended. doneSteps: steps the owner already marked done (1, 2, 3).
// Returns { step, days } for the next step that is due, or null (too early, finished, or too long ago).
function winBackDue(daysSinceLapsed, doneSteps = []) {
  if (!Number.isFinite(daysSinceLapsed) || daysSinceLapsed < 1 || daysSinceLapsed > WINBACK_LAST_DAY) return null;
  const maxDone = Math.max(0, ...doneSteps); // once a later step is done, earlier ones are never shown again
  const due = WINBACK_STEPS.filter((s) => daysSinceLapsed >= s.fromDay && s.step > maxDone);
  if (!due.length) return null;
  // Show only the latest due step; an older missed step is skipped rather than stacked.
  return { step: due[due.length - 1].step, days: daysSinceLapsed };
}
// Tamil and Hindi have only the existing 'lapsed' wording (native review pending), so those languages reuse it for every step.
const winBackTemplate = (step, lang, lapsedTemplate) => (lang === 'en' ? WINBACK_TEXT[step] : lapsedTemplate);
module.exports = { DAY, WINBACK_STEPS, WINBACK_TEXT, WINBACK_LAST_DAY, risk, winBackDue, winBackTemplate };
