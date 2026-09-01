import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  UserCog,
  Dumbbell,
  Wallet,
  CalendarClock,
  ListChecks,
  Sparkles,
  Wallet2,
  UserPlus,
  Receipt,
  Tags,
  BarChart3,
  Megaphone,
  Settings,
  Building2,
  Ticket,
  LifeBuoy,
  KeyRound,
  HeartPulse,
  Bell,
  MessageSquareText,
} from 'lucide-react';

// Single source of truth for every sidebar + route table in the app.
// `key` doubles as the permission-module key used by SubAdmin.permissions.
// `page` is the component file name under src/pages/<role>/.

export const ROOT_ADMIN_NAV = [
  { key: 'dashboard', label: 'Dashboard', path: '', page: 'Dashboard', icon: LayoutDashboard },
  { key: 'subscribers', label: 'Subscriber Management', path: 'subscribers', page: 'Subscribers', icon: Building2 },
  { key: 'plan-creation', label: 'Plan Creation', path: 'plan-creation', page: 'PlanCreation', icon: Tags },
  { key: 'coupons', label: 'Coupons', path: 'coupons', page: 'Coupons', icon: Ticket },
  { key: 'analytics', label: 'Analytics', path: 'analytics', page: 'Analytics', icon: BarChart3 },
  { key: 'billing', label: 'Billing & Invoices', path: 'billing', page: 'Billing', icon: Receipt },
  { key: 'support', label: 'Support / Tickets', path: 'support', page: 'Support', icon: LifeBuoy },
  { key: 'request-access', label: 'Request Access', path: 'request-access', page: 'RequestAccess', icon: KeyRound },
  { key: 'settings', label: 'Settings', path: 'settings', page: 'Settings', icon: Settings },
];

export const ADMIN_NAV = [
  { key: 'dashboard', label: 'Dashboard', path: '', page: 'Dashboard', icon: LayoutDashboard },
  { key: 'members', label: 'Members', path: 'members', page: 'Members', icon: Users },
  { key: 'attendance', label: 'Attendance', path: 'attendance', page: 'Attendance', icon: CalendarCheck },
  { key: 'payment', label: 'Payment', path: 'payment', page: 'Payment', icon: CreditCard },
  { key: 'staff', label: 'Sub-Admin / Staff', path: 'staff', page: 'StaffManagement', icon: UserCog },
  { key: 'trainers', label: 'Trainers', path: 'trainers', page: 'Trainers', icon: Dumbbell },
  { key: 'earnings', label: 'Earnings', path: 'earnings', page: 'Earnings', icon: Wallet },
  { key: 'pt-sessions', label: 'PT Sessions', path: 'pt-sessions', page: 'PTSessions', icon: CalendarClock },
  { key: 'workouts', label: 'Workouts', path: 'workouts', page: 'Workouts', icon: ListChecks },
  { key: 'ai-plans', label: 'AI Plans', path: 'ai-plans', page: 'AIPlans', icon: Sparkles },
  { key: 'accounts', label: 'Accounts', path: 'accounts', page: 'Accounts', icon: Wallet2 },
  { key: 'trial', label: 'Trial', path: 'trial', page: 'Trial', icon: UserPlus },
  { key: 'payment-history', label: 'Payment History', path: 'payment-history', page: 'PaymentHistory', icon: Receipt },
  { key: 'plan-creation', label: 'Plan Creation', path: 'plan-creation', page: 'PlanCreation', icon: Tags },
  { key: 'reports', label: 'Reports & Analytics', path: 'reports', page: 'ReportsAnalytics', icon: BarChart3 },
  { key: 'notifications', label: 'Notifications Center', path: 'notifications', page: 'NotificationsCenter', icon: Megaphone },
  { key: 'settings', label: 'Settings', path: 'settings', page: 'Settings', icon: Settings },
];

// Every module a Sub-Admin can ever be granted (Gym Owner ticks a subset per staff member).
export const SUBADMIN_NAV = [
  { key: 'dashboard', label: 'Dashboard', path: '', page: 'Dashboard', icon: LayoutDashboard },
  { key: 'members', label: 'Members', path: 'members', page: 'Members', icon: Users },
  { key: 'attendance', label: 'Attendance', path: 'attendance', page: 'Attendance', icon: CalendarCheck },
  { key: 'payment', label: 'Payment', path: 'payment', page: 'Payment', icon: CreditCard },
  { key: 'earnings', label: 'Earnings', path: 'earnings', page: 'Earnings', icon: Wallet },
  { key: 'pt-sessions', label: 'PT Sessions', path: 'pt-sessions', page: 'PTSessions', icon: CalendarClock },
  { key: 'workout', label: 'Workout', path: 'workout', page: 'Workout', icon: ListChecks },
  { key: 'ai-plans', label: 'AI Plans', path: 'ai-plans', page: 'AIPlans', icon: Sparkles },
  { key: 'payment-history', label: 'Payment History', path: 'payment-history', page: 'PaymentHistory', icon: Receipt },
  { key: 'settings', label: 'Settings', path: 'settings', page: 'Settings', icon: Settings },
];

export const MEMBER_NAV = [
  { key: 'dashboard', label: 'Dashboard', path: '', page: 'Dashboard', icon: LayoutDashboard },
  { key: 'attendance', label: 'Session Attendance', path: 'attendance', page: 'Attendance', icon: CalendarCheck },
  { key: 'subscription', label: 'Subscription Plan', path: 'subscription', page: 'SubscriptionPlan', icon: Tags },
  { key: 'payments', label: 'Payments', path: 'payments', page: 'Payments', icon: CreditCard },
  { key: 'pt-sessions', label: 'PT Sessions', path: 'pt-sessions', page: 'PTSessions', icon: CalendarClock },
  { key: 'workout-diet', label: 'Workout & AI Diet Plan', path: 'workout-diet', page: 'WorkoutDietPlan', icon: HeartPulse },
  { key: 'notifications', label: 'Notifications', path: 'notifications', page: 'Notifications', icon: Bell },
  { key: 'feedback', label: 'Feedback', path: 'feedback', page: 'Feedback', icon: MessageSquareText },
  { key: 'settings', label: 'Settings', path: 'settings', page: 'Settings', icon: Settings },
];

// `dashboard` and `settings` are always on for every sub-admin regardless of template.
export const ALWAYS_ON_SUBADMIN_MODULES = ['dashboard', 'settings'];

// Pre-built permission templates, keyed the same way as SubAdmin.permissions.
// Each module maps to { view, edit }. Modules not listed default to { view: false, edit: false }.
export const SUBADMIN_TEMPLATES = {
  trainer: {
    label: 'Trainer',
    permissions: {
      dashboard: { view: true, edit: false },
      members: { view: true, edit: true },
      attendance: { view: true, edit: true },
      earnings: { view: true, edit: false },
      'pt-sessions': { view: true, edit: true },
      workout: { view: true, edit: true },
      settings: { view: true, edit: true },
    },
  },
  frontdesk: {
    label: 'Front Desk',
    permissions: {
      dashboard: { view: true, edit: false },
      attendance: { view: true, edit: true },
      payment: { view: true, edit: true },
      settings: { view: true, edit: true },
    },
  },
  accountant: {
    label: 'Accountant',
    permissions: {
      dashboard: { view: true, edit: false },
      'payment-history': { view: true, edit: false },
      earnings: { view: true, edit: false },
      settings: { view: true, edit: true },
    },
  },
  custom: {
    label: 'Custom',
    permissions: {},
  },
};

export const NAV_BY_ROLE = {
  root_admin: ROOT_ADMIN_NAV,
  admin: ADMIN_NAV,
  subadmin: SUBADMIN_NAV,
  member: MEMBER_NAV,
};

export const ROLE_BASE_PATH = {
  root_admin: '/root-admin',
  admin: '/admin',
  subadmin: '/staff',
  member: '/member',
};

export const ROLE_LABEL = {
  root_admin: 'Root Admin',
  admin: 'Gym Owner',
  subadmin: 'Staff',
  member: 'Member',
};

// Filters a nav list down to what a subadmin is allowed to see, given their permissions map.
export function filterNavByPermissions(navItems, permissions) {
  if (!permissions) return navItems;
  return navItems.filter((item) => {
    if (ALWAYS_ON_SUBADMIN_MODULES.includes(item.key)) return true;
    return Boolean(permissions[item.key]?.view);
  });
}
