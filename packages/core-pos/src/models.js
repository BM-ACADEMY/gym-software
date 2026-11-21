// Shared shop records. The product passes in its own mongoose so the package has no dependency of its own.
// Every record carries tenantId and every query in routes.js filters by it (C-03 will make that automatic).
module.exports = (mongoose) => {
  const { Schema } = mongoose;
  const T = { type: Schema.Types.ObjectId, required: true, index: true };
  const define = (name, schema, indexes = []) => {
    if (mongoose.models[name]) return mongoose.models[name];
    const s = new Schema(schema, { timestamps: true });
    indexes.forEach(([f, o]) => s.index(f, o));
    return mongoose.model(name, s);
  };

  const PosCustomer = define('PosCustomer', {
    tenantId: T, name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true }, email: { type: String, trim: true, lowercase: true },
    note: { type: String, maxlength: 300 }, creditDue: { type: Number, default: 0 }, // pay-later balance, whole rupees
    currency: { type: String, default: 'INR' }, isActive: { type: Boolean, default: true },
  }, [[{ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }]]);

  const PosItem = define('PosItem', {
    tenantId: T, kind: { type: String, enum: ['item', 'service'], default: 'item' },
    name: { type: String, required: true, trim: true, maxlength: 120 }, sku: { type: String, trim: true }, barcode: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 }, cost: Number, unit: { type: String, trim: true, maxlength: 20 }, category: { type: String, trim: true, maxlength: 60 }, hsn: { type: String, trim: true, maxlength: 12 }, currency: { type: String, default: 'INR' }, gstRate: { type: Number, default: 0 },
    trackStock: { type: Boolean, default: false }, qty: { type: Number, default: 0 }, reorderLevel: Number,
    expiresAt: Date, isActive: { type: Boolean, default: true },
  }, [[{ tenantId: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } }], [{ tenantId: 1, name: 1 }, {}]]);

  const PosStockMove = define('PosStockMove', {
    tenantId: T, itemId: { type: Schema.Types.ObjectId, required: true }, type: { type: String, required: true },
    qty: { type: Number, required: true }, reason: String, billId: Schema.Types.ObjectId, by: Schema.Types.ObjectId,
  }, [[{ tenantId: 1, itemId: 1, createdAt: -1 }, {}]]);

  const PosLoyalty = define('PosLoyalty', {
    tenantId: T, customerId: { type: Schema.Types.ObjectId, required: true }, points: { type: Number, required: true },
    reason: { type: String, required: true }, billId: Schema.Types.ObjectId,
  }, [[{ tenantId: 1, customerId: 1, createdAt: -1 }, {}]]);

  const PosBill = define('PosBill', {
    tenantId: T, number: { type: String, required: true }, customerId: Schema.Types.ObjectId,
    lines: { type: [Schema.Types.Mixed], default: [] }, subtotal: Number, discount: Number, taxable: Number, gst: Number,
    cgst: Number, sgst: Number, igst: Number, total: { type: Number, required: true }, taxMode: String, gstMode: String,
    currency: { type: String, default: 'INR' }, payments: { type: [Schema.Types.Mixed], default: [] },
    received: Number, change: Number, credit: Number, due: Number,
    status: { type: String, enum: ['paid', 'partial', 'unpaid', 'credit', 'returned'], required: true },
    pointsEarned: { type: Number, default: 0 }, pointsUsed: { type: Number, default: 0 },
    returnedQty: { type: [Number], default: [] }, returnedAmount: { type: Number, default: 0 }, // part returns (returns.js)
    discountBy: { type: String, enum: ['owner', 'staff'] }, discountPercent: Number, discountReason: { type: String, maxlength: 120 }, // D-30, set by a product's beforeBill hook
    clientId: { type: String }, // set by an offline device so a retry never creates a second bill
    by: Schema.Types.ObjectId,
  }, [[{ tenantId: 1, number: 1 }, { unique: true }], [{ tenantId: 1, createdAt: -1 }, {}],
      [{ tenantId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }]]);

  const PosCounter = define('PosCounter', { tenantId: T, key: { type: String, required: true }, seq: { type: Number, default: 0 } }, [[{ tenantId: 1, key: 1 }, { unique: true }]]);

  return { PosCustomer, PosItem, PosStockMove, PosLoyalty, PosBill, PosCounter };
};
