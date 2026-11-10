import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SessionStatus from './SessionStatus';

export default function AdminRoute({ children }) {
  const { user, loading, sessionError } = useAuth();

  if (loading || sessionError) return <SessionStatus />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
