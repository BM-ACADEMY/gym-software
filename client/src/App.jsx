import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/public/Landing';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ProtectedRoute from './components/ProtectedRoute';

// Placeholder dashboards (to be extracted later)
const RootAdminDashboard = () => <div className="p-8"><h1>Root Admin Dashboard</h1></div>;
const AdminDashboard = () => <div className="p-8"><h1>Gym Admin Dashboard</h1></div>;
const TrainerDashboard = () => <div className="p-8"><h1>Trainer Dashboard</h1></div>;
const MemberDashboard = () => <div className="p-8"><h1>Member Dashboard</h1></div>;

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<SignIn />} />
        <Route path="/register" element={<SignUp />} />

        {/* Protected Routes by Role */}
        <Route 
          path="/root-admin/*" 
          element={
            <ProtectedRoute allowedRoles={['root_admin']}>
              <Routes>
                <Route path="dashboard" element={<RootAdminDashboard />} />
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
