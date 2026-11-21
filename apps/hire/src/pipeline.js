'use strict';
const { err } = require('./candidate');
const STAGES = ['sourced', 'screened', 'submitted', 'interview', 'offer', 'joined', 'dropped'];
const NEXT = {
  sourced: ['screened', 'dropped'],
  screened: ['submitted', 'dropped'],
  submitted: ['interview', 'screened', 'dropped'],
  interview: ['offer', 'submitted', 'dropped'],
  offer: ['joined', 'interview', 'dropped'],
  joined: [],        // terminal; starts the placement fee
  dropped: ['sourced'], // reopen only by explicit action, audited by the caller
};
function canMove(from, to) { return !!NEXT[from] && NEXT[from].includes(to); }
function move(entry, to, { at = new Date(), by, reason } = {}) {
  if (!STAGES.includes(to)) throw err('PIPELINE_STAGE', 'unknown stage');
  if (!canMove(entry.stage, to)) throw err('PIPELINE_TRANSITION', `cannot move ${entry.stage} to ${to}`);
  if (to === 'dropped' && !reason) throw err('PIPELINE_REASON', 'a reason is needed to drop a candidate');
  const history = [...(entry.history || []), { from: entry.stage, to, at: new Date(at).toISOString(), by: by || null, reason: reason || null }];
  return { ...entry, stage: to, stageAt: new Date(at).toISOString(), history };
}
module.exports = { STAGES, canMove, move };
