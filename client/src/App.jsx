import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Public pages
import Landing from './pages/public/Landing';
import Pricing from './pages/public/Pricing';
import Blog from './pages/public/Blog';
import Contact from './pages/public/Contact';
import Faq from './pages/public/Faq';
import Privacy from './pages/public/Privacy';
import AppPrivacy from './pages/public/AppPrivacy';
import Terms from './pages/public/Terms';

// Auth pages
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import RootAdminSignIn from './pages/auth/RootAdminSignIn';
import ForgotPassword from './pages/auth/ForgotPassword';
import ImpersonateBootstrap from './pages/auth/ImpersonateBootstrap';
import RootAdminRequestAccess from './pages/auth/RootAdminRequestAccess';

// Protected shell
import ProtectedRoute from './components/ProtectedRoute';
import RootAdminLayout from './layouts/RootAdminLayout';
import AdminLayout from './layouts/AdminLayout';
import SubAdminLayout from './layouts/SubAdminLayout';
import MemberLayout from './layouts/MemberLayout';

import { ROOT_ADMIN_NAV, ADMIN_NAV, SUBADMIN_NAV, MEMBER_NAV } from './config/navigation';

// Eagerly load every page under each role folder, keyed by file path.
// Nav config (config/navigation.js) is the single source of truth for which
// page backs which route — add a page there + a matching file here and it's wired up.
const rootAdminPages = import.meta.glob('./pages/root-admin/*.jsx', { eager: true });
const adminPages = import.meta.glob('./pages/admin/*.jsx', { eager: true });
const subadminPages = import.meta.glob('./pages/subadmin/*.jsx', { eager: true });
const memberPages = import.meta.glob('./pages/member/*.jsx', { eager: true });

const resolvePage = (pages, folder, name) => pages[`./pages/${folder}/${name}.jsx`]?.default;

// Renders <Route> entries for a role's nav config against its loaded page modules.
const roleRoutes = (navItems, pages, folder) =>
  navItems.map(({ key, path, page }) => {
    const Component = resolvePage(pages, folder, page);
    if (!Component) return null;
    return path === '' ? (
      <Route key={key} index element={<Component />} />
    ) : (
      <Route key={key} path={path} element={<Component />} />
    );
  });

function App() {
  return (
    <Router>
      <Routes>
        {/* ── Public Website Routes ── */}
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/privacy/app-privacy" element={<AppPrivacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* ── Auth Routes ── */}
        <Route path="/login" element={<SignIn />} />
        <Route path="/register" element={<SignUp />} />
        <Route path="/root-admin-login" element={<RootAdminSignIn />} />
        <Route path="/forgot-password" element={<ForgotPassword variant="tenant" />} />
        <Route path="/root-admin-forgot-password" element={<ForgotPassword variant="root" />} />
        <Route path="/impersonate" element={<ImpersonateBootstrap />} />
        <Route path="/root-admin-request-access" element={<RootAdminRequestAccess />} />

        {/* ── Root Admin — platform control panel ── */}
        <Route
          path="/root-admin"
          element={
            <ProtectedRoute allowedRoles={['root_admin']}>
              <RootAdminLayout />
            </ProtectedRoute>
          }
        >
          {roleRoutes(ROOT_ADMIN_NAV, rootAdminPages, 'root-admin')}
        </Route>

        {/* ── Gym Owner (Admin) — one gym, full control ── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {roleRoutes(ADMIN_NAV, adminPages, 'admin')}
        </Route>

        {/* ── Sub-Admin (Staff) — permission-gated subset of the Gym Owner's pages ── */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['subadmin']}>
              <SubAdminLayout />
            </ProtectedRoute>
          }
        >
          {roleRoutes(SUBADMIN_NAV, subadminPages, 'subadmin')}
        </Route>

        {/* ── Customer (Member) — read-mostly self-service ── */}
        <Route
          path="/member"
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <MemberLayout />
            </ProtectedRoute>
          }
        >
          {roleRoutes(MEMBER_NAV, memberPages, 'member')}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
