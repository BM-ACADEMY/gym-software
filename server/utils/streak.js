// Given check-in timestamps, returns the current consecutive-day streak
// counting back from today — an in-progress today (no check-in yet) doesn't
// break a streak still active as of yesterday.
const computeStreak = (dates) => {
  const days = new Set(dates.map((d) => new Date(d).toDateString()));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

module.exports = { computeStreak };
