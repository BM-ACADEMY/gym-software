// Pure rules for the WhatsApp automations (no database, no network).
const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const istParts = (now) => {
  const d = new Date(now.getTime() + IST_OFFSET);
  return { hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
};

// Member messages only go out between 9:00 and 21:00 IST.
const inSendWindow = (now) => {
  const { hour } = istParts(now);
  return hour >= 9 && hour < 21;
};

const isSummaryHour = (now) => istParts(now).hour === 20;

// Midnight IST of the day containing `now`, as a UTC Date.
const istDayStart = (now) => {
  const shifted = new Date(now.getTime() + IST_OFFSET);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET);
};

// Which renewal message (if any) a membership ending at `expiresAt` needs right now.
const renewalStage = (expiresAt, now) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now.getTime();
  if (diff > 0) {
    const days = Math.ceil(diff / DAY);
    if (days === 30) return { stage: 'd30', template: 'gymdesk_renewal_reminder', days };
    if (days === 7) return { stage: 'd7', template: 'gymdesk_renewal_reminder', days };
    if (days === 1) return { stage: 'd1', template: 'gymdesk_renewal_reminder', days };
    return null;
  }
  const since = Math.floor(-diff / DAY);
  if (since === 1) return { stage: 'lapsed1', template: 'gymdesk_plan_expired', days: 0 };
  if (since === 7) return { stage: 'lapsed7', template: 'gymdesk_winback', days: 0 };
  return null;
};

const renewalKey = (memberId, expiresAt, stage) => `renewal:${memberId}:${new Date(expiresAt).toISOString().slice(0, 10)}:${stage}`;

// Overdue dues: first nudge once 1+ days late, then weekly, at most 4 messages.
const duesStage = (dueDate, now) => {
  const late = Math.floor((now.getTime() - new Date(dueDate).getTime()) / DAY);
  if (late < 1) return null;
  const week = Math.floor(late / 7);
  return week <= 3 ? { week, daysLate: late } : null;
};
const duesKey = (paymentId, week) => `dues:${paymentId}:w${week}`;

// Days absent, or null if the member is not yet absent enough.
const absenceDays = (lastCheckIn, joinedAt, now, threshold = 10) => {
  const ref = lastCheckIn || joinedAt;
  if (!ref) return null;
  const days = Math.floor((now.getTime() - new Date(ref).getTime()) / DAY);
  return days >= threshold ? days : null;
};
const absenceKey = (memberId, now) => `absence:${memberId}:${Math.floor(now.getTime() / (14 * DAY))}`;

const summaryKey = (subscriberId, now) => `summary:${subscriberId}:${istParts(now).date}`;

module.exports = {
  DAY, istParts, inSendWindow, isSummaryHour, istDayStart, renewalStage, renewalKey,
  duesStage, duesKey, absenceDays, absenceKey, summaryKey,
};
