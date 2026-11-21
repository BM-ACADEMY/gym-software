const H = require('../src');
const { pipeline, consent } = H;
const throwsCode = (fn, code) => { try { fn(); } catch (e) { return e.code === code; } return false; };

describe('phone and duplicates', () => {
  test('normalises Indian mobiles', () => {
    expect(H.normalizePhone('98765 43210')).toBe('+919876543210');
    expect(H.normalizePhone('+91-98765-43210')).toBe('+919876543210');
    expect(H.normalizePhone('09876543210')).toBe('+919876543210');
    expect(H.normalizePhone('12345')).toBeNull();
    expect(H.normalizePhone('5876543210')).toBeNull();
  });
  test('duplicate by phone first, then email, never by name', () => {
    const ex = [{ id: 1, name: 'Ravi', phone: '9876543210', email: 'a@x.com' }, { id: 2, name: 'Sita', phone: '9123456780', email: 'S@x.com' }];
    expect(H.findDuplicate({ phone: '+91 98765 43210' }, ex).match.id).toBe(1);
    expect(H.findDuplicate({ email: 's@X.com' }, ex).by).toBe('email');
    expect(H.findDuplicate({ name: 'Ravi' }, ex)).toBeNull();
  });
  test('merge fills gaps and unions skills without overwriting', () => {
    const m = H.mergeCandidate({ name: 'Ravi', skills: ['java'], location: 'Chennai' }, { name: 'R', location: 'Madurai', email: 'r@x.com', skills: ['SQL', 'java'] });
    expect(m.candidate.name).toBe('Ravi'); expect(m.candidate.location).toBe('Chennai'); expect(m.candidate.email).toBe('r@x.com');
    expect(m.candidate.skills.sort()).toEqual(['java', 'sql']);
  });
});

describe('AI parse validation', () => {
  test('drops unknown fields, clamps numbers, flags missing', () => {
    const r = H.validateParsed({ name: ' Ravi ', phone: '98765 43210', experienceYears: 200, skills: ['Java', 'java', ''], evil: 'x', currentCtc: 'abc' });
    expect(r.candidate.name).toBe('Ravi'); expect(r.candidate.experienceYears).toBeNull(); expect(r.candidate.currentCtc).toBeNull();
    expect(r.candidate.skills).toEqual(['java']); expect(r.candidate.evil).toBe(undefined); expect(r.needsReview).toBe(false);
  });
  test('garbage input needs review', () => {
    const r = H.validateParsed('not json');
    expect(r.missing).toEqual(['name', 'phone']); expect(r.needsReview).toBe(true);
  });
});

describe('ranking', () => {
  const job = { title: 'Java dev', mustSkills: ['java', 'sql'], niceSkills: ['aws'], minExperience: 3, maxExperience: 6, maxCtc: 1000000, location: 'Chennai', maxNoticeDays: 30 };
  test('full match scores 100, partial less, order stable', () => {
    const full = { id: 'a', skills: ['Java', 'SQL', 'AWS'], experienceYears: 4, expectedCtc: 900000, location: 'chennai', noticeDays: 30 };
    const part = { id: 'b', skills: ['java'], experienceYears: 4, expectedCtc: 900000, location: 'Pune', noticeDays: 90 };
    const out = H.rankCandidates(job, [part, full]);
    expect(out[0].candidateId).toBe('a'); expect(out[0].score).toBe(100); expect(out[1].score).toBeGreaterThan(0);
    expect(out[1].score < out[0].score).toBe(true);
  });
  test('model reason input holds no personal details', () => {
    const r = H.score(job, { id: 'a', name: 'Ravi', phone: '9876543210', skills: ['java'] });
    const s = JSON.stringify(H.reasonInput(job, r));
    expect(s).not.toMatch(/Ravi|9876543210/);
  });
});

describe('pipeline', () => {
  test('legal and illegal moves', () => {
    const e = { stage: 'sourced' };
    expect(pipeline.move(e, 'screened').stage).toBe('screened');
    expect(throwsCode(() => pipeline.move(e, 'offer'), 'PIPELINE_TRANSITION')).toBe(true);
    expect(throwsCode(() => pipeline.move({ stage: 'joined' }, 'dropped', { reason: 'x' }), 'PIPELINE_TRANSITION')).toBe(true);
    expect(throwsCode(() => pipeline.move(e, 'nope'), 'PIPELINE_STAGE')).toBe(true);
  });
  test('drop needs a reason; history is kept', () => {
    expect(throwsCode(() => pipeline.move({ stage: 'offer' }, 'dropped'), 'PIPELINE_REASON')).toBe(true);
    const m = pipeline.move({ stage: 'offer', history: [] }, 'dropped', { reason: 'took another offer', by: 'u1' });
    expect(m.history).toHaveLength(1); expect(m.history[0].reason).toBe('took another offer');
  });
});

describe('offer-drop flags', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  test('only for offer stage', () => { expect(H.offerDropFlags({ stage: 'interview' }, now)).toEqual([]); });
  test('no reply 48h, other offers, long notice, low offer', () => {
    const f = H.offerDropFlags({ stage: 'offer', stageAt: '2026-11-08T11:00:00Z', otherOffers: true, noticeDays: 90, maxNoticeDays: 30, expectedCtc: 900000, offeredCtc: 800000 }, now).map((x) => x.code);
    expect(f).toEqual(['NO_REPLY_48H', 'OTHER_OFFERS', 'LONG_NOTICE', 'BELOW_EXPECTED_PAY']);
  });
  test('recent reply clears the no-reply flag', () => {
    expect(H.offerDropFlags({ stage: 'offer', stageAt: '2026-11-01T00:00:00Z', lastCandidateReplyAt: '2026-11-10T08:00:00Z' }, now)).toEqual([]);
  });
});

describe('placement fee', () => {
  test('percent fee with CGST+SGST', () => {
    const f = H.placementFee({ annualCtc: 600000, feeType: 'percent', feeValue: 8.33 });
    expect(f.fee).toBe(49980); expect(f.gst).toBe(8996); expect(f.cgst + f.sgst).toBe(f.gst); expect(f.total).toBe(f.fee + f.gst); expect(f.currency).toBe('INR');
  });
  test('flat fee with IGST', () => {
    const f = H.placementFee({ annualCtc: 600000, feeType: 'flat', feeValue: 30000, gstMode: 'igst' });
    expect(f.igst).toBe(5400); expect(f.cgst).toBe(0);
  });
  test('bad input refused', () => {
    expect(throwsCode(() => H.placementFee({ annualCtc: 0, feeType: 'flat', feeValue: 1 }), 'FEE_INVALID')).toBe(true);
    expect(throwsCode(() => H.placementFee({ annualCtc: 100, feeType: 'percent', feeValue: 101 }), 'FEE_INVALID')).toBe(true);
    expect(throwsCode(() => H.placementFee({ annualCtc: 100, feeType: 'flat', feeValue: 1, gstRate: 7 }), 'FEE_INVALID')).toBe(true);
  });
  test('due date after guarantee', () => { expect(H.dueDate('2026-12-01', 30)).toBe('2026-12-31'); });
});

describe('consent and retention', () => {
  const now = new Date('2027-01-01T00:00:00Z');
  test('consent source must be known', () => { expect(throwsCode(() => consent.consentRecord({ source: 'guess' }), 'CONSENT_SOURCE')).toBe(true); });
  test('retention states', () => {
    const c = consent.consentRecord({ source: 'candidate_form', at: '2026-01-01T00:00:00Z', purposeAi: true });
    expect(consent.retentionStatus({ consent: c, lastActivityAt: '2026-12-01T00:00:00Z' }, now)).toBe('ok');
    expect(consent.retentionStatus({ consent: c, lastActivityAt: '2026-01-15T00:00:00Z' }, now)).toBe('due_soon');
    expect(consent.retentionStatus({ consent: c, lastActivityAt: '2025-06-01T00:00:00Z' }, now)).toBe('review_or_delete');
    expect(consent.retentionStatus({ consent: { ...c, withdrawnAt: '2026-12-31' } }, now)).toBe('delete_now');
    expect(consent.retentionStatus({}, now)).toBe('no_consent');
  });
  test('messaging needs consent or a 24h reply window; do-not-contact wins', () => {
    const c = consent.consentRecord({ source: 'whatsapp_reply', at: now });
    expect(consent.canMessage({ consent: c }, now).ok).toBe(true);
    expect(consent.canMessage({ consent: c, doNotContact: true }, now).ok).toBe(false);
    expect(consent.canMessage({}, now).why).toBe('no_consent');
    expect(consent.canMessage({ lastCandidateMessageAt: '2026-12-31T20:00:00Z' }, now).why).toBe('reply_window');
    expect(consent.canMessage({ lastCandidateMessageAt: '2026-12-30T00:00:00Z' }, now).ok).toBe(false);
  });
});
