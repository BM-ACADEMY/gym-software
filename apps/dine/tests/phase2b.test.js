const PR = require('../src/print'); const { build, TID, OID } = require('./p2fake');
const paid = { id: OID, _id: OID, number: 'D-26-00007', status: 'paid', table: 'T4', createdAt: '2026-11-12T08:00:00Z', paidAt: '2026-11-12T09:00:00Z', serviceCharge: 25, grandTotal: 289, currency: 'INR', payments: [{ method: 'cash', amount: 300 }], settle: { received: 300, change: 11 },
  totals: { subtotal: 240, discount: 0, taxable: 240, gst: 24, cgst: 12, sgst: 12, igst: 0, total: 264, lines: [{ name: 'Dosa <b>', qty: 2, total: 126, taxable: 120, gst: 6, rate: 5 }, { name: 'Coffee', qty: 3, total: 138, taxable: 120, gst: 18, rate: 18 }] },
  lines: [{ id: 'l1', name: 'Dosa', qty: 2, station: 'kitchen', status: 'sent', note: 'no onion' }, { id: 'l2', name: 'Beer', qty: 1, station: 'bar', status: 'sent' }, { id: 'l3', name: 'Gone', qty: 1, station: 'kitchen', status: 'void' }], events: [] };
describe('printed bill and KOT (Dine Phase 2)', () => {
  test('bill page: venue and FSSAI in the footer, service charge as a line, text escaped, total equals the order total', () => {
    const h = PR.billPrintHtml(paid, { name: 'Cafe & Co', address: 'MG Road', phone: '9876543210', fssai: '12345678901234' }, { size: 'A4' });
    expect(h).toContain('Cafe &amp; Co'); expect(h).toContain('FSSAI Lic. No. 12345678901234'); expect(h).toContain('Service charge'); expect(h.indexOf('Dosa <b>')).toBe(-1); expect(h).toContain('Dosa &lt;b&gt;');
    expect(h).toContain('Rs 289'); expect(h).toContain('Change'); expect(h).toContain('A4');
  });
  test('bill page refuses an order that has no bill yet', () => { expect(() => PR.billPrintHtml({ status: 'open' }, { name: 'X' })).toThrow(); });
  test('KOT: only that station, no void and no prices, note shown', () => {
    const k = PR.kotPrintHtml(paid, 'kitchen', { name: 'Cafe' }, 'now');
    expect(k).toContain('Dosa'); expect(k).toContain('no onion'); expect(k.indexOf('Beer')).toBe(-1); expect(k.indexOf('Gone')).toBe(-1); expect(k.indexOf('Rs')).toBe(-1);
    expect(() => PR.kotPrintHtml({ lines: [{ name: 'X', station: 'bar', status: 'new' }], number: 'N' }, 'bar', {}, 'n')).toThrow();
  });
  test('print routes: bill only after billing; 404 for another venue order; role rules; HTML content type', async () => {
    const { run, calls } = build({ over: { 'Order.findOne': paid, 'Tenant.findById': { _id: TID, venueName: 'Cafe', settings: { venue: { fssai: '12345678901234' } } } } });
    const ok = await run('get', '/orders/:id/print/bill', { params: { id: OID } }); expect(ok.status).toBe(200); expect(ok.h['Content-Type']).toContain('text/html'); expect(ok.text).toContain('FSSAI');
    expect((await run('get', '/orders/:id/print/kot', { params: { id: OID }, query: { station: 'bar' } })).status).toBe(200);
    const open = build({ over: { 'Order.findOne': { ...paid, status: 'open' } } });
    expect((await open.run('get', '/orders/:id/print/bill', { params: { id: OID } })).status).toBe(400);
    expect((await build().run('get', '/orders/:id/print/bill', { params: { id: OID } })).status).toBe(404);
    const kitchen = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'kitchen' };
    expect((await run('get', '/orders/:id/print/bill', { params: { id: OID }, user: kitchen })).status).toBe(403);
    for (const c of calls) if (c.model === 'Order') expect(String(c.args[0].tenantId)).toBe(TID);
  });
});
