const S = require('../src'); const { buildBill } = require('../src/billing'); const { signUp, signIn } = require('../src/signup');
describe('booking rules', () => {
  const tenant = { windows: [[600, 780]], closedWeekdays: [0], slotStep: 30, bufferMins: 0 };
  const now = new Date('2026-11-12T06:00:00Z'); // 11:30 IST Thursday
  test('dates: valid, past, far, closed day, today hides past times', () => {
    expect(S.validDate('2026-02-30')).toBe(false); expect(S.validDate('2026-11-12')).toBe(true);
    expect(() => S.checkDay(tenant, '2026-11-11', now)).toThrow(); expect(() => S.checkDay(tenant, '2027-03-01', now)).toThrow(); expect(() => S.checkDay(tenant, '2026-11-15', now)).toThrow();
    expect(S.slotsFor({ tenant, date: '2026-11-12', mins: 30, booked: [], now })).toEqual([690, 720, 750]);
    expect(S.slotsFor({ tenant, date: '2026-11-13', mins: 30, booked: [], now }).length).toBe(6);
  });
  test('public must pick an offered slot; owner may pick any free time inside hours', () => {
    const d = '2026-11-13';
    expect(() => S.checkStart({ tenant, date: d, start: 615, mins: 30, booked: [], publicBooking: true, now })).toThrow();
    S.checkStart({ tenant, date: d, start: 615, mins: 30, booked: [], publicBooking: false, now });
    expect(() => S.checkStart({ tenant, date: d, start: 770, mins: 30, booked: [], publicBooking: false, now })).toThrow();
    expect(() => S.checkStart({ tenant, date: d, start: 600, mins: 30, booked: [{ start: 590, end: 610 }], publicBooking: false, now })).toThrow();
  });
  test('phone cleaning, validation, masking', () => {
    expect(S.cleanPhone('+91 98400 12210')).toBe('9840012210'); expect(S.validPhone('1234567890')).toBe(false); expect(S.validPhone('98400 12210')).toBe(true); expect(S.maskPhone('9840012210')).toBe('98******10'); expect(S.maskPhone(null)).toBe(null);
  });
});
describe('billing', () => {
  const services = { haircut: { key: 'haircut', name: 'Haircut', price: 500, gstRate: 18 }, colour: { key: 'colour', name: 'Colour', price: 2000, gstRate: 18 } };
  const rules = { default: { type: 'percent', value: 30 }, byService: { colour: { type: 'percent', value: 20 } } };
  test('GST on top, commission on the amount before GST, payments kept, change from cash', () => {
    const r = buildBill({ input: { lines: [{ serviceKey: 'haircut', staffId: 's1' }, { serviceKey: 'colour', staffId: 's2' }], payments: [{ method: 'cash', amount: 3000 }] }, services, tenant: { taxMode: 'gst_exclusive' }, rules });
    expect(r.total).toBe(2950); expect(r.gst).toBe(450); expect(r.cgst + r.sgst).toBe(450); expect(r.change).toBe(50); expect(r.status).toBe('paid');
    expect(r.commissions).toEqual({ s1: 150, s2: 400 }); expect(r.payments).toEqual([{ method: 'cash', amount: 3000 }]); expect(r.currency).toBe('INR');
  });
  test('needs staff on a service, a known service, a discount reason; shop price cannot be overridden', () => {
    const t = { taxMode: 'none' };
    expect(() => buildBill({ input: { lines: [{ serviceKey: 'haircut' }] }, services, tenant: t, rules })).toThrow();
    expect(() => buildBill({ input: { lines: [{ serviceKey: 'nope', staffId: 's' }] }, services, tenant: t, rules })).toThrow();
    expect(() => buildBill({ input: { lines: [{ serviceKey: 'haircut', staffId: 's' }], billDiscount: { type: 'amount', value: 50 } }, services, tenant: t, rules })).toThrow();
    expect(() => buildBill({ input: { lines: [] }, services, tenant: t, rules })).toThrow();
    expect(buildBill({ input: { lines: [{ serviceKey: 'haircut', staffId: 's', unitPrice: 1 }], payments: [] }, services, tenant: t, rules }).total).toBe(500);
  });
  test('part payment leaves a due; discount reason is kept', () => {
    const r = buildBill({ input: { lines: [{ serviceKey: 'haircut', staffId: 's' }], billDiscount: { type: 'percent', value: 10 }, discountReason: 'Festival', payments: [{ method: 'upi', amount: 200 }] }, services, tenant: { taxMode: 'none' }, rules });
    expect(r.total).toBe(450); expect(r.due).toBe(250); expect(r.status).toBe('partial'); expect(r.discountReason).toBe('Festival');
  });
});
describe('accounts', () => {
  const bills = [{ number: 'B1', date: '2026-11-12', taxable: 1000, gst: 180, cgst: 90, sgst: 90, igst: 0, total: 1180, discount: 0, change: 20, due: 0, payments: [{ method: 'cash', amount: 700 }, { method: 'upi', amount: 500 }], lines: [{ rate: 18, taxable: 1000, gst: 180 }], commissions: { s1: 300 } },
    { number: 'B2', date: '2026-11-12', taxable: 500, gst: 0, total: 500, discount: 100, due: 200, customerId: 'c1', payments: [{ method: 'cash', amount: 300 }], lines: [{ rate: 0, taxable: 500, gst: 0 }] }];
  const exp = [{ _id: 'e1', date: '2026-11-12', category: 'products', amount: 150, method: 'cash', paid: true, paidTo: 'Vendor' }, { _id: 'e2', date: '2026-11-12', category: 'rent', amount: 5000, method: 'bank', paid: false, dueDate: '2026-11-20', paidTo: 'Landlord' }];
  test('cash kept and received by method', () => { expect(S.cashKept(bills[0])).toBe(680); expect(S.receivedByMethod(bills)).toEqual({ cash: 980, upi: 500 }); });
  test('day close: expected, short, over, matches', () => {
    expect(S.dayClose({ openingCash: 1000, bills, expenses: exp, countedCash: 1830 }).expected).toBe(1830); expect(S.dayClose({ openingCash: 1000, bills, expenses: exp, countedCash: 1830 }).text).toBe('Cash matches.');
    expect(S.dayClose({ openingCash: 1000, bills, expenses: exp, countedCash: 1800 }).text).toBe('Cash is short by Rs 30.'); expect(S.dayClose({ openingCash: 1000, bills, expenses: exp, countedCash: 1900 }).text).toBe('Cash is over by Rs 70.');
  });
  test('profit and loss in plain words, GST summary, dues', () => {
    const p = S.profitAndLoss({ bills, expenses: exp, commissionTotal: 300 }); expect(p.income).toBe(1500); expect(p.expenseTotal).toBe(5150); expect(p.profit).toBe(-3950); expect(p.text).toMatch(/lost Rs 3950/); expect(p.expensesByCategory.rent).toBe(5000);
    const g = S.gstSummary(bills); expect(g.gst).toBe(180); expect(g.byRate['18'].taxable).toBe(1000); expect(g.cgst).toBe(90);
    expect(S.customerDues(bills)).toEqual([{ billNumber: 'B2', customerId: 'c1', due: 200, date: '2026-11-12' }]); expect(S.supplierDues(exp).map((d) => d.paidTo)).toEqual(['Landlord']);
  });
  test('CA export neutralises spreadsheet formulas and quotes commas', () => {
    const csv = S.caCsv({ bills: [{ date: '2026-11-12', number: 'B1', taxable: 1, gst: 0, total: 1 }], expenses: [{ date: '2026-11-12', paidTo: '=HYPERLINK("x")', category: 'rent, shop', amount: 5 }] });
    expect(csv).toMatch(/'=HYPERLINK/); expect(csv).toMatch(/"rent, shop"/); expect(csv.split('\n')[0]).toBe('Type,Date,Number or payee,Category,Taxable,GST,Total,Currency'); expect(S.cell('-5')).toBe('-5');
  });
});
describe('reports, estimates, leaks, marketing, summary', () => {
  test('sales report by day, staff, service, hour', () => {
    const r = S.salesReport([{ date: '2026-11-12', taxable: 500, createdAt: '2026-11-12T06:00:00Z', lines: [{ staffId: 's1', serviceKey: 'haircut', taxable: 500 }] }, { date: '2026-11-13', taxable: 300, lines: [{ staffId: 's2', name: 'Gel', taxable: 300 }] }]);
    expect(r.total).toBe(800); expect(r.average).toBe(400); expect(r.byStaff[0]).toEqual({ key: 's1', amount: 500 }); expect(r.byHour['11']).toBe(500); expect(S.monthlyTotals([{ date: '2026-10-02', taxable: 5 }, { date: '2026-10-09', taxable: 7 }])).toEqual({ '2026-10': 12 });
  });
  test('next month range: needs 3 months, labelled estimate, never negative', () => {
    expect(S.nextMonthRange({ '2026-09': 100, '2026-10': 200 }).enough).toBe(false);
    const r = S.nextMonthRange({ '2026-08': 50000, '2026-09': 60000, '2026-10': 55000 }); expect(r.estimate).toBe(true); expect(r.low < 55000 && r.high > 55000).toBe(true); expect(r.reason).toMatch(/not a promise/); expect(S.nextMonthRange({ a: 1, b: 100, c: 1 }).low).toBe(0);
  });
  test('busy times need 20 visits; lapse risk uses the customer\'s own rhythm and respects do-not-contact', () => {
    expect(S.busyTimes([{ date: '2026-11-10', start: 600 }]).enough).toBe(false);
    const v = []; for (let i = 0; i < 24; i++) v.push({ date: i % 3 ? '2026-11-09' : '2026-11-10', start: i % 2 ? 600 : 660 });
    const b = S.busyTimes(v); expect(b.enough).toBe(true); expect(b.busiestDays[0].day).toBe('Monday');
    const h = { a: ['2026-06-01', '2026-06-29', '2026-07-27'], b: ['2026-06-01', '2026-06-29', '2026-07-27'], c: ['2026-09-01', '2026-10-01'] };
    const r = S.lapseRisk({ history: h, today: '2026-11-12', names: { a: 'A' }, doNotContact: { b: true } }); expect(r.map((x) => x.id)).toEqual(['a']); expect(r[0].estimate).toBe(true); expect(r[0].usualGapDays).toBe(28);
    expect(S.cashNeeded([{ amount: 100, dueDate: '2026-11-20' }, { amount: 50, dueDate: '2027-01-01' }], '2026-11-12').amount).toBe(100);
  });
  test('leak checks: heavy discounts, cash differences, repeat drop; wording is not an accusation', () => {
    const l = S.leakList({ bills: [{ number: 'B1', date: '2026-11-12', subtotal: 1000, discount: 400, discountReason: 'friend' }, { number: 'B2', date: '2026-11-12', subtotal: 1000, discount: 50 }], closes: [{ date: '2026-11-11', difference: -200 }, { date: '2026-11-10', difference: 0 }], repeat: S.repeatDrop({ currentVisitors: 40, currentReturning: 10, previousVisitors: 40, previousReturning: 20 }) });
    expect(l.map((x) => x.kind)).toEqual(['discount', 'cash', 'repeat']); expect(l[0].text).toMatch(/Reason given: friend/); expect(S.repeatDrop({ currentVisitors: 5, currentReturning: 1, previousVisitors: 40, previousReturning: 20 }).enough).toBe(false);
  });
  test('marketing: owner\'s festival list only, review requests only with consent', () => {
    expect(S.festivalIdeas([{ name: 'Diwali', date: '2026-11-20', offer: '10% off' }, { name: 'Far', date: '2027-01-01' }], '2026-11-12').length).toBe(1);
    expect(S.festivalIdeas([{ name: 'Diwali', date: '2026-11-20', offer: '10% off' }], '2026-11-12')[0].suggestOnly).toBe(true);
    expect(S.reviewRequests([{ status: 'done', consent: true }, { status: 'done', consent: false }, { status: 'done', consent: true, doNotContact: true }]).length).toBe(1);
  });
  test('daily summary shows at most three actions, each with a reason and suggest-only', () => {
    const r = S.dailySummary({ today: '2026-11-12', yesterday: '2026-11-11', appointments: [{ date: '2026-11-12', status: 'pending' }, { date: '2026-11-11', status: 'noshow' }], bills: [{ date: '2026-11-11', received: 1200 }], customers: [{ id: 1, lastVisit: '2026-09-01', lastServiceKey: 'haircut' }, { id: 2, lastVisit: '2026-06-01', lastServiceKey: 'other' }], services: [{ key: 'haircut', price: 400, cycleDays: 42 }], upcomingBirthdays: [{ id: 3 }] });
    expect(r.actions.length).toBe(3); expect(r.actions.every((a) => a.reason && a.suggestOnly)).toBe(true); expect(r.sales.yesterday).toBe(1200);
    expect(S.dailySummary({ today: '2026-11-12', yesterday: '2026-11-11' }).actions[0].kind).toBe('share');
  });
});
describe('sign-up and sign-in rules', () => {
  const mk = () => { const users = {}; let tenant; return { users, store: { findUserByEmail: async (e) => users[e] || null, createTenant: async (t) => { tenant = t; return { id: 't1' }; }, createUser: async (u) => { users[u.email] = { ...u, id: 'u1' }; return { id: 'u1' }; }, updateUser: async (id, p) => { Object.values(users).forEach((u) => { if (u.id === id) Object.assign(u, p); }); } }, get tenant() { return tenant; } }; };
  const billing = { trialDates: (n) => ({ trialEndsAt: new Date(n.getTime() + 14 * 86400000) }) };
  const input = { businessName: 'Glow', ownerName: 'Asha', email: 'A@x.in', state: 'Tamil Nadu', password: 'longenough1', acceptTerms: true, preset: 'clinic' };
  test('sign-up needs terms and a strong enough password; creates a tenant with a secret booking token and the chosen preset', async () => {
    const m = mk(); const r = await signUp(input, { store: m.store, hash: async (p) => 'h:' + p, billing }); expect(r.preset).toBe('clinic');
    expect(m.tenant.bookingToken).toMatch(/^[0-9a-f]{48}$/); expect(m.tenant.preset).toBe('clinic'); expect(m.users['a@x.in'].role).toBe('admin');
    for (const bad of [{ acceptTerms: false }, { password: 'short' }, { email: 'nope' }, { businessName: '' }, { state: '' }]) { let e; try { await signUp({ ...input, ...bad }, { store: mk().store, hash: async (p) => p, billing }); } catch (x) { e = x; } expect(!!e).toBe(true); }
    let dup; try { await signUp(input, { store: m.store, hash: async (p) => p, billing }); } catch (x) { dup = x; } expect(dup.code).toBe('SIGNUP_EXISTS');
    expect((await signUp({ ...input, email: 'b@x.in', preset: 'weird' }, { store: m.store, hash: async (p) => p, billing })).preset).toBe('salon');
  });
  test('five wrong passwords lock the account; right password resets the count', async () => {
    const m = mk(); await signUp(input, { store: m.store, hash: async (p) => 'h:' + p, billing }); const verify = async (p, h) => h === 'h:' + p; const now = new Date();
    for (let i = 0; i < 5; i++) { try { await signIn({ email: 'a@x.in', password: 'bad' }, { store: m.store, verify, now }); } catch (e) { expect(e.code).toBe('LOGIN_BAD'); } }
    let e; try { await signIn({ email: 'a@x.in', password: 'longenough1' }, { store: m.store, verify, now }); } catch (x) { e = x; } expect(e.code).toBe('LOGIN_LOCKED');
    expect((await signIn({ email: 'a@x.in', password: 'longenough1' }, { store: m.store, verify, now: new Date(now.getTime() + 16 * 60000) })).role).toBe('admin');
  });
});
