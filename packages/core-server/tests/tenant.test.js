const t = require('../src/tenant');

// A stand-in for a Mongoose schema: records the hooks the plugin registers.
const fakeSchema = () => { const hooks = {}; return { statics: {}, hooks, pre(name, fn) { (hooks[name] ||= []).push(fn); } }; };
const fakeQuery = (filter) => ({ _f: filter, getFilter() { return this._f; }, setQuery(f) { this._f = f; } });
const A = '64b000000000000000000001';
const B = '64b000000000000000000002';

describe('tenant guard (C-03)', () => {
  test('a query outside any context throws (fails closed)', async () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    expect(() => s.hooks.find[0].call(fakeQuery({}))).toThrow(/outside any tenant context/);
  });
  test('inside a tenant the tenant field is added to every query hook', async () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      for (const name of t.QUERY_HOOKS) {
        const q = fakeQuery({ status: 'active' });
        s.hooks[name][0].call(q);
        expect(q._f).toEqual({ status: 'active', subscriberId: A });
      }
    });
  });
  test('a filter naming another tenant throws', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      expect(() => s.hooks.find[0].call(fakeQuery({ subscriberId: B }))).toThrow(/different tenant/);
    });
  });
  test('an operator on the tenant field throws (cannot widen the query)', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      expect(() => s.hooks.find[0].call(fakeQuery({ subscriberId: { $in: [A, B] } }))).toThrow(/operator/);
      expect(() => s.hooks.find[0].call(fakeQuery({ subscriberId: { $ne: A } }))).toThrow(/operator/);
    });
  });
  test('the same tenant named in the filter is allowed', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => { const q = fakeQuery({ subscriberId: A }); s.hooks.find[0].call(q); expect(q._f.subscriberId).toBe(A); });
  });
  test('aggregate gets a leading $match; outside context it throws', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    const pipe = [{ $group: { _id: null } }];
    const agg = { pipeline: () => pipe };
    expect(() => s.hooks.aggregate[0].call(agg)).toThrow(/outside any tenant context/);
    t.runWithTenant(A, () => { s.hooks.aggregate[0].call(agg); expect(pipe[0]).toEqual({ $match: { subscriberId: A } }); expect(pipe.length).toBe(2); });
  });
  test('save fills a missing tenant and refuses a different one', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      const d1 = {}; s.hooks.save[0].call(d1); expect(d1.subscriberId).toBe(A);
      expect(() => s.hooks.save[0].call({ subscriberId: B })).toThrow(/does not match/);
    });
  });
  test('insertMany checks every document', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      const docs = [{}, { subscriberId: B }];
      expect(() => s.hooks.insertMany[0].call({}, () => {}, docs)).toThrow(/does not match/);
    });
  });
  test('runUnscoped needs a written reason and then leaves the filter alone', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    expect(() => t.runUnscoped('', () => {})).toThrow(/reason/);
    t.runUnscoped('Super Admin overview counts', () => { const q = fakeQuery({}); s.hooks.find[0].call(q); expect(q._f).toEqual({}); });
  });
  test('runWithTenant needs a tenant id', () => {
    expect(() => t.runWithTenant('', () => {})).toThrow(/tenant id/);
  });
  test('context does not leak between two parallel requests', async () => {
    const seen = [];
    await Promise.all([A, B].map((id) => t.runWithTenant(id, async () => { await new Promise((r) => setTimeout(r, id === A ? 10 : 1)); seen.push(t.currentTenantId()); })));
    expect(seen.sort()).toEqual([A, B].sort());
  });
  test('per-model check lists models without the plugin and honours the global list', () => {
    const scoped = fakeSchema(); t.tenantPlugin(scoped);
    const models = { Member: { schema: scoped }, Plan: { schema: fakeSchema() }, Audit: { schema: fakeSchema() } };
    expect(t.modelsMissingTenantScope(models, ['Plan'])).toEqual(['Audit']);
    expect(t.modelsMissingTenantScope({ Member: models.Member })).toEqual([]);
  });

  // ---- C-04 hardening (29/30 Oct) ----
  const upd = (filter, update) => ({ ...fakeQuery(filter), getUpdate() { return update; } });
  test('an update that changes the tenant field is refused, in every form', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      for (const name of t.UPDATE_HOOKS) {
        expect(() => s.hooks[name][0].call(upd({}, { subscriberId: B }))).toThrow(/may not change/);
        expect(() => s.hooks[name][0].call(upd({}, { $set: { subscriberId: B } }))).toThrow(/may not change/);
        expect(() => s.hooks[name][0].call(upd({}, { $unset: { subscriberId: 1 } }))).toThrow(/may not change/);
        expect(() => s.hooks[name][0].call(upd({}, { $rename: { owner: 'subscriberId' } }))).toThrow(/may not change/);
        expect(() => s.hooks[name][0].call(upd({}, [{ $set: { subscriberId: B } }]))).toThrow(/pipeline/);
      }
    });
  });
  test('a normal update passes and a read-only hook ignores the update check', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      expect(() => s.hooks.updateOne[0].call(upd({}, { $set: { status: 'x' } }))).not.toThrow();
      expect(() => s.hooks.find[0].call(upd({}, { $set: { subscriberId: B } }))).not.toThrow();
    });
  });
  test('an unscoped job may update across tenants', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runUnscoped('Move a record between agencies on support request', () => {
      expect(() => s.hooks.updateOne[0].call(upd({}, { $set: { subscriberId: B } }))).not.toThrow();
    });
  });
  test('aggregate uses castId so an ObjectId tenant field matches', () => {
    const s = fakeSchema(); t.tenantPlugin(s, { castId: (v) => ({ oid: v }) });
    const pipe = [{ $group: { _id: null } }];
    t.runWithTenant(A, () => { s.hooks.aggregate[0].call({ pipeline: () => pipe }); expect(pipe[0]).toEqual({ $match: { subscriberId: { oid: A } } }); });
  });
  test('bulkWrite is refused outside a tenant and inside one, allowed only unscoped', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    expect(() => s.hooks.bulkWrite[0].call({}, () => {})).toThrow(/outside any tenant context/);
    t.runWithTenant(A, () => expect(() => s.hooks.bulkWrite[0].call({}, () => {})).toThrow(/not allowed inside a tenant/));
    t.runUnscoped('Nightly import job for all agencies', () => expect(() => s.hooks.bulkWrite[0].call({}, () => {})).not.toThrow());
  });
  test('insertMany works with the callback style and the promise style', () => {
    const s = fakeSchema(); t.tenantPlugin(s);
    t.runWithTenant(A, () => {
      let called = 0;
      s.hooks.insertMany[0].call({}, () => { called += 1; }, [{}]);
      expect(called).toBe(1);
      expect(() => s.hooks.insertMany[0].call({}, [{ subscriberId: B }])).toThrow(/does not match/);
      const docs = [{}]; s.hooks.insertMany[0].call({}, docs); expect(docs[0].subscriberId).toBe(A);
    });
  });
});
