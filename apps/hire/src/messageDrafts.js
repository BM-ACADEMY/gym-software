'use strict';
// Message drafts for the recruiter to read and send THEMSELVES. SUGGEST ONLY: nothing here sends anything, and the system does not
// send candidate messages until the lawyer has approved the wording and the consent route (LAW-1). Pure.
const { istText } = require('./interviews');
const NOTE = 'Draft only. Nothing is sent from here. Read it, change it, and send it yourself. Automatic sending to candidates stays off until the lawyer approves the wording.';
// A candidate who withdrew consent, was removed, or must not be contacted gets no draft at all.
function candidateBlocked(c) {
  if (!c) return 'Candidate not found.'; if (c.anonymisedAt) return 'This person asked to be removed.'; if (c.doNotContact) return 'This person is marked do not contact.';
  if (c.consent && c.consent.withdrawnAt) return 'This person withdrew consent.'; if (!c.consent || !c.consent.source) return 'No consent on record yet. Send the consent form first.';
  return null;
}
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
function interviewReminder({ candidate, job, interview, agency }) {
  const why = candidateBlocked(candidate); if (why) return { blocked: why, sendable: false };
  const where = interview.mode === 'in_person' ? ('at ' + (interview.place || 'the office')) : interview.mode === 'video' ? 'on a video call' : 'on a phone call';
  return { sendable: false, note: NOTE, channel: 'recruiter sends', text: `Hello ${first(candidate.name)}, this is a reminder of your interview for ${job && job.title ? job.title : 'the role'} on ${istText(interview.at)} (IST), ${where}. Please reply to confirm.${agency ? ' - ' + agency : ''}` };
}
function feeReminder({ client, fee, agency }) {
  if (!client || !fee) return { blocked: 'Fee not found.', sendable: false }; if (fee.paidAt) return { blocked: 'This fee is already paid.', sendable: false };
  const due = fee.dueDate ? new Date(fee.dueDate).toISOString().slice(0, 10) : null;
  return { sendable: false, note: NOTE, channel: 'recruiter sends', text: `Hello ${first(client.contactName || client.name)}, a gentle reminder that our placement invoice of Rs ${fee.total} (including GST) ${due ? 'was due on ' + due : 'is due'}. Please let us know when it is paid.${agency ? ' - ' + agency : ''}` };
}
module.exports = { NOTE, candidateBlocked, interviewReminder, feeReminder };
