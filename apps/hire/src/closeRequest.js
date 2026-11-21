'use strict';
// Account-level delete request (the agency closes its account). The agency asks; we wait; then the account and its data are removed by the
// owner of the server. WAIT_DAYS is a draft default and an OWNER AND LAWYER DECISION (DECISIONS: open). Pure.
const WAIT_DAYS = 30;
function plan({ now = new Date(), waitDays = WAIT_DAYS, reason } = {}) {
  const at = new Date(now); const runOn = new Date(at.getTime() + waitDays * 864e5);
  return { requestedAt: at, deleteAfter: runOn, waitDays, reason: String(reason || '').trim().slice(0, 200), status: 'requested', note: `Your account and all its data will be deleted after ${runOn.toISOString().slice(0, 10)}. You can cancel before then. Download your data first.` };
}
const canCancel = (r, now = new Date()) => !!r && r.status === 'requested' && new Date(r.deleteAfter).getTime() > now.getTime();
module.exports = { WAIT_DAYS, plan, canCancel };
