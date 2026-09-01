export const members = [
  { id: 1, name: 'Aarav Kumar', initials: 'AK', goal: 'Fat loss', plan: '12-week transform', progress: 68, lastVisit: 'Today, 7:20 AM', status: 'Active', phone: '98765 43210' },
  { id: 2, name: 'Meera Iyer', initials: 'MI', goal: 'Strength', plan: 'Strength builder', progress: 82, lastVisit: 'Today, 6:45 AM', status: 'Active', phone: '98761 20481' },
  { id: 3, name: 'Vikram Raj', initials: 'VR', goal: 'Muscle gain', plan: 'Hypertrophy', progress: 54, lastVisit: 'Yesterday, 7:10 PM', status: 'Active', phone: '97918 33120' },
  { id: 4, name: 'Nila Joseph', initials: 'NJ', goal: 'Mobility', plan: 'Move better', progress: 43, lastVisit: '3 days ago', status: 'At risk', phone: '86681 93042' },
  { id: 5, name: 'Rahul Dev', initials: 'RD', goal: 'Endurance', plan: 'Run strong', progress: 76, lastVisit: 'Today, 8:15 AM', status: 'Active', phone: '98421 11909' },
];

export const sessions = [
  { id: 1, time: '06:30', period: 'AM', member: 'Meera Iyer', type: 'Strength', duration: '60 min', status: 'Completed' },
  { id: 2, time: '08:00', period: 'AM', member: 'Aarav Kumar', type: 'HIIT', duration: '45 min', status: 'In progress' },
  { id: 3, time: '05:30', period: 'PM', member: 'Vikram Raj', type: 'Upper body', duration: '60 min', status: 'Upcoming' },
  { id: 4, time: '07:00', period: 'PM', member: 'Rahul Dev', type: 'Conditioning', duration: '45 min', status: 'Upcoming' },
];

export const payments = [
  { id: 'TXN-1084', member: 'Meera Iyer', date: '27 Aug 2026', amount: 2500, method: 'UPI', type: 'PT package', status: 'Paid' },
  { id: 'TXN-1081', member: 'Aarav Kumar', date: '26 Aug 2026', amount: 1800, method: 'Card', type: 'Monthly plan', status: 'Paid' },
  { id: 'TXN-1077', member: 'Vikram Raj', date: '24 Aug 2026', amount: 3200, method: 'Cash', type: 'PT package', status: 'Paid' },
  { id: 'TXN-1072', member: 'Nila Joseph', date: '21 Aug 2026', amount: 1500, method: 'UPI', type: 'Monthly plan', status: 'Pending' },
];

export const workouts = [
  { id: 1, name: '12-week transformation', level: 'Intermediate', days: 5, members: 8, focus: 'Fat loss', updated: '2 days ago' },
  { id: 2, name: 'Strength foundation', level: 'Beginner', days: 3, members: 6, focus: 'Strength', updated: '5 days ago' },
  { id: 3, name: 'Hypertrophy block', level: 'Advanced', days: 6, members: 4, focus: 'Muscle gain', updated: '1 week ago' },
];
