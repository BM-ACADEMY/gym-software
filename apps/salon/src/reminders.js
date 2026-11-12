'use strict';
// Reminder suggestions for tomorrow's visits. Pure: no database, no clock, no sending.
// Only customers who agreed to be contacted (consent recorded, not on do-not-contact, not deleted) are listed.
// Nothing is sent: WhatsApp messages need approved templates (not yet approved), so the owner copies or taps the message herself.
const timeText = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function messageFor({ businessName, name, serviceName, date, start }) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  return `Hi ${first}, a reminder of your ${serviceName || 'visit'} at ${businessName} tomorrow (${date}) at ${timeText(start)}. If you need to change the time, please reply to this message.`;
}
// appointments: today's tomorrow list; customers: by id. Returns the list to show and how many were left out and why.
function suggestions({ businessName, date, appointments, customers }) {
  const byId = new Map((customers || []).map((c) => [String(c._id), c])); const list = []; let noConsent = 0;
  for (const a of (appointments || []).filter((x) => x && x.active !== false && x.status === 'booked' && x.date === date).sort((p, q) => p.start - q.start)) {
    const c = byId.get(String(a.customerId));
    if (!c || c.anonymisedAt || c.doNotContact || !(c.consent && c.consent.at)) { noConsent += 1; continue; }
    list.push({ appointmentId: String(a._id), customerId: String(c._id), name: c.name, phone: c.phone, date: a.date, start: a.start, time: timeText(a.start), serviceName: a.serviceName || '',
      message: messageFor({ businessName, name: c.name, serviceName: a.serviceName, date: a.date, start: a.start }), sent: false });
  }
  return { date, list, leftOut: noConsent, needsApprovedTemplate: true, note: 'Suggest only: nothing is sent from here. WhatsApp templates are not approved yet, so copy the message or send it yourself.' };
}
const waLink = (phone, message) => (/^[6-9]\d{9}$/.test(String(phone || '')) ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}` : null);
module.exports = { suggestions, messageFor, timeText, waLink };
