const D = require('../src');
const { bill } = require('../../../packages/core-pos/src/pure');
const T = '2026-11-12T10:00:00Z';
const fails = (fn, code) => { let e; try { fn(); } catch (x) { e = x; } return !!e && (!code || e.code === code); };

const pizza = { key: 'pz', name: 'Pizza', price: 200, gstRate: 5, variants: [{ key: 's', name: 'Small', price: 200 }, { key: 'l', name: 'Large', price: 350 }], groups: [{ key: 'top', name: 'Toppings', min: 0, max: 2, options: [{ key: 'ch', name: 'Cheese', price: 30 }, { key: 'ol', name: 'Olives', price: 20 }, { key: 'mu', name: 'Mushroom', price: 25 }] }] };
describe('menu', () => {
  test('variant replaces the price, add-ons add, name and note are built', () => {
    const p = D.priceLine(pizza, { variantKey: 'l', optionKeys: ['ch', 'ol'], qty: 2 });
    expect(p.unitPrice).toBe(400); expect(p.qty).toBe(2); expect(p.name).toBe('Pizza (Large)'); expect(p.note).toBe('Cheese, Olives'); expect(p.station).toBe('kitchen'); expect(p.currency).toBe('INR');
  });
  test('missing variant, too many add-ons, unknown add-on, bad quantity are refused', () => {
    expect(fails(() => D.priceLine(pizza, { qty: 1 }), 'MENU_INVALID')).toBe(true);
    expect(fails(() => D.priceLine(pizza, { variantKey: 's', optionKeys: ['ch', 'ol', 'mu'], qty: 1 }), 'MENU_INVALID')).toBe(true);
    expect(fails(() => D.priceLine(pizza, { variantKey: 's', optionKeys: ['zz'], qty: 1 }), 'MENU_INVALID')).toBe(true);
    expect(fails(() => D.priceLine(pizza, { variantKey: 's', qty: 0 }), 'MENU_INVALID')).toBe(true);
    expect(fails(() => D.priceLine(pizza, { variantKey: 's', qty: 1.5 }), 'MENU_INVALID')).toBe(true);
  });
  test('item checks: whole rupees, standard GST slab, liquor goes to the bar', () => {
    expect(fails(() => D.checkItem({ key: 'a', name: 'Tea', price: 10.5 }), 'MENU_INVALID')).toBe(true);
    expect(fails(() => D.checkItem({ key: 'a', name: 'Tea', price: 10, gstRate: 7 }), 'MENU_INVALID')).toBe(true);
    expect(D.priceLine({ key: 'b', name: 'Beer', price: 180, kind: 'liquor' }, { qty: 1 }).station).toBe('bar');
  });
});

const L = (id, extra) => ({ id, name: 'Dish ' + id, qty: 1, unitPrice: 100, gstRate: 5, station: 'kitchen', ...(extra || {}) });
describe('order flow', () => {
  test('dine-in needs a table; the happy path open, sent, served, billed, paid', () => {
    expect(fails(() => D.newOrder({ id: 'o1' }, T), 'ORDER_INVALID')).toBe(true);
    let o = D.newOrder({ id: 'o1', table: 'T4' }, T);
    o = D.addLine(o, L('a'), T); o = D.addLine(o, L('b', { station: 'bar' }), T);
    const k = D.sendKot(o, T); o = k.order;
    expect(o.status).toBe('sent'); expect(k.tickets.kitchen.length).toBe(1); expect(k.tickets.bar.length).toBe(1);
    o = D.markServed(o, [], T); expect(o.status).toBe('served');
    o = D.requestBill(o, T); expect(o.status).toBe('billed');
    o = D.markPaid(o, T); expect(o.status).toBe('paid');
  });
  test('the order given is never changed (immutable)', () => {
    const o = D.newOrder({ id: 'o1', table: 'T4' }, T); const o2 = D.addLine(o, L('a'), T);
    expect(o.lines.length).toBe(0); expect(o2.lines.length).toBe(1);
  });
  test('adding after serving makes only the new line go on the next KOT; cannot bill with unsent lines', () => {
    let o = D.newOrder({ id: 'o1', table: 'T4' }, T); o = D.addLine(o, L('a'), T); o = D.sendKot(o, T).order; o = D.markServed(o, [], T);
    o = D.addLine(o, L('c'), T); expect(o.status).toBe('sent');
    expect(fails(() => D.requestBill(o, T), 'ORDER_INVALID')).toBe(true);
    const k = D.sendKot(o, T); expect(k.tickets.kitchen.length).toBe(1); expect(k.tickets.kitchen[0].id).toBe('c');
  });
  test('void: a line not yet sent goes without a reason; a sent line needs one and is counted', () => {
    let o = D.newOrder({ id: 'o1', table: 'T4' }, T); o = D.addLine(o, L('a'), T); o = D.addLine(o, L('b'), T);
    o = D.voidLine(o, 'b', { by: 'u1' }, T);
    o = D.sendKot(o, T).order;
    expect(fails(() => D.voidLine(o, 'a', { reason: 'x', by: 'u1' }, T), 'ORDER_INVALID')).toBe(true);
    o = D.voidLine(o, 'a', { reason: 'guest left', by: 'u1' }, T);
    expect(D.counts(o).voidsAfterSend).toBe(1); expect(D.live(o).length).toBe(0);
    expect(fails(() => D.requestBill(o, T), 'ORDER_INVALID')).toBe(true); // nothing to bill
  });
  test('billed order is locked; reopen needs a reason and is counted; paid cannot reopen', () => {
    let o = D.newOrder({ id: 'o1', table: 'T4' }, T); o = D.addLine(o, L('a'), T); o = D.sendKot(o, T).order; o = D.requestBill(o, T);
    expect(fails(() => D.addLine(o, L('z'), T), 'ORDER_INVALID')).toBe(true);
    expect(fails(() => D.voidLine(o, 'a', { reason: 'abcd' }, T), 'ORDER_INVALID')).toBe(true);
    expect(fails(() => D.reopen(o, { reason: '' }, T), 'ORDER_INVALID')).toBe(true);
    o = D.reopen(o, { reason: 'guest adds tea', by: 'u1' }, T); expect(o.status).toBe('sent'); expect(D.counts(o).reopens).toBe(1);
    o = D.requestBill(o, T); o = D.markPaid(o, T);
    expect(fails(() => D.reopen(o, { reason: 'abcd' }, T), 'ORDER_INVALID')).toBe(true);
  });
});

describe('split bill', () => {
  test('equal split adds up exactly', () => {
    expect(D.splitEqual(1000, 3)).toEqual([334, 333, 333]);
    expect(D.splitEqual(100, 1)).toEqual([100]);
    expect(fails(() => D.splitEqual(100, 0), 'SPLIT_INVALID')).toBe(true);
    expect(fails(() => D.splitEqual(10.5, 2), 'SPLIT_INVALID')).toBe(true);
  });
  test('by items: each guest pays for own lines, shared line is split, extra shared in proportion, total unchanged', () => {
    const c = bill.compute({ lines: [{ name: 'A', unitPrice: 300, qty: 1, gstRate: 5 }, { name: 'B', unitPrice: 100, qty: 1, gstRate: 5 }, { name: 'C', unitPrice: 200, qty: 1, gstRate: 5 }], taxMode: 'gst_exclusive' });
    const sc = D.serviceCharge(c.taxable, 10);
    const parts = D.splitByItems(c, [0, 1, [0, 1]], 2, sc);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(c.total + sc);
    expect(parts[0] > parts[1]).toBe(true);
    expect(fails(() => D.splitByItems(c, [0, 1], 2), 'SPLIT_INVALID')).toBe(true);
    expect(fails(() => D.splitByItems(c, [0, 1, 5], 2), 'SPLIT_INVALID')).toBe(true);
    expect(fails(() => D.splitByItems(c, [0, 1, [1, 1]], 2), 'SPLIT_INVALID')).toBe(true);
  });
  test('service charge is whole rupees and limited to 0 to 20 percent', () => {
    expect(D.serviceCharge(1005, 5)).toBe(50); expect(D.serviceCharge(1000, 0)).toBe(0);
    expect(fails(() => D.serviceCharge(1000, 25), 'SPLIT_INVALID')).toBe(true);
  });
});

describe('GST profiles', () => {
  const lines = [{ name: 'Curry', unitPrice: 200, qty: 1, gstRate: 12, kind: 'food' }, { name: 'Beer', unitPrice: 200, qty: 1, gstRate: 18, kind: 'liquor' }];
  test('per_item uses the item rate; liquor is never given a GST rate and is marked for the owner', () => {
    const i = D.toBillInput(lines, 'per_item'); const c = bill.compute({ lines: i.lines, taxMode: i.taxMode });
    expect(c.lines[0].rate).toBe(12); expect(c.lines[1].rate).toBe(0); expect(i.lines[1].stateTax).toBe('owner'); expect(c.gst).toBe(24); expect(c.total).toBe(424);
  });
  test('flat_5 and none; unknown profile refused; only "none" counts as confirmed', () => {
    expect(bill.compute({ ...D.toBillInput(lines, 'flat_5') }).lines[0].rate).toBe(5);
    const n = D.toBillInput(lines, 'none'); expect(bill.compute(n).gst).toBe(0);
    expect(fails(() => D.toBillInput(lines, 'zzz'), 'GST_INVALID')).toBe(true);
    expect(D.profileFor('flat_5').confirmedByCA).toBe(false); expect(D.profileFor('none').confirmedByCA).toBe(true);
  });
});

describe('costing', () => {
  const ing = { f: { name: 'Flour', unit: 'g', costPerUnit: 0.05 }, c: { name: 'Cheese', unit: 'g', costPerUnit: 0.4 }, x: { name: 'Mystery', unit: 'g' } };
  const rec = { pz: { portion: 1, parts: [{ ingredientId: 'f', qty: 200 }, { ingredientId: 'c', qty: 100 }] }, bad: { portion: 1, parts: [{ ingredientId: 'x', qty: 5 }] } };
  test('dish cost, missing cost reported, quantity must be positive', () => {
    expect(D.dishCost(rec.pz, ing).cost).toBe(50);
    expect(D.dishCost(rec.bad, ing).missing).toEqual(['x']);
    expect(fails(() => D.dishCost({ parts: [{ ingredientId: 'f', qty: 0 }] }, ing), 'COST_INVALID')).toBe(true);
    expect(fails(() => D.dishCost({ parts: [] }, ing), 'COST_INVALID')).toBe(true);
  });
  test('stock used by sales, dishes without a recipe are listed not guessed', () => {
    const d = D.deductions([{ dishKey: 'pz', qty: 3 }, { dishKey: 'tea', qty: 2 }], rec);
    expect(d.used).toEqual({ f: 600, c: 300 }); expect(d.noRecipe).toEqual(['tea']);
  });
  test('food cost percent on sales before GST; dishes with no recipe or no cost are skipped and named', () => {
    const r = D.foodCostPercent([{ dishKey: 'pz', qty: 10, revenue: 2000 }, { dishKey: 'bad', qty: 1, revenue: 100 }, { dishKey: 'tea', qty: 1, revenue: 20 }], rec, ing);
    expect(r.cost).toBe(500); expect(r.revenue).toBe(2000); expect(r.percent).toBe(25); expect(r.skipped).toEqual(['bad', 'tea']);
    expect(D.foodCostPercent([], rec, ing).percent).toBe(null);
  });
  test('wastage flagged at 10 percent of use, worth and top reason shown', () => {
    const f = D.wastageFlags([{ ingredientId: 'c', qty: 50, reason: 'spoiled' }, { ingredientId: 'c', qty: 10, reason: 'dropped' }, { ingredientId: 'f', qty: 1, reason: 'spill' }], { c: 300, f: 600 }, ing);
    expect(f.length).toBe(1); expect(f[0].ingredientId).toBe('c'); expect(f[0].wasted).toBe(60); expect(f[0].worth).toBe(24); expect(f[0].topReason).toBe('spoiled'); expect(f[0].sharePercent).toBe(16.7);
  });
});

describe('pub rules', () => {
  test('bottle variance: sold versus opened, tolerance, short or over', () => {
    expect(D.soldMl([{ measureMl: 30, qty: 4 }, { measureMl: 60, qty: 2 }])).toBe(240);
    const ok = D.bottleVariance({ openingMl: 1000, receivedMl: 750, soldMl: 600, closingMl: 1140 });
    expect(ok.expectedMl).toBe(1150); expect(ok.varianceMl).toBe(-10); expect(ok.flag).toBe('ok');
    const short = D.bottleVariance({ openingMl: 1000, receivedMl: 0, soldMl: 300, closingMl: 600 });
    expect(short.varianceMl).toBe(-100); expect(short.variancePercent).toBe(10); expect(short.flag).toBe('short');
    expect(D.bottleVariance({ openingMl: 1000, soldMl: 300, closingMl: 760 }).flag).toBe('over');
    expect(fails(() => D.bottleVariance({ openingMl: -1, soldMl: 0, closingMl: 0 }), 'PUB_INVALID')).toBe(true);
  });
  test('happy hour: day and time window, overnight window counts for the day it started', () => {
    const hh = { label: 'Happy hour', days: [1, 2, 3, 4, 5], from: '16:00', to: '19:00', type: 'percent_off', value: 25 };
    expect(D.ruleActive(hh, { day: 2, minutes: 17 * 60 })).toBe(true);
    expect(D.ruleActive(hh, { day: 2, minutes: 19 * 60 })).toBe(false);
    expect(D.ruleActive(hh, { day: 0, minutes: 17 * 60 })).toBe(false);
    const late = { label: 'Late', days: [5], from: '22:00', to: '02:00', type: 'amount_off', value: 20 };
    expect(D.ruleActive(late, { day: 5, minutes: 23 * 60 })).toBe(true);
    expect(D.ruleActive(late, { day: 6, minutes: 60 })).toBe(true);
    expect(D.ruleActive(late, { day: 5, minutes: 60 })).toBe(false);
    expect(fails(() => D.ruleActive({ days: [1], from: '10:00', to: '10:00' }, { day: 1, minutes: 600 }), 'PUB_INVALID')).toBe(true);
  });
  test('price now: best active rule wins, never below zero, item filter, reason shown', () => {
    const rules = [{ label: 'Happy hour', days: [3], from: '16:00', to: '19:00', type: 'percent_off', value: 25 }, { label: 'Beer flat', days: [3], from: '16:00', to: '19:00', type: 'amount_off', value: 100, appliesTo: ['beer'] }];
    expect(D.priceNow({ key: 'beer', price: 200 }, rules, { day: 3, minutes: 1000 })).toEqual({ price: 100, rule: 'Beer flat' });
    expect(D.priceNow({ key: 'wine', price: 200 }, rules, { day: 3, minutes: 1000 })).toEqual({ price: 150, rule: 'Happy hour' });
    expect(D.priceNow({ key: 'beer', price: 80 }, rules, { day: 3, minutes: 1000 }).price).toBe(0);
    expect(D.priceNow({ key: 'beer', price: 200 }, rules, { day: 3, minutes: 1200 })).toEqual({ price: 200, rule: null });
  });
});

describe('insights', () => {
  test('menu engineering: keep, reprice, promote, drop, and no-cost items say what to do', () => {
    const r = D.bestWorst([
      { key: 'a', name: 'Biryani', qty: 100, revenue: 20000, cost: 6000 },
      { key: 'b', name: 'Soup', qty: 90, revenue: 5400, cost: 4500 },
      { key: 'c', name: 'Steak', qty: 10, revenue: 5000, cost: 2000 },
      { key: 'd', name: 'Salad', qty: 8, revenue: 960, cost: 800 },
      { key: 'e', name: 'Tea', qty: 50, revenue: 500, cost: null },
    ]);
    const v = Object.fromEntries(r.map((x) => [x.key, x.verdict]));
    expect(v).toEqual({ a: 'keep', b: 'reprice', c: 'promote', d: 'drop', e: 'no_cost' });
    expect(r[0].reason).toMatch(/Biryani/);
  });
  test('slow hours: under half the median open hour, with a reason', () => {
    const h = D.slowHours([{ hour: 12, sales: 5000 }, { hour: 13, sales: 6000 }, { hour: 15, sales: 900 }, { hour: 19, sales: 7000 }, { hour: 16, sales: 1000, open: false }]);
    expect(h.length).toBe(1); expect(h[0].hour).toBe(15); expect(h[0].reason).toMatch(/Rs 900/);
    expect(D.slowHours([])).toEqual([]);
  });
  test('leakage flags: voids, discounts, cash short, reopens; a clean day gives none', () => {
    const base = { bills: 50, voidsAfterSend: 0, discountTotal: 200, grossSales: 20000, cashExpected: 5000, cashCounted: 5000, reopens: 0 };
    expect(D.leakageFlags(base)).toEqual([]);
    const f = D.leakageFlags({ ...base, voidsAfterSend: 4, discountTotal: 3000, cashCounted: 4800, reopens: 3 });
    expect(f.map((x) => x.code)).toEqual(['voids', 'discounts', 'cash_short', 'reopens']);
  });
});
