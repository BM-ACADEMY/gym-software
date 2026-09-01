import DashboardShell from '../components/layout/DashboardShell';
import { ADMIN_NAV, ROLE_BASE_PATH, ROLE_LABEL } from '../config/navigation';

const AdminLayout = () => (
  <DashboardShell
    navItems={ADMIN_NAV}
    basePath={ROLE_BASE_PATH.admin}
    roleLabel={ROLE_LABEL.admin}
  />
);

export default AdminLayout;
