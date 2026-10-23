import { describe, expect, it } from 'vitest';
import { ALWAYS_ON_SUBADMIN_MODULES, filterNavByPermissions } from './navigation';

const NAV = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'settings', label: 'Settings' },
  { key: 'members', label: 'Members' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'earnings', label: 'Earnings' },
];

describe('filterNavByPermissions', () => {
  it('returns every item unchanged when a role has no permissions map (Admin/Root Admin/Member)', () => {
    expect(filterNavByPermissions(NAV, undefined)).toEqual(NAV);
    expect(filterNavByPermissions(NAV, null)).toEqual(NAV);
  });

  it('always keeps dashboard and settings for a scoped sub-admin, regardless of their permissions', () => {
    const result = filterNavByPermissions(NAV, {});
    const keys = result.map((item) => item.key);
    ALWAYS_ON_SUBADMIN_MODULES.forEach((key) => expect(keys).toContain(key));
    expect(keys).not.toContain('members');
    expect(keys).not.toContain('attendance');
    expect(keys).not.toContain('earnings');
  });

  it('keeps only the modules a sub-admin has view access to, on top of the always-on ones', () => {
    const permissions = {
      members: { view: true, edit: true },
      attendance: { view: false, edit: false },
      earnings: { view: true, edit: false },
    };
    const keys = filterNavByPermissions(NAV, permissions).map((item) => item.key);
    expect(keys).toEqual(['dashboard', 'settings', 'members', 'earnings']);
  });
});
