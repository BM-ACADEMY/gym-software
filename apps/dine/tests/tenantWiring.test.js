// C-04 pilot: the tenant guard is on every Dine model except the agency record, and the pieces that must cross agencies say why.
const fs = require('fs'); const path = require('path');
const makeModels = require('../src/models');
function fakeMongoose() {
  const registered = {};
  class Schema { constructor(def) { this.def = def; this.plugins = []; } index() {} plugin(fn, opts) { this.plugins.push({ fn, opts }); } }
  Schema.Types = { ObjectId: 'oid', Mixed: 'mixed' };
  const mongoose = { Schema, models: registered, Types: { ObjectId: function ObjectId(v) { this.v = v; } }, model: (name, schema) => { registered[name] = { schema }; return registered[name]; } };
  return mongoose;
}
describe('Dine tenant guard wiring (C-04 pilot)', () => {
  test('every model but DineTenant carries the guard on tenantId', () => {
    const m = fakeMongoose(); makeModels(m);
    const names = Object.keys(m.models);
    expect(names).toContain('DineTenant');
    for (const n of names) {
      const ps = m.models[n].schema.plugins;
      if (n === 'DineTenant') expect(ps).toHaveLength(0);
      else { expect(ps).toHaveLength(1); expect(ps[0].opts.field).toBe('tenantId'); expect(typeof ps[0].opts.castId).toBe('function'); }
    }
  });
  test('building the models twice does not add the guard twice', () => {
    const m = fakeMongoose(); makeModels(m); makeModels(m);
    expect(m.models.DineMenuItem.schema.plugins).toHaveLength(1);
  });
  test('every place that crosses venues is a named runUnscoped with a reason (source check)', () => {
    const dir = path.join(__dirname, '..', 'src'); const hits = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/runUnscoped\(\s*(['"`])([^'"`]*)\1/g)) hits.push([f, m[2]]);
    }
    expect(hits.length).toBeGreaterThan(2);
    for (const [, reason] of hits) expect(reason.length).toBeGreaterThan(14);
  });
  test('no raw driver or bulk calls that would skip the guard in Dine source', () => {
    const dir = path.join(__dirname, '..', 'src');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(/\.collection\.|bulkWrite|\.db\.collection/.test(src)).toBe(false);
    }
  });
});
