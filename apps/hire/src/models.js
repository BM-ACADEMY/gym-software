// Hire records. The app passes its own mongoose. Every record carries tenantId (the agency) and every query
// in routes filters by it. Money: whole rupees with a currency code.
module.exports = (mongoose) => {
  const { Schema } = mongoose;
  const T = { type: Schema.Types.ObjectId, required: true, index: true };
  const define = (name, schema, indexes = []) => {
    if (mongoose.models[name]) return mongoose.models[name];
    const s = new Schema(schema, { timestamps: true });
    indexes.forEach(([f, o]) => s.index(f, o));
    return mongoose.model(name, s);
  };
  const Candidate = define('HireCandidate', {
    tenantId: T, name: { type: String, trim: true, maxlength: 120 }, phone: { type: String, trim: true }, email: { type: String, lowercase: true, trim: true },
    location: String, currentTitle: String, currentCompany: String, experienceYears: Number, noticeDays: Number,
    currentCtc: Number, expectedCtc: Number, currency: { type: String, default: 'INR' }, skills: [String],
    source: String, reviewed: { type: Boolean, default: false }, doNotContact: { type: Boolean, default: false },
    consent: { source: String, at: Date, purposeAi: Boolean, noticeVersion: String, withdrawnAt: Date },
    lastActivityAt: Date, lastCandidateMessageAt: Date,
  }, [[{ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }], [{ tenantId: 1, email: 1 }, {}]]);
  const Client = define('HireClient', { tenantId: T, name: { type: String, required: true, maxlength: 120 }, contactName: String, feeType: { type: String, enum: ['percent', 'flat'], default: 'percent' }, feeValue: Number, guaranteeDays: { type: Number, default: 30 }, shareToken: { type: String, index: true } });
  const Job = define('HireJob', { tenantId: T, clientId: Schema.Types.ObjectId, title: { type: String, required: true }, location: String, openings: { type: Number, default: 1 }, mustSkills: [String], niceSkills: [String], minExperience: Number, maxExperience: Number, maxCtc: Number, maxNoticeDays: Number, status: { type: String, enum: ['open', 'on_hold', 'filled', 'closed'], default: 'open' }, lastSubmissionAt: Date });
  const Entry = define('HireEntry', { tenantId: T, jobId: { type: Schema.Types.ObjectId, required: true }, candidateId: { type: Schema.Types.ObjectId, required: true }, stage: { type: String, default: 'sourced' }, stageAt: Date, history: [Schema.Types.Mixed], score: Number, scoreParts: [Schema.Types.Mixed], reason: String, lastContactAt: Date, otherOffers: Boolean, offeredCtc: Number, note: { type: String, maxlength: 500 }, clientDecision: { type: String, enum: ['interested', 'rejected'] } }, [[{ tenantId: 1, jobId: 1, candidateId: 1 }, { unique: true }]]);
  const Fee = define('HireFee', { tenantId: T, entryId: Schema.Types.ObjectId, fee: Number, gst: Number, total: Number, currency: { type: String, default: 'INR' }, issuedAt: Date, dueDate: Date, paidAt: Date });
  const UsageLog = define('HireUsage', { tenantId: T, kind: { type: String, enum: ['parse', 'rank', 'outreach'], required: true }, model: String, inTokens: Number, outTokens: Number }, [[{ tenantId: 1, kind: 1, createdAt: -1 }, {}]]);
  const AutopilotSettings = define('HireAutopilot', { tenantId: { ...T, unique: true }, paused: Boolean, quietFrom: Number, quietTo: Number, dailySendLimit: Number, jobs: Schema.Types.Mixed });
  const ActivityLog = define('HireActivity', { tenantId: T, job: String, ref: String, level: String, action: String, text: String }, [[{ tenantId: 1, createdAt: -1 }, {}]]);
  const Tenant = define('HireTenant', { agencyName: { type: String, required: true, maxlength: 120 }, state: String, currency: { type: String, default: 'INR' }, trialEndsAt: Date, paidUntil: Date, planKey: String, billingCycle: String, planStartedAt: Date, isActive: { type: Boolean, default: true }, termsAcceptedAt: Date, termsVersion: String });
  const User = define('HireUser', { tenantId: T, name: String, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, role: { type: String, enum: ['admin', 'subadmin'], default: 'admin' }, passwordHash: { type: String, required: true, select: false }, failedLogins: { type: Number, default: 0 }, lockedUntil: Date, isActive: { type: Boolean, default: true }, lastLoginAt: Date });
  return { Tenant, User, Candidate, Client, Job, Entry, Fee, UsageLog, AutopilotSettings, ActivityLog };
};
