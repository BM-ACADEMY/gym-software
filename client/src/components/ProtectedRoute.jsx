import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectCurrentUser } from '../store/slices/authSlice';
import { ROLE_BASE_PATH } from '../config/navigation';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectCurrentUser);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Wrong role for this branch — send them back to their own dashboard.
    const base = ROLE_BASE_PATH[user?.role];
    return <Navigate to={base ? base : '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
