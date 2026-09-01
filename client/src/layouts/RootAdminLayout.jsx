import DashboardShell from '../components/layout/DashboardShell';
import { ROOT_ADMIN_NAV, ROLE_BASE_PATH, ROLE_LABEL } from '../config/navigation';

const RootAdminLayout = () => (
  <DashboardShell
    navItems={ROOT_ADMIN_NAV}
    basePath={ROLE_BASE_PATH.root_admin}
    roleLabel={ROLE_LABEL.root_admin}
  />
);

export default RootAdminLayout;
