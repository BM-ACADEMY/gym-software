'use strict';
// Ported from afraventurepvt-create/payroll. GymDesk uses it with ESI and PF OFF (the default).
// Statutory options stay in the engine but are not exposed in the GymDesk screens.
/**
 * GymDesk payroll engine (ported from TeamPulse) - pure functions, no database, no I/O.
 *
 * All money is whole rupees (integers). All rates are BASIS POINTS (1 bp = 0.01%) so the
 * arithmetic stays exact: 0.75% = 75, 3.25% = 325, 12% = 1200. No floating-point drift.
 *
 * ESI and PF are OFF by default and switched on per company. A company that never enables
 * them gets the Phase 1 formula:   net = gross - LOP - advance recovery.
 *
 * IMPORTANT: statutory defaults below reflect the commonly published rules. They are
 * configurable precisely because rules change - confirm them with your CA before a client
 * relies on them, and never describe this as filing software. It calculates; it does not file.
 */

const DEFAULTS = Object.freeze({
  workingDays: 26,
  basicPercent: 50,
  esi: Object.freeze({
    enabled: false,
    employeeBp: 75,      // 0.75% of earned gross
    employerBp: 325,     // 3.25% of earned gross
    wageCeiling: 21000,  // ESI applies only while contractual monthly gross <= this
  }),
  pf: Object.freeze({
    enabled: false,
    employeeBp: 1200,    // 12% of PF wage
    employerBp: 1200,    // 12% (EPF + EPS) of PF wage
    adminBp: 50,         // 0.5% EPF admin charge (employer cost)
    edliBp: 50,          // 0.5% EDLI (employer cost)
    wageCeiling: 15000,  // PF wage capped at this when applyCeiling is true
    applyCeiling: true,
  }),
});

const ceilDiv = (n, d) => Math.floor((n + d - 1) / d);
const roundDiv = (n, d) => Math.floor((2 * n + d) / (2 * d)); // round half up
const bp = (amount, rate) => amount * rate; // numerator; divide by 10000 at the call site

function isInt(n) { return Number.isInteger(n); }

/** Merge a company's saved payroll settings over the defaults and validate them. */
function resolveConfig(company = {}) {
  const c = {
    workingDays: company.workingDays ?? DEFAULTS.workingDays,
    basicPercent: company.basicPercent ?? DEFAULTS.basicPercent,
    esi: { ...DEFAULTS.esi, ...(company.esi || {}) },
    pf: { ...DEFAULTS.pf, ...(company.pf || {}) },
  };
  if (!isInt(c.workingDays) || c.workingDays < 1 || c.workingDays > 31) throw new RangeError('workingDays must be a whole number from 1 to 31');
  if (!(c.basicPercent > 0 && c.basicPercent <= 100)) throw new RangeError('basicPercent must be between 1 and 100');
  for (const [k, section] of [['esi', c.esi], ['pf', c.pf]]) {
    for (const f of Object.keys(section)) {
      if (f.endsWith('Bp') && !(isInt(section[f]) && section[f] >= 0 && section[f] <= 10000)) throw new RangeError(`${k}.${f} must be basis points from 0 to 10000`);
      if (f === 'wageCeiling' && !(isInt(section[f]) && section[f] > 0)) throw new RangeError(`${k}.wageCeiling must be a positive whole number`);
    }
  }
  return c;
}

/**
 * @param {object} input
 * @param {number} input.gross          contractual monthly gross, whole rupees
 * @param {number} [input.basic]        basic pay; defaults to basicPercent of gross
 * @param {number} [input.lopDays=0]    loss-of-pay days (halves allowed: 0.5)
 * @param {number} [input.advanceDue=0] advance recovery due this month
 * @param {object} [input.config]       the company's payroll settings
 */
function computePayslip({ gross, basic, lopDays = 0, advanceDue = 0, config } = {}) {
  const cfg = resolveConfig(config);
  if (!isInt(gross) || gross < 0) throw new RangeError('gross must be a non-negative whole number of rupees');
  if (!(typeof lopDays === 'number' && lopDays >= 0 && lopDays <= cfg.workingDays && Number.isFinite(lopDays * 2) && Number.isInteger(lopDays * 2))) {
    throw new RangeError('lopDays must be 0 to workingDays, in steps of 0.5');
  }
  if (!isInt(advanceDue) || advanceDue < 0) throw new RangeError('advanceDue must be a non-negative whole number');

  // Loss of pay: round(gross / workingDays * lopDays), computed in integers (half-days = lopDays*2 halves).
  const lop = roundDiv(gross * (lopDays * 2), cfg.workingDays * 2);
  const earnedGross = gross - lop;

  const contractualBasic = basic !== undefined ? basic : roundDiv(gross * Math.round(cfg.basicPercent * 100), 10000);
  if (!isInt(contractualBasic) || contractualBasic < 0 || contractualBasic > gross) throw new RangeError('basic must be a whole number between 0 and gross');
  const earnedBasic = gross === 0 ? 0 : roundDiv(contractualBasic * earnedGross, gross);

  // ESI: eligibility is judged on contractual gross; contribution on what was actually earned. Rounded UP to the next rupee.
  const esi = { applicable: false, reason: 'ESI not enabled for this company', employee: 0, employer: 0 };
  if (cfg.esi.enabled) {
    if (gross > cfg.esi.wageCeiling) {
      esi.reason = `Gross above the ESI wage ceiling of ${cfg.esi.wageCeiling}`;
    } else {
      esi.applicable = true;
      esi.reason = 'ESI applies';
      esi.employee = ceilDiv(bp(earnedGross, cfg.esi.employeeBp), 10000);
      esi.employer = ceilDiv(bp(earnedGross, cfg.esi.employerBp), 10000);
    }
  }

  // PF: on earned basic, capped at the ceiling unless the company chooses PF on actual basic. Rounded to nearest rupee.
  const pf = { applicable: false, reason: 'PF not enabled for this company', wage: 0, employee: 0, employer: 0, admin: 0, edli: 0 };
  if (cfg.pf.enabled) {
    pf.applicable = true;
    pf.reason = 'PF applies';
    pf.wage = cfg.pf.applyCeiling ? Math.min(earnedBasic, cfg.pf.wageCeiling) : earnedBasic;
    pf.employee = roundDiv(bp(pf.wage, cfg.pf.employeeBp), 10000);
    pf.employer = roundDiv(bp(pf.wage, cfg.pf.employerBp), 10000);
    pf.admin = roundDiv(bp(pf.wage, cfg.pf.adminBp), 10000);
    pf.edli = roundDiv(bp(pf.wage, cfg.pf.edliBp), 10000);
  }

  // Advance recovery can never push take-home below zero; any unrecovered part carries forward.
  const afterStatutory = earnedGross - esi.employee - pf.employee;
  const advanceApplied = Math.min(advanceDue, Math.max(0, afterStatutory));
  const net = afterStatutory - advanceApplied;

  const employerCost = earnedGross + esi.employer + pf.employer + pf.admin + pf.edli;

  return {
    gross, basic: contractualBasic, workingDays: cfg.workingDays, lopDays,
    lop, earnedGross, earnedBasic,
    esi, pf,
    advanceDue, advanceApplied, advanceCarriedForward: advanceDue - advanceApplied,
    totalDeductions: lop + esi.employee + pf.employee + advanceApplied,
    net,
    employerCost,
  };
}

module.exports = { computePayslip, resolveConfig, DEFAULTS };
