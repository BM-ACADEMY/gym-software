// C-03: fail-closed tenant scoping for Mongoose models. No database needed to test the logic.
//
// Rule: a query on a tenant model runs only inside runWithTenant(tenantId, fn) (the auth middleware does this),
// or inside runUnscoped(reason, fn) for the few jobs and Super Admin screens that must cross tenants.
// With neither, the query THROWS instead of returning every tenant's rows (fail closed).
// Inside a tenant context the tenant field is added to every filter, and a filter that names another tenant throws.
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

class TenantScopeError extends Error {
  constructor(message) { super(message); this.name = 'TenantScopeError'; this.code = 'TENANT_SCOPE'; }
}

const runWithTenant = (tenantId, fn) => {
  if (tenantId === undefined || tenantId === null || String(tenantId) === '') throw new TenantScopeError('runWithTenant needs a tenant id');
  return als.run({ tenantId: String(tenantId), unscoped: false }, fn);
};

// Explicit, named escape hatch. The reason is required so a code search shows every place that crosses tenants.
const runUnscoped = (reason, fn) => {
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) throw new TenantScopeError('runUnscoped needs a written reason');
  return als.run({ tenantId: null, unscoped: true, reason }, fn);
};

const currentContext = () => als.getStore() || null;
const currentTenantId = () => (als.getStore() && als.getStore().tenantId) || null;

// What to do with one query filter. Returns the filter to run, or throws.
// existing: the filter object already on the query. field: e.g. 'subscriberId'.
const scopeFilter = (existing, field, ctx) => {
  if (!ctx) throw new TenantScopeError(`Query on a tenant model ran outside any tenant context (field ${field})`);
  if (ctx.unscoped) return existing || {};
  const filter = existing || {};
  if (Object.prototype.hasOwnProperty.call(filter, field)) {
    const v = filter[field];
    // Only a plain value equal to the context tenant is allowed. Operators ($in, $ne ...) could widen the query.
    const plain = v !== null && typeof v === 'object' && !(typeof v.toString === 'function' && /^[a-f0-9]{24}$/i.test(String(v))) ? null : String(v);
    if (plain === null || plain !== ctx.tenantId) throw new TenantScopeError(`Filter names a different tenant or uses an operator on ${field}`);
    return filter;
  }
  return { ...filter, [field]: ctx.tenantId };
};

// Aggregation pipelines get a leading $match so the tenant is applied before anything else.
const scopePipeline = (pipeline, field, ctx) => {
  if (!ctx) throw new TenantScopeError(`Aggregate on a tenant model ran outside any tenant context (field ${field})`);
  if (ctx.unscoped) return pipeline;
  return [{ $match: { [field]: ctx.tenantId } }, ...pipeline];
};

// A new document: fill the tenant if empty, refuse a different one.
const scopeDocument = (doc, field, ctx) => {
  if (!ctx) throw new TenantScopeError(`Write to a tenant model ran outside any tenant context (field ${field})`);
  if (ctx.unscoped) return;
  const cur = doc[field];
  if (cur === undefined || cur === null) { doc[field] = ctx.tenantId; return; }
  if (String(cur) !== ctx.tenantId) throw new TenantScopeError(`Document ${field} does not match the current tenant`);
};

const QUERY_HOOKS = ['find', 'findOne', 'countDocuments', 'estimatedDocumentCount', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'distinct'];

// Mongoose plugin. Usage: schema.plugin(tenantPlugin, { field: 'subscriberId' }) on every tenant model.
const tenantPlugin = (schema, options = {}) => {
  const field = options.field || 'subscriberId';
  schema.statics.__afraTenantField = field; // lets the per-model check see that the plugin is applied
  for (const name of QUERY_HOOKS) {
    schema.pre(name, function tenantQueryHook() {
      const next = scopeFilter(this.getFilter ? this.getFilter() : this.getQuery(), field, currentContext());
      if (this.setQuery) this.setQuery(next); else this._conditions = next;
    });
  }
  schema.pre('aggregate', function tenantAggregateHook() {
    const next = scopePipeline(this.pipeline(), field, currentContext());
    this.pipeline().splice(0, this.pipeline().length, ...next);
  });
  schema.pre('save', function tenantSaveHook() { scopeDocument(this, field, currentContext()); });
  schema.pre('insertMany', function tenantInsertManyHook(next, docs) {
    const ctx = currentContext();
    for (const d of (Array.isArray(docs) ? docs : [docs])) scopeDocument(d, field, ctx);
    next();
  });
};

// Per-model proof (C-03 "a test per model"): lists every registered model that does not carry the plugin
// and is not on the explicit global list. models: { name: Model } (mongoose.models). A test fails if the result is not empty.
const modelsMissingTenantScope = (models, globalModels = []) => {
  const allowed = new Set(globalModels);
  return Object.keys(models).filter((n) => !allowed.has(n) && !(models[n] && models[n].schema && models[n].schema.statics && models[n].schema.statics.__afraTenantField));
};

module.exports = { TenantScopeError, runWithTenant, runUnscoped, currentContext, currentTenantId, scopeFilter, scopePipeline, scopeDocument, tenantPlugin, modelsMissingTenantScope, QUERY_HOOKS };
