import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import SuspendedBanner from './SuspendedBanner';

// Shared shell reused by every role layout: Sidebar + Header + routed page content.
// Role layouts (RootAdminLayout, AdminLayout, SubAdminLayout, MemberLayout) just
// pass their own nav config and let this component handle the chrome.
const DashboardShell = ({ navItems, basePath, roleLabel }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentItem =
    navItems.find((item) => {
      const fullPath = `${basePath}/${item.path}`.replace(/\/+$/, '') || basePath;
      return item.path === ''
        ? location.pathname === fullPath
        : location.pathname.startsWith(fullPath);
    }) || navItems[0];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        navItems={navItems}
        basePath={basePath}
        roleLabel={roleLabel}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <SuspendedBanner />
        <Header onMenuClick={() => setSidebarOpen(true)} title={currentItem?.label} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
