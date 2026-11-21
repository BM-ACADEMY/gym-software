const W = require('../src');
describe('vehicles', () => {
  test('plates normalise and validate (state and BH series)', () => {
    expect(W.normalizePlate(' tn 09 ab-1234 ')).toBe('TN09AB1234');
    expect(W.validPlate('TN09AB1234')).toBe(true); expect(W.validPlate('KA 01 1234')).toBe(true);
    expect(W.validPlate('22BH1234AA')).toBe(true);
    expect(W.validPlate('HELLO')).toBe(false); expect(W.validPlate('')).toBe(false);
  });
  test('quote: class price plus add-ons in whole rupees; unknown things are errors', () => {
    const q = W.quote({ sedan: 400, bike: 100 }, { wax: 150 }, 'sedan', ['wax']);
    expect(q.total).toBe(550); expect(q.currency).toBe('INR'); expect(q.lines.length).toBe(2);
    expect(W.quote({ sedan: 400 }, {}, 'suv').error).toMatch(/price/);
    expect(W.quote({ sedan: 400 }, { wax: 150 }, 'sedan', ['gold']).error).toMatch(/Unknown add-on/);
    expect(W.quote({ sedan: 400 }, {}, 'tank').error).toMatch(/class/);
    expect(W.quote({ sedan: 40.5 }, {}, 'sedan').error).toMatch(/price/);
  });
});
describe('job state machine', () => {
  const t0 = '2026-11-12T10:00:00Z', t1 = '2026-11-12T10:40:00Z', t2 = '2026-11-12T11:30:00Z';
  test('waiting -> washing -> ready -> delivered with stamps and a timer', () => {
    let j = W.newJob({ plate: 'TN09AB1234', klass: 'sedan', now: t0 });
    j = W.move(j, 'washing', t0, 'a1'); expect(j.state).toBe('washing'); expect(j.attendantId).toBe('a1');
    j = W.move(j, 'ready', t1); expect(W.washMinutes(j, t2)).toBe(40);
    expect(W.pickupDelayed(j, t2, 30)).toBe(true); expect(W.pickupDelayed(j, t2, 120)).toBe(false);
    j = W.move(j, 'delivered', t2); expect(j.deliveredAt).toBe(t2);
  });
  test('wrong jumps and washing without an attendant are refused; the original job is not changed', () => {
    const j = W.newJob({ plate: 'X', klass: 'bike', now: t0 });
    let code = ''; try { W.move(j, 'ready', t1); } catch (e) { code = e.code; } expect(code).toBe('JOB_STATE');
    code = ''; try { W.move(j, 'washing', t1); } catch (e) { code = e.code; } expect(code).toBe('JOB_ATTENDANT');
    code = ''; try { W.move(j, 'flying', t1); } catch (e) { code = e.code; } expect(code).toBe('JOB_STATE');
    expect(j.state).toBe('waiting');
  });
});
describe('monthly pass', () => {
  test('new pass: 30 days inclusive, washes counted down, expiry and empty refused', () => {
    let p = W.newPass({ plate: 'TN09AB1234', washes: 4, startsOn: '2026-11-01', price: 999 });
    expect(p.endsOn).toBe('2026-11-30');
    p = W.useWash(p, '2026-11-05'); expect(p.used).toBe(1);
    expect(W.status(p, '2026-11-05').left).toBe(3);
    expect(W.status(p, '2026-11-27').remind).toBe(true);
    expect(W.status(p, '2026-11-10').remind).toBe(false);
    let code = ''; try { W.useWash(p, '2026-12-01'); } catch (e) { code = e.code; } expect(code).toBe('PASS_EXPIRED');
    code = ''; try { W.useWash(p, '2026-10-31'); } catch (e) { code = e.code; } expect(code).toBe('PASS_NOT_STARTED');
    let q = { ...p, used: 4 }; code = ''; try { W.useWash(q, '2026-11-06'); } catch (e) { code = e.code; } expect(code).toBe('PASS_EMPTY');
    expect(W.refundWash({ ...p, used: 0 }).used).toBe(0); expect(W.refundWash(p).used).toBe(0);
  });
  test('bad pass input is refused', () => {
    let code = ''; try { W.newPass({ plate: 'X', washes: 0, startsOn: '2026-11-01', price: 5 }); } catch (e) { code = e.code; } expect(code).toBe('PASS_INVALID');
    code = ''; try { W.newPass({ plate: 'X', washes: 4, startsOn: '2026-11-01', price: 5.5 }); } catch (e) { code = e.code; } expect(code).toBe('PASS_INVALID');
  });
});
describe('bays', () => {
  test('next job goes to the bay that frees first; ready times add up', () => {
    const r = W.schedule([{ id: 'b1', freeAt: 600 }, { id: 'b2', freeAt: 620 }], [{ id: 'j1', mins: 30 }, { id: 'j2', mins: 30 }, { id: 'j3', mins: 30 }], 610);
    expect(r.plan.map((p) => p.bayId + ':' + p.start + '-' + p.ready)).toEqual(['b1:610-640', 'b2:620-650', 'b1:640-670']);
    expect(W.schedule([], [], 0).error).toMatch(/bays/);
    expect(W.schedule([{ id: 'b' }], [{ id: 'j', mins: 2.5 }], 0).error).toMatch(/minutes/);
  });
  test('idle minutes inside opening hours', () => {
    expect(W.idleMinutes(540, 1260, [{ start: 540, end: 600 }, { start: 700, end: 760 }])).toBe(720 - 120);
    expect(W.idleMinutes(540, 600, [{ start: 500, end: 700 }])).toBe(0);
    expect(W.idleMinutes(540, 600, [])).toBe(60);
  });
});
describe('incentive', () => {
  const rules = { default: { type: 'percent', value: 10 }, byClass: { suv: { type: 'flat', value: 60 } } };
  test('class rule beats default; whole rupees; never above total; only delivered jobs', () => {
    expect(W.incentiveFor({ state: 'delivered', klass: 'sedan', total: 455 }, rules)).toBe(46);
    expect(W.incentiveFor({ state: 'delivered', klass: 'suv', total: 800 }, rules)).toBe(60);
    expect(W.incentiveFor({ state: 'delivered', klass: 'suv', total: 40 }, rules)).toBe(40);
    expect(W.incentiveFor({ state: 'washing', klass: 'sedan', total: 400 }, rules)).toBe(0);
    expect(W.incentiveFor({ state: 'delivered', klass: 'sedan', total: 400 }, { default: { type: 'percent', value: 500 } })).toBe(0);
  });
  test('day totals and ranking', () => {
    const t = W.dayTotals([{ attendantId: 'a', state: 'delivered', klass: 'sedan', total: 400 }, { attendantId: 'a', state: 'delivered', klass: 'suv', total: 800 }, { attendantId: 'b', state: 'delivered', klass: 'sedan', total: 1000 }, { attendantId: 'b', state: 'cancelled', klass: 'sedan', total: 300 }], rules);
    expect(t.a).toEqual({ jobs: 2, billed: 1200, incentive: 100 });
    expect(W.ranking(t).map((x) => x.id)).toEqual(['a', 'b']);
  });
});
describe('cash closing', () => {
  test('expected cash = float + cash bills - cash refunds; flag above the limit', () => {
    const bills = [{ method: 'cash', amount: 500 }, { method: 'upi', amount: 300 }, { method: 'cash', amount: 250 }, { method: 'card', amount: 100 }];
    const r = W.closing({ bills, refunds: [{ method: 'cash', amount: 50 }], openingFloat: 200, declared: 900 });
    expect(r.expected).toBe(900); expect(r.diff).toBe(0); expect(r.flag).toBe(false); expect(r.upiTotal).toBe(300); expect(r.cardTotal).toBe(100);
    const s = W.closing({ bills, openingFloat: 200, declared: 800 });
    expect(s.diff).toBe(-150); expect(s.flag).toBe(true);
    expect(W.closing({ bills, declared: -1 }).error).toMatch(/whole rupees/);
  });
});
describe('win-back and wash due', () => {
  const today = '2026-11-12';
  const vs = [
    { plate: 'A', ownerName: 'a', lastWash: '2026-08-01' },
    { plate: 'B', ownerName: 'b', lastWash: '2026-10-20' },
    { plate: 'C', ownerName: 'c', lastWash: '2026-10-20', intervalDays: 30 },
    { plate: 'D', ownerName: 'd', lastWash: '2026-08-01', doNotContact: true },
    { plate: 'E', ownerName: 'e', lastWash: '2026-10-01', openJob: true },
    { plate: 'F', ownerName: 'f', lastWash: 'bad' },
  ];
  test('lapsed lists 60+ days only, longest first', () => { expect(W.lapsed(vs, today).map((x) => x.plate)).toEqual(['A']); });
  test('due for wash: own interval or default 14, grace 1; skips open jobs and do-not-contact', () => {
    expect(W.dueForWash(vs, today).map((x) => x.plate)).toEqual(['A', 'B']);
    expect(W.dueForWash(vs, today)[1].overdueDays).toBe(9);
  });
});
