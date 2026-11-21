import { describe, test, expect } from 'vitest';
import { createQueue } from '../src/pos/offlineQueue.js';

const memory = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const err = (status, message) => { const e = new Error(message); e.status = status; return e; };

describe('offline bill queue', () => {
  test('adds a bill with a clientId and does not add the same one twice', () => {
    const q = createQueue(memory());
    const a = q.add({ lines: [], deviceId: 'tab1' });
    q.add(a);
    expect(q.pending()).toHaveLength(1);
    expect(a.clientId).toMatch(/^tab1-/);
  });
  test('sends all when online and empties the queue', async () => {
    const q = createQueue(memory()); q.add({ n: 1 }); q.add({ n: 2 });
    const sent = [];
    const r = await q.flush(async (b) => { sent.push(b.n); });
    expect(sent).toEqual([1, 2]); expect(r).toEqual({ sent: 2, rejected: 0, left: 0 }); expect(q.pending()).toHaveLength(0);
  });
  test('network down: stops, keeps every bill in order', async () => {
    const q = createQueue(memory()); q.add({ n: 1 }); q.add({ n: 2 }); q.add({ n: 3 });
    let calls = 0;
    const r = await q.flush(async () => { calls += 1; if (calls === 2) throw new Error('offline'); });
    expect(r.sent).toBe(1); expect(r.left).toBe(2); expect(q.pending().map((b) => b.n)).toEqual([2, 3]);
  });
  test('server error (500) keeps the bill; refused bill (409) moves to rejected and the rest continue', async () => {
    const q = createQueue(memory()); q.add({ n: 1 }); q.add({ n: 2 });
    const r = await q.flush(async (b) => { if (b.n === 1) throw err(409, 'Not enough stock for Gel.'); });
    expect(r).toEqual({ sent: 1, rejected: 1, left: 0 });
    expect(q.rejected()[0].reason).toBe('Not enough stock for Gel.');
    q.add({ n: 3 });
    const r2 = await q.flush(async () => { throw err(500, 'boom'); });
    expect(r2.left).toBe(1);
  });
  test('a rejected bill can be dismissed after staff deal with it', async () => {
    const q = createQueue(memory()); const e = q.add({ n: 1 });
    await q.flush(async () => { throw err(400, 'bad'); });
    q.dismiss(e.clientId);
    expect(q.rejected()).toHaveLength(0);
  });
  test('full storage is reported, not silently lost', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    let msg = '';
    try { createQueue(full).add({ n: 1 }); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/out of storage/);
  });
});
