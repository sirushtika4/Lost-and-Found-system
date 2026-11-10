import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
export default function SessionStatus() {
  const { loading, sessionError, retrySession } = useAuth();
  if (loading) return <LoadingSpinner label="Checking your session..." />;
  return <div className="container section-block">
    <p role="alert" className="inline-error">Your session could not be checked. {sessionError}</p>
    <button type="button" className="btn btn-secondary btn-md" onClick={retrySession}>Retry session check</button>
  </div>;
}
