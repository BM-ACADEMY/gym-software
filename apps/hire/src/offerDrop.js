'use strict';
// Simple rule flags, shown as warnings. This is NOT a prediction and must never be sold as one.
const HOUR = 3600e3;
function offerDropFlags(entry, now = new Date()) {
  if (!entry || entry.stage !== 'offer') return [];
  const flags = []; const t = new Date(now).getTime();
  const sinceReply = entry.lastCandidateReplyAt ? t - new Date(entry.lastCandidateReplyAt).getTime() : t - new Date(entry.stageAt).getTime();
  if (sinceReply >= 48 * HOUR) flags.push({ code: 'NO_REPLY_48H', text: 'No reply from the candidate for 48 hours after the offer' });
  if (entry.otherOffers) flags.push({ code: 'OTHER_OFFERS', text: 'Candidate mentioned other offers' });
  if (entry.noticeDays != null && entry.noticeDays > (entry.maxNoticeDays ?? 60)) flags.push({ code: 'LONG_NOTICE', text: 'Notice period is longer than the client wants' });
  if (entry.expectedCtc != null && entry.offeredCtc != null && entry.offeredCtc < entry.expectedCtc) flags.push({ code: 'BELOW_EXPECTED_PAY', text: 'Offer is below the pay the candidate expects' });
  return flags;
}
module.exports = { offerDropFlags };
