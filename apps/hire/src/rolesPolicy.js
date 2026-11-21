'use strict';
// Who may do what. admin = owner. subadmin = existing helper. recruiter = works candidates, jobs and pipeline only: no money, no exports, no settings, no team.
const ROLES = ['admin', 'subadmin', 'recruiter'];
const RECRUITER_BLOCKED = [/^\/fees(\/|$)/, /^\/accounts(\/|$)/, /^\/expenses(\/|$)/, /^\/export(\.|\/|$)/, /^\/audit(\/|$)/, /^\/team(\/|$)/, /^\/account(\/|$)/, /^\/autopilot\/settings(\/|$)/, /^\/forecast(\/|$)/, /^\/reports(\/|$)/, /^\/entries\/[^/]+\/fee(\/|$)/, /^\/candidates\/[^/]+\/(export|anonymise)(\/|$)/, /^\/clients\/[^/]+\/share-link(\/|$)/];
const recruiterBlocked = (path) => RECRUITER_BLOCKED.some((r) => r.test(String(path || '')));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validTeamMember(b) {
  const name = String((b && b.name) || '').trim(); const email = String((b && b.email) || '').trim().toLowerCase(); const password = String((b && b.password) || '');
  if (name.length < 2 || name.length > 120) return { error: 'Enter the recruiter name.' };
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 10) return { error: 'Password must be at least 10 characters.' };
  return { value: { name, email, password, role: 'recruiter' } };
}
module.exports = { ROLES, recruiterBlocked, validTeamMember };
