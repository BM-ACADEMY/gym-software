import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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

// Protected components
import ProtectedRoute from './components/ProtectedRoute';
import RootAdminSettings from './pages/root-admin/Settings';

// Placeholder dashboards (to be extracted later)
const RootAdminDashboard = () => <div className="p-8"><h1>Root Admin Dashboard</h1></div>;
const AdminDashboard = () => <div className="p-8"><h1>Gym Admin Dashboard</h1></div>;
const TrainerDashboard = () => <div className="p-8"><h1>Trainer Dashboard</h1></div>;
const MemberDashboard = () => <div className="p-8"><h1>Member Dashboard</h1></div>;

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

        {/* ── Protected Routes by Role ── */}
        <Route 
          path="/root-admin/*" 
          element={
            <ProtectedRoute allowedRoles={['root_admin']}>
              <Routes>
                <Route path="dashboard" element={<RootAdminDashboard />} />
                <Route path="settings" element={<RootAdminSettings />} />
              </Routes>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
              </Routes>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/trainer/*" 
          element={
            <ProtectedRoute allowedRoles={['trainer']}>
              <Routes>
                <Route path="dashboard" element={<TrainerDashboard />} />
              </Routes>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/member/*" 
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <Routes>
                <Route path="dashboard" element={<MemberDashboard />} />
              </Routes>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
