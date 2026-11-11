'use strict';
// Recipe costing, stock deduction and wastage checks. Pure.
// Ingredient costs are rupees per base unit and may be fractional (Rs 0.45 per gram), so cost figures here are ANALYSIS numbers
// (rounded to 2 decimals), never amounts posted on a bill. Bills stay whole rupees.
// ingredients: { [id]: { name, unit, costPerUnit } }   recipes: { [dishKey]: { portion: 1, parts: [{ ingredientId, qty }] } }
const r2 = (n) => Math.round(n * 100) / 100;
const bad = (m) => { const e = new Error(m); e.code = 'COST_INVALID'; throw e; };

function dishCost(recipe, ingredients) {
  if (!recipe || !Array.isArray(recipe.parts) || !recipe.parts.length) bad('A recipe needs at least one ingredient.');
  let total = 0; const missing = [];
  for (const p of recipe.parts) {
    const ing = ingredients[p.ingredientId];
    if (!ing || !Number.isFinite(ing.costPerUnit) || ing.costPerUnit < 0) { missing.push(p.ingredientId); continue; }
    if (!Number.isFinite(p.qty) || p.qty <= 0) bad('Ingredient quantity must be more than zero.');
    total += p.qty * ing.costPerUnit;
  }
  return { cost: r2(total / (recipe.portion || 1)), missing };
}
// What the sold lines used from stock. sold: [{ dishKey, qty }]. Dishes without a recipe are reported, not guessed.
function deductions(sold, recipes) {
  const used = {}; const noRecipe = new Set();
  for (const s of sold) {
    const rc = recipes[s.dishKey];
    if (!rc) { noRecipe.add(s.dishKey); continue; }
    for (const p of rc.parts) used[p.ingredientId] = (used[p.ingredientId] || 0) + (p.qty * s.qty) / (rc.portion || 1);
  }
  return { used: Object.fromEntries(Object.entries(used).map(([k, v]) => [k, r2(v)])), noRecipe: [...noRecipe] };
}
// Daily food-cost percentage = cost of what was sold / sales before GST. sold: [{ dishKey, qty, revenue }] revenue = taxable rupees for that line.
function foodCostPercent(sold, recipes, ingredients) {
  let cost = 0; let revenue = 0; const skipped = [];
  for (const s of sold) {
    const rc = recipes[s.dishKey];
    if (!rc) { skipped.push(s.dishKey); continue; }
    const d = dishCost(rc, ingredients);
    if (d.missing.length) { skipped.push(s.dishKey); continue; }
    cost += d.cost * s.qty; revenue += s.revenue;
  }
  return { cost: r2(cost), revenue, percent: revenue > 0 ? Math.round((cost / revenue) * 1000) / 10 : null, skipped: [...new Set(skipped)], currency: 'INR' };
}
// Wastage check. waste: [{ ingredientId, qty, reason }], used: { id: qty } from deductions over the same period.
// Flags an ingredient when waste is at least `pct` percent of what was used plus wasted (default 10, Assumption: owner can change).
function wastageFlags(waste, used, ingredients, pct = 10) {
  const w = {}; const reasons = {};
  for (const x of waste) { w[x.ingredientId] = (w[x.ingredientId] || 0) + x.qty; (reasons[x.ingredientId] = reasons[x.ingredientId] || {})[x.reason || 'no reason'] = ((reasons[x.ingredientId] || {})[x.reason || 'no reason'] || 0) + x.qty; }
  const out = [];
  for (const id of Object.keys(w)) {
    const base = (used[id] || 0) + w[id]; const share = base > 0 ? (w[id] / base) * 100 : 0;
    const ing = ingredients[id] || {};
    if (share >= pct) out.push({ ingredientId: id, name: ing.name || id, wasted: r2(w[id]), sharePercent: Math.round(share * 10) / 10, worth: r2(w[id] * (ing.costPerUnit || 0)), topReason: Object.entries(reasons[id]).sort((a, b) => b[1] - a[1])[0][0] });
  }
  return out.sort((a, b) => b.worth - a.worth);
}
module.exports = { dishCost, deductions, foodCostPercent, wastageFlags };
