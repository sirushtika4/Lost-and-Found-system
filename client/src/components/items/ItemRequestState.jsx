import LoadingSpinner from '../common/LoadingSpinner';
export default function ItemRequestState({ loading, error, retry }) {
  if (loading) return <LoadingSpinner label="Loading items..." />;
  if (error) return <div className="inline-error" role="alert">{error} <button className="btn btn-secondary btn-sm" onClick={retry}>Retry</button></div>;
  return null;
}
