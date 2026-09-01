// One-time migration: PlatformPlan.features used to be a flat string array.
// It's now a list of { feature: ObjectId ref PlanFeature, enabled, value }.
// This reads/writes via the raw driver (not the Mongoose models) so it works
// correctly regardless of whether the new schema has already been deployed.
// Also seeds one "count" example (AI Plan Generations) so the new toggle/count
// UI has something real to show. Safe to re-run.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function migrate() {
  await connectDB();
  const db = mongoose.connection.db;
  const plansCol = db.collection('platformplans');
  const featuresCol = db.collection('planfeatures');

  const plans = await plansCol.find().toArray();

  // 1. Collect every distinct free-text feature string still in the old shape.
  const labels = new Set();
  for (const plan of plans) {
    for (const f of plan.features || []) {
      if (typeof f === 'string') labels.add(f.trim());
    }
  }

  // 2. Upsert each as a toggle-type catalog entry.
  const idByLabel = {};
  for (const label of labels) {
    const key = slugify(label);
    const existing = await featuresCol.findOne({ key });
    if (existing) {
      idByLabel[label] = existing._id;
    } else {
      const result = await featuresCol.insertOne({
        name: label,
        key,
        type: 'toggle',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      idByLabel[label] = result.insertedId;
    }
  }
  console.log(`✔ ${labels.size} legacy feature strings migrated into the catalog`);

  // 3. Seed one count-type example feature so the UI has a real toggle+count case.
  const aiPlansKey = 'ai-plan-generations';
  let aiPlansFeature = await featuresCol.findOne({ key: aiPlansKey });
  if (!aiPlansFeature) {
    const result = await featuresCol.insertOne({
      name: 'AI Plan Generations',
      key: aiPlansKey,
      type: 'count',
      unit: '/month',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    aiPlansFeature = { _id: result.insertedId };
    console.log('✔ Seeded "AI Plan Generations" (count) example feature');
  }

  // 4. Rewrite each plan's features array to the new referenced shape.
  for (const plan of plans) {
    const alreadyMigrated = (plan.features || []).some((f) => f && typeof f === 'object' && f.feature);
    if (alreadyMigrated) continue;

    const newFeatures = (plan.features || [])
      .filter((f) => typeof f === 'string' && idByLabel[f.trim()])
      .map((f) => ({ feature: idByLabel[f.trim()], enabled: true }));

    // Give Growth a live count example (50/mo); Pro gets unlimited (no value = unlimited).
    if (plan.name === 'Growth') {
      newFeatures.push({ feature: aiPlansFeature._id, enabled: true, value: 50 });
    } else if (plan.name === 'Pro') {
      newFeatures.push({ feature: aiPlansFeature._id, enabled: true });
    }

    await plansCol.updateOne({ _id: plan._id }, { $set: { features: newFeatures } });
  }

  console.log(`✔ ${plans.length} platform plans migrated to the new features shape`);
  await mongoose.connection.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
