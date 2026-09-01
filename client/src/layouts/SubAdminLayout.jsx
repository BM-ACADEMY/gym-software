import { useSelector } from 'react-redux';
import DashboardShell from '../components/layout/DashboardShell';
import { SUBADMIN_NAV, ROLE_BASE_PATH, ROLE_LABEL, filterNavByPermissions } from '../config/navigation';
import { selectPermissions } from '../store/slices/authSlice';

// Nav is built dynamically from the logged-in sub-admin's permissions map,
// not hardcoded — a sub-admin only ever sees modules the Gym Owner switched on.
const SubAdminLayout = () => {
  const permissions = useSelector(selectPermissions);
  const navItems = filterNavByPermissions(SUBADMIN_NAV, permissions);

  return (
    <DashboardShell
      navItems={navItems}
      basePath={ROLE_BASE_PATH.subadmin}
      roleLabel={ROLE_LABEL.subadmin}
    />
  );
};

export default SubAdminLayout;
