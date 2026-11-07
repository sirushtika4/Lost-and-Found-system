import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SessionStatus from './SessionStatus';

export default function ProtectedRoute({ children }) {
  const { user, loading, sessionError } = useAuth();
  const location = useLocation();

  if (loading || sessionError) return <SessionStatus />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
