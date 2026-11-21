'use strict';
// AP-02 (Hire): ideas for the agency owner to attract candidates and clients. Pure rules: no database, no AI, no sending.
// Every idea is a draft the owner copies and posts herself/himself. Level is always "suggest". No candidate is contacted from here.
const DAY = 864e5;

// data: { jobs:[{id,title,location,status,createdAt,lastSubmissionAt}], entries:[{jobId,stage}], clients:[{id,name}] }
function buildIdeas(data, now = new Date()) {
  if (!data) return [];
  const t = new Date(now).getTime(); const ideas = []; const jobs = data.jobs || []; const entries = data.entries || [];
  const open = jobs.filter((j) => j.status === 'open');
  const count = (id) => entries.filter((e) => String(e.jobId) === String(id)).length;
  const thin = open.filter((j) => count(j.id) < 3 && (t - new Date(j.createdAt || t).getTime()) / DAY >= 2).sort((a, b) => count(a.id) - count(b.id));
  if (thin.length) { const j = thin[0];
    ideas.push({ kind: 'post_job', ref: String(j.id), title: `Post the "${j.title}" job to attract candidates`, why: `Only ${count(j.id)} candidate(s) in the pipeline.`,
      draft: `We are hiring: ${j.title}${j.location ? ' in ' + j.location : ''}. Interested? Send your resume on WhatsApp or message us. (Check the client allows naming the role before you post.)` }); }
  const stale = open.filter((j) => j.lastSubmissionAt && (t - new Date(j.lastSubmissionAt).getTime()) / DAY >= 7);
  if (stale.length) ideas.push({ kind: 'client_update', title: 'Send your client a short update', why: `${stale.length} open job(s) with no profile sent for 7+ days.`,
    draft: 'Hello, a quick update on the open role: we are searching and will share new profiles this week. Tell us if the requirement has changed.' });
  const busy = new Set(open.map((j) => String(j.clientId)));
  const idle = (data.clients || []).filter((c) => !busy.has(String(c.id)));
  if (idle.length) ideas.push({ kind: 'client_checkin', title: `Check in with ${idle[0].name}`, why: `${idle.length} client(s) have no open job.`,
    draft: `Hello, any new hiring plans this month? We can send the first profiles within a few days.` });
  return ideas.slice(0, 3).map((i) => ({ ...i, level: 'suggest' }));
}
module.exports = { buildIdeas };
