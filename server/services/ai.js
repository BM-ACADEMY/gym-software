// Single internal AI service every module routes generation through, so the
// model/provider can be swapped later without touching any controller (doc's
// explicit requirement). generateWorkoutDietPlan calls Claude when
// ANTHROPIC_API_KEY is configured; every other function here (churn risk,
// no-show prediction, slot suggestion) is a legible rule-based scorer by
// design, not a placeholder for an LLM call — the doc only calls out an LLM
// for AI Plans.
const Anthropic = require('@anthropic-ai/sdk');

const GOAL_PROFILES = {
  'fat loss': { split: ['Full Body Circuit', 'Cardio + Core', 'Full Body Circuit', 'Active Recovery'], calorieAdjust: -400, proteinPerKg: 1.8 },
  'muscle gain': { split: ['Push', 'Pull', 'Legs', 'Upper Body'], calorieAdjust: 300, proteinPerKg: 2.0 },
  strength: { split: ['Squat Focus', 'Bench Focus', 'Deadlift Focus', 'Accessory'], calorieAdjust: 200, proteinPerKg: 1.8 },
  'general fitness': { split: ['Full Body', 'Cardio', 'Full Body', 'Mobility'], calorieAdjust: 0, proteinPerKg: 1.6 },
};

const EXERCISE_LIBRARY = {
  'Full Body Circuit': { gym: ['Goblet squat', 'Kettlebell swing', 'Dumbbell row', 'Push-up', 'Plank'], bodyweight: ['Bodyweight squat', 'Jumping jack', 'Push-up', 'Mountain climber', 'Plank'] },
  'Cardio + Core': { gym: ['Rowing machine', 'Bicycle crunch', 'Russian twist', 'Treadmill intervals'], bodyweight: ['Jog in place', 'Bicycle crunch', 'Russian twist', 'High knees'] },
  'Active Recovery': { gym: ['Incline walk', 'Foam rolling', 'Stretch flow'], bodyweight: ['Walk', 'Stretch flow', 'Yoga flow'] },
  Push: { gym: ['Bench press', 'Overhead press', 'Tricep pushdown', 'Lateral raise'], bodyweight: ['Push-up', 'Pike push-up', 'Tricep dip'] },
  Pull: { gym: ['Pull-up', 'Barbell row', 'Lat pulldown', 'Bicep curl'], bodyweight: ['Pull-up', 'Inverted row', 'Bicep curl (band)'] },
  Legs: { gym: ['Back squat', 'Romanian deadlift', 'Leg press', 'Calf raise'], bodyweight: ['Bodyweight squat', 'Lunge', 'Glute bridge', 'Calf raise'] },
  'Upper Body': { gym: ['Incline press', 'Seated row', 'Shoulder press', 'Face pull'], bodyweight: ['Push-up', 'Inverted row', 'Pike push-up'] },
  'Squat Focus': { gym: ['Back squat', 'Front squat', 'Leg press', 'Walking lunge'], bodyweight: ['Bodyweight squat', 'Bulgarian split squat', 'Walking lunge'] },
  'Bench Focus': { gym: ['Bench press', 'Incline press', 'Overhead press', 'Tricep pushdown'], bodyweight: ['Push-up', 'Pike push-up', 'Tricep dip'] },
  'Deadlift Focus': { gym: ['Deadlift', 'Romanian deadlift', 'Barbell row', 'Good morning'], bodyweight: ['Glute bridge', 'Single-leg deadlift', 'Superman'] },
  Accessory: { gym: ['Lateral raise', 'Face pull', 'Bicep curl', 'Plank'], bodyweight: ['Lateral raise (band)', 'Plank', 'Bicep curl (band)'] },
  'Full Body': { gym: ['Squat', 'Bench press', 'Row', 'Plank'], bodyweight: ['Bodyweight squat', 'Push-up', 'Inverted row', 'Plank'] },
  Cardio: { gym: ['Treadmill intervals', 'Rowing machine', 'Cycling'], bodyweight: ['Jog', 'Jumping jack', 'High knees'] },
  Mobility: { gym: ['Foam rolling', 'Hip flexor stretch', 'Thoracic rotation'], bodyweight: ['Hip flexor stretch', 'Cat-cow', 'Thoracic rotation'] },
};

const DEFAULT_EXERCISES = { gym: ['Full body circuit'], bodyweight: ['Bodyweight circuit'] };

// Doc: avoid/flag exercises that could aggravate a noted medical condition —
// a simple keyword match, not a substitute for real medical judgment.
const CAUTION_KEYWORDS = {
  knee: ['squat', 'lunge', 'jump'],
  back: ['deadlift', 'good morning', 'row'],
  shoulder: ['overhead press', 'bench press', 'pull-up', 'push-up'],
};

const resolveGoalKey = (goal = '') => {
  const g = goal.toLowerCase();
  if (g.includes('fat') || g.includes('lose') || g.includes('weight loss')) return 'fat loss';
  if (g.includes('muscle') || g.includes('bulk') || g.includes('gain')) return 'muscle gain';
  if (g.includes('strength') || g.includes('powerlifting') || g.includes('power')) return 'strength';
  return 'general fitness';
};

const getCautions = (medicalNotes = '') => {
  const notes = medicalNotes.toLowerCase();
  return Object.entries(CAUTION_KEYWORDS)
    .filter(([keyword]) => notes.includes(keyword))
    .map(([concern, avoid]) => ({ concern, avoidKeywords: avoid }));
};

const buildWorkoutJson = ({ goal, equipmentAvailable, medicalNotes }) => {
  const goalKey = resolveGoalKey(goal);
  const profile = GOAL_PROFILES[goalKey];
  const cautions = getCautions(medicalNotes);
  const avoidKeywords = cautions.flatMap((c) => c.avoidKeywords);
  const hasGymEquipment = !!equipmentAvailable && !/none|bodyweight only/i.test(equipmentAvailable);
  const equipmentTier = hasGymEquipment ? 'gym' : 'bodyweight';

  const days = profile.split.map((focus, i) => {
    const pool = EXERCISE_LIBRARY[focus]?.[equipmentTier] || DEFAULT_EXERCISES[equipmentTier];
    const exercises = pool
      .filter((name) => !avoidKeywords.some((kw) => name.toLowerCase().includes(kw)))
      .map((name) => ({ name, sets: 3, reps: goalKey === 'strength' ? '4-6' : '8-12' }));
    return { day: `Day ${i + 1}`, focus, exercises };
  });

  return { goal: goalKey, equipmentTier, cautions, days };
};

const buildDietJson = ({ goal, bodyStats = {} }) => {
  const goalKey = resolveGoalKey(goal);
  const profile = GOAL_PROFILES[goalKey];
  const weight = Number(bodyStats.weightKg) || 70;

  // A rough activity-adjusted maintenance estimate — not a clinical calculation.
  const maintenanceCalories = Math.round(weight * 24 * 1.4);
  const targetCalories = Math.max(1200, maintenanceCalories + profile.calorieAdjust);
  const proteinGrams = Math.round(weight * profile.proteinPerKg);
  const remainingCalories = Math.max(0, targetCalories - proteinGrams * 4);

  return {
    goal: goalKey,
    targetCalories,
    macros: {
      proteinGrams,
      carbsGrams: Math.round((remainingCalories * 0.55) / 4),
      fatGrams: Math.round((remainingCalories * 0.45) / 9),
    },
    meals: [
      { meal: 'Breakfast', suggestion: 'Protein + complex carbs (e.g. eggs/oats or paneer/poha)' },
      { meal: 'Lunch', suggestion: 'Lean protein + rice/roti + vegetables' },
      { meal: 'Snack', suggestion: 'Greek yogurt or a protein shake with fruit' },
      { meal: 'Dinner', suggestion: 'Lean protein + salad, lighter on carbs' },
    ],
  };
};

// Claude must reply with exactly this shape so it drops straight into
// AIPlan.workoutJson/dietJson — the same fields the rule-based fallback
// below produces, and what client/src/pages/member/WorkoutDietPlan.jsx renders.
const WORKOUT_DIET_SCHEMA_INSTRUCTIONS = `Respond with ONLY a single valid JSON object — no markdown code fences, no commentary before or after — matching exactly this shape:
{
  "workoutJson": {
    "goal": string,
    "equipmentTier": "gym" or "bodyweight",
    "cautions": [{ "concern": string, "avoidKeywords": string[] }],
    "days": [{ "day": string, "focus": string, "exercises": [{ "name": string, "sets": number, "reps": string }] }]
  },
  "dietJson": {
    "goal": string,
    "targetCalories": number,
    "macros": { "proteinGrams": number, "carbsGrams": number, "fatGrams": number },
    "meals": [{ "meal": string, "suggestion": string }]
  }
}
Include 3-5 workout days and 4-5 meals. If medical notes mention an injury/condition, list it under cautions and avoid exercises that would aggravate it.`;

// Pulls the first {...} object out of Claude's reply — tolerates the odd
// stray sentence or markdown fence around the JSON without over-parsing.
const extractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in Claude response');
  return JSON.parse(text.slice(start, end + 1));
};

const generateWithClaude = async ({ goal, medicalNotes, equipmentAvailable, bodyStats }) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Create a personalized workout and diet plan for a gym member.
Goal: ${goal || 'general fitness'}
Medical notes / conditions to work around: ${medicalNotes || 'none reported'}
Equipment available: ${equipmentAvailable || 'bodyweight only'}
Body weight in kg, if known: ${bodyStats?.weightKg || 'unknown'}

${WORKOUT_DIET_SCHEMA_INSTRUCTIONS}`;

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to generate this plan');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock?.text) throw new Error('No text content in Claude response');

  const parsed = extractJson(textBlock.text);
  if (!Array.isArray(parsed.workoutJson?.days) || parsed.workoutJson.days.length === 0 || !parsed.dietJson?.macros) {
    throw new Error('Claude response is missing required workoutJson/dietJson fields');
  }
  return parsed;
};

// @param member  { goal, medicalNotes, equipmentAvailable }
// @param bodyStats  { weightKg } — from the member's latest progress log entry, if any
const generateWorkoutDietPlan = async ({ goal, medicalNotes, equipmentAvailable, bodyStats }) => {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await generateWithClaude({ goal, medicalNotes, equipmentAvailable, bodyStats });
    } catch (error) {
      console.warn('Claude AI plan generation failed — falling back to the built-in generator:', error.message);
    }
  }

  return {
    workoutJson: buildWorkoutJson({ goal, equipmentAvailable, medicalNotes }),
    dietJson: buildDietJson({ goal, bodyStats }),
  };
};

// ===== Churn / retention risk (Root Admin per-gym, Gym Owner per-member) =====
// Doc inputs: attendance frequency drop, plan expiry proximity, payment delays
// (member-level) or login activity, expiring plan, falling member count (gym-level).
// A simple weighted-factor score, not a trained model — real, legible reasoning
// a Gym Owner or Root Admin can act on, which matters more here than raw accuracy.

const addRisk = (factors, points, reason) => {
  factors.points += points;
  if (points > 0) factors.reasons.push(reason);
};

const scoreToLevel = (score) => (score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low');

// @param recentCheckIns   check-ins in the last 14 days
// @param priorCheckIns    check-ins in the 14 days before that
// @param daysUntilExpiry  null if no active plan / expiry date
// @param hasOverduePayment boolean
const computeMemberChurnRisk = ({ recentCheckIns, priorCheckIns, daysUntilExpiry, hasOverduePayment }) => {
  const factors = { points: 0, reasons: [] };

  if (priorCheckIns > 0) {
    const drop = (priorCheckIns - recentCheckIns) / priorCheckIns;
    if (drop >= 0.5) addRisk(factors, 40, 'Attendance dropped more than 50% in the last two weeks');
    else if (drop >= 0.25) addRisk(factors, 20, 'Attendance dropped over the last two weeks');
  } else if (recentCheckIns === 0) {
    addRisk(factors, 15, 'No recent gym visits');
  }

  if (daysUntilExpiry !== null && daysUntilExpiry !== undefined) {
    if (daysUntilExpiry <= 3) addRisk(factors, 30, 'Plan expires within 3 days');
    else if (daysUntilExpiry <= 7) addRisk(factors, 20, 'Plan expires within a week');
    else if (daysUntilExpiry <= 14) addRisk(factors, 10, 'Plan expires within two weeks');
  }

  if (hasOverduePayment) addRisk(factors, 30, 'Has an overdue payment');

  const score = Math.min(100, factors.points);
  const level = scoreToLevel(score);
  const suggestedAction =
    level === 'high'
      ? 'Reach out personally — a call or a renewal discount could save this member'
      : level === 'medium'
        ? 'Send a check-in message or a small incentive to re-engage'
        : 'No action needed right now';

  return { score, level, reasons: factors.reasons, suggestedAction };
};

// @param loginGapDays        days since the gym's Admin/Sub-Admin last logged in
// @param platformDaysUntilExpiry  days until the gym's platform billing is due, or null
// @param memberCountChangePct  e.g. -0.15 for a 15% drop over the last 30 days
const computeSubscriberChurnRisk = ({ loginGapDays, platformDaysUntilExpiry, memberCountChangePct }) => {
  const factors = { points: 0, reasons: [] };

  if (loginGapDays >= 14) addRisk(factors, 35, `No login activity in ${loginGapDays} days`);
  else if (loginGapDays >= 7) addRisk(factors, 15, `Low login activity (${loginGapDays} days since last login)`);

  if (platformDaysUntilExpiry !== null && platformDaysUntilExpiry !== undefined) {
    if (platformDaysUntilExpiry <= 3) addRisk(factors, 30, 'Platform subscription renews within 3 days');
    else if (platformDaysUntilExpiry <= 7) addRisk(factors, 15, 'Platform subscription renews within a week');
  }

  if (memberCountChangePct <= -0.2) addRisk(factors, 35, `Member count fell ${Math.round(Math.abs(memberCountChangePct) * 100)}% recently`);
  else if (memberCountChangePct <= -0.1) addRisk(factors, 15, `Member count is trending down`);

  const score = Math.min(100, factors.points);
  return { score, level: scoreToLevel(score), reasons: factors.reasons };
};

// ===== No-show prediction for PT sessions =====
// @param pastSessionStatuses  array of 'completed' | 'no_show' for this member's history
const MIN_SESSIONS_FOR_PREDICTION = 3;
const predictNoShowRisk = (pastSessionStatuses = []) => {
  const relevant = pastSessionStatuses.filter((s) => s === 'completed' || s === 'no_show');
  if (relevant.length < MIN_SESSIONS_FOR_PREDICTION) {
    return { predicted: false, rate: null, sampleSize: relevant.length };
  }
  const noShows = relevant.filter((s) => s === 'no_show').length;
  const rate = noShows / relevant.length;
  return { predicted: rate >= 0.3, rate, sampleSize: relevant.length };
};

// ===== Optimal PT slot suggestion =====
// @param bookedHourSlots  Set/array of 'YYYY-MM-DD-HH' strings already taken on the trainer's calendar
// @param memberUsualHours array of hour-of-day (0-23) the member has historically checked in at
// @param daysAhead        how many upcoming days to search
const suggestOptimalSlots = ({ bookedSlotKeys = [], memberUsualHours = [], daysAhead = 7, fromDate = new Date() }) => {
  const bookedSet = new Set(bookedSlotKeys);

  const hourCounts = memberUsualHours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {});
  const rankedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).map(([h]) => Number(h));
  const candidateHours = rankedHours.length ? rankedHours.slice(0, 2) : [7, 18]; // fall back to common gym-visit hours

  const suggestions = [];
  for (let dayOffset = 1; dayOffset <= daysAhead && suggestions.length < 3; dayOffset++) {
    const date = new Date(fromDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    for (const hour of candidateHours) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, 0, 0, 0);
      const key = slotDate.toISOString().slice(0, 13);
      if (!bookedSet.has(key)) {
        suggestions.push({ scheduledAt: slotDate.toISOString(), reason: rankedHours.length ? "Matches this member's usual gym-visit time" : 'Common training slot' });
        if (suggestions.length >= 3) break;
      }
    }
  }
  return suggestions;
};

// ===== Monthly narrative report =====
const pctChange = (from, to) => (from === 0 ? (to > 0 ? 1 : 0) : (to - from) / from);

const splitInHalf = (series, valueKey) => {
  const mid = Math.ceil(series.length / 2);
  const sum = (arr) => arr.reduce((s, d) => s + (d[valueKey] || 0), 0);
  return { earlier: sum(series.slice(0, mid)), later: sum(series.slice(mid)) };
};

const generateMonthlyNarrative = ({ attendanceTrend = [], revenueTrend = [], memberGrowth = [], retention = {} }) => {
  const attendanceSplit = splitInHalf(attendanceTrend, 'count');
  const revenueSplit = splitInHalf(revenueTrend, 'total');
  const attendanceChange = pctChange(attendanceSplit.earlier, attendanceSplit.later);
  const revenueChange = pctChange(revenueSplit.earlier, revenueSplit.later);
  const newMembers = memberGrowth.reduce((s, d) => s + (d.newMembers || 0), 0);

  const sentences = [];
  const suggestions = [];

  if (attendanceChange <= -0.1) {
    sentences.push(`Attendance dropped ${Math.round(Math.abs(attendanceChange) * 100)}% this period.`);
    suggestions.push('Consider a re-engagement promo or a reminder campaign for inactive members.');
  } else if (attendanceChange >= 0.1) {
    sentences.push(`Attendance rose ${Math.round(attendanceChange * 100)}% this period — keep it up.`);
  } else {
    sentences.push('Attendance stayed roughly steady this period.');
  }

  if (revenueChange <= -0.1) {
    sentences.push(`Revenue is down ${Math.round(Math.abs(revenueChange) * 100)}% compared to earlier in the period.`);
    suggestions.push('Review upcoming renewals and follow up on overdue payments.');
  } else if (revenueChange >= 0.1) {
    sentences.push(`Revenue grew ${Math.round(revenueChange * 100)}% compared to earlier in the period.`);
  }

  if (newMembers > 0) {
    sentences.push(`You gained ${newMembers} new member${newMembers === 1 ? '' : 's'}.`);
  }
  if (retention.churnedThisPeriod > 0) {
    sentences.push(`${retention.churnedThisPeriod} member${retention.churnedThisPeriod === 1 ? '' : 's'} churned.`);
    suggestions.push('Check in with recently churned members to understand why they left.');
  }

  if (suggestions.length === 0) suggestions.push('No urgent action needed — performance looks stable.');

  return { summary: sentences.join(' '), suggestions: suggestions.slice(0, 3) };
};

// ===== Smart renewal reminder timing =====
// @param history  array of { sentHour: 0-23, responseMinutes: number } from past
//                 notifications this member actually read, sentHour derived from sentAt
const MIN_HISTORY_FOR_TIMING = 3;
const suggestBestSendHour = (history = []) => {
  if (history.length < MIN_HISTORY_FOR_TIMING) return { hour: null, confidence: 'low' };

  const byHour = history.reduce((acc, h) => {
    (acc[h.sentHour] ||= []).push(h.responseMinutes);
    return acc;
  }, {});

  let bestHour = null;
  let bestAvg = Infinity;
  for (const [hour, delays] of Object.entries(byHour)) {
    const avg = delays.reduce((s, d) => s + d, 0) / delays.length;
    if (avg < bestAvg) { bestAvg = avg; bestHour = Number(hour); }
  }

  return { hour: bestHour, confidence: history.length >= 6 ? 'high' : 'medium' };
};

module.exports = {
  generateWorkoutDietPlan,
  computeMemberChurnRisk,
  computeSubscriberChurnRisk,
  predictNoShowRisk,
  suggestOptimalSlots,
  generateMonthlyNarrative,
  suggestBestSendHour,
};
