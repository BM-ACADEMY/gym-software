const S = require('../src/salesList'); const { makeBilling } = require('../../../packages/core-billing/src');
const B = makeBilling({ plans: { growth: { key: 'growth', monthly: 1, yearly: 10 } }, gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'growth', ranks: { growth: 0 } });
const now = new Date('2026-11-10T06:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);
const acc = (o) => ({ product: 'Fit', ownerName: 'Ravi', ownerPhone: '98765 43210', ownerEmail: 'R@X.com', contactConsent: true, createdAt: d(-30), ...o });
const st = (sub) => B.computeStatus(sub, now);
describe('sales list', () => {
  test('stages from billing status', () => {
    expect(S.stageOf(acc({ status: st({ trialEndsAt: d(2) }) }), now)).toBe('trial-3d');
    expect(S.stageOf(acc({ status: st({ trialEndsAt: d(1) }) }), now)).toBe('trial-1d');
    expect(S.stageOf(acc({ status: st({ paidUntil: d(6), planKey: 'growth' }) }), now)).toBe('renewal-7d');
    expect(S.stageOf(acc({ status: st({ paidUntil: d(20), planKey: 'growth' }) }), now)).toBe('renewal-30d');
    expect(S.stageOf(acc({ status: st({ paidUntil: d(-1), planKey: 'growth' }) }), now)).toBe('expired');
    expect(S.stageOf(acc({ status: st({ paidUntil: d(60), planKey: 'growth' }), lastActiveAt: d(-20) }), now)).toBe('idle-14d');
    expect(S.stageOf(acc({ status: st({ paidUntil: d(60), planKey: 'growth' }), lastActiveAt: d(-2) }), now)).toBe(null);
  });
  test('rows: phone to E.164, consent required, bad phone and duplicates counted, urgent first', () => {
    const r = S.build([
      acc({ status: st({ paidUntil: d(20), planKey: 'growth' }) }),
      acc({ ownerPhone: '9123456789', status: st({ paidUntil: d(-1), planKey: 'growth' }) }),
      acc({ ownerPhone: '1234', status: st({ trialEndsAt: d(2) }) }),
      acc({ ownerPhone: '9000000001', contactConsent: false, status: st({ trialEndsAt: d(2) }) }),
      acc({ status: st({ trialEndsAt: d(2) }) }),
    ], { now });
    expect(r.rows.length).toBe(2); expect(r.rows[0].campaign).toBe('fit-expired'); expect(r.rows[1].phone).toBe('+919876543210');
    expect(r.skipped.bad_phone).toBe(1); expect(r.skipped.no_consent).toBe(1); expect(r.skipped.duplicate_phone).toBe(1);
  });
  test('CSV: Lead Hub headings, quoting, formula characters neutralised, no amounts', () => {
    const csv = S.toCsv([{ phone: '+919876543210', name: '=HYPERLINK("x")', email: 'a@b.com', source: 'afra_product', campaign: 'fit-renewal-7d' }, { phone: '+919876543211', name: 'Kumar, S "Sri"', email: '', source: 'afra_product', campaign: 'hire-trial-3d' }]);
    const lines = csv.trim().split('\n'); expect(lines[0]).toBe('phone,name,email,source,campaign');
    expect(lines[1]).toBe(`+919876543210,"'=HYPERLINK(""x"")",a@b.com,afra_product,fit-renewal-7d`); expect(lines[2]).toBe('+919876543211,"Kumar, S ""Sri""",,afra_product,hire-trial-3d');
    expect(/rs |amount|plan/i.test(lines[0])).toBe(false);
  });
  test('summary has numbers only', () => {
    const s = S.summary(S.build([acc({ status: st({ trialEndsAt: d(2) }) })], { now })); expect(s.total).toBe(1); expect(JSON.stringify(s).includes('9876')).toBe(false); expect(s.byCampaign['fit-trial-3d']).toBe(1);
  });
  test('phone checks', () => { expect(S.e164('098765 43210')).toBe('+919876543210'); expect(S.e164('+44 7911 123456')).toBe('+447911123456'); expect(S.e164('5876543210')).toBe(null); expect(S.e164('')).toBe(null); });
});
