'use strict';
// Job card state machine: waiting -> washing -> ready -> delivered. A job can be cancelled before it is ready.
// Pure: the caller passes "now". Every change returns a NEW job; nothing is edited in place.
const STATES = ['waiting', 'washing', 'ready', 'delivered', 'cancelled'];
const NEXT = { waiting: ['washing', 'cancelled'], washing: ['ready', 'cancelled'], ready: ['delivered'], delivered: [], cancelled: [] };
const err = (code, message) => Object.assign(new Error(message), { code });
const STAMP = { washing: 'startedAt', ready: 'readyAt', delivered: 'deliveredAt', cancelled: 'cancelledAt' };

function newJob({ plate, klass, services = [], now }) {
  return { plate, klass, services, state: 'waiting', createdAt: now, attendantId: null };
}
function move(job, to, now, attendantId) {
  if (!STATES.includes(to)) throw err('JOB_STATE', 'Unknown state');
  if (!NEXT[job.state].includes(to)) throw err('JOB_STATE', `A ${job.state} job cannot go to ${to}`);
  if (to === 'washing' && !(attendantId || job.attendantId)) throw err('JOB_ATTENDANT', 'Choose who is washing it');
  return { ...job, state: to, [STAMP[to]]: now, attendantId: attendantId || job.attendantId };
}
// Minutes the job has been (or was) in the wash. Not started: 0. Delivered/ready: until readyAt.
const washMinutes = (job, now) => {
  if (!job.startedAt) return 0;
  const end = job.readyAt || job.cancelledAt || now;
  return Math.max(0, Math.round((new Date(end) - new Date(job.startedAt)) / 60000));
};
// Ready but not collected for a long time: the owner should phone (pickup delay watch).
const pickupDelayed = (job, now, limitMins = 120) => job.state === 'ready' && job.readyAt && (new Date(now) - new Date(job.readyAt)) / 60000 >= limitMins;
module.exports = { STATES, NEXT, newJob, move, washMinutes, pickupDelayed };
