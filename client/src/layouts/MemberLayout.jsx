import DashboardShell from '../components/layout/DashboardShell';
import { MEMBER_NAV, ROLE_BASE_PATH, ROLE_LABEL } from '../config/navigation';

const MemberLayout = () => (
  <DashboardShell
    navItems={MEMBER_NAV}
    basePath={ROLE_BASE_PATH.member}
    roleLabel={ROLE_LABEL.member}
  />
);

export default MemberLayout;
