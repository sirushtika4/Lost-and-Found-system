import { useEffect, useState } from 'react';
import { healthService } from '../../services/healthService';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';

export default function BackendStatus() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadHealth = async () => {
      try {
        const data = await healthService.getHealth({ signal: controller.signal });
        if (!controller.signal.aborted) setHealth(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadHealth();
    return () => controller.abort();
  }, [attempt]);

  const checkHealth = () => {
    setLoading(true);
    setHealth(null);
    setError('');
    setAttempt(current => current + 1);
  };

  return (
    <section className="container section-block" aria-labelledby="backend-status-heading">
      <div className="panel filter-panel">
        <div className="section-heading">
          <h2 id="backend-status-heading">Service status</h2>
          <Button type="button" variant="secondary" disabled={loading} onClick={checkHealth}>
            {loading ? 'Checking...' : 'Check again'}
          </Button>
        </div>
        {loading ? <LoadingSpinner label="Checking server connection..." /> : null}
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        {health ? (
          <div role="status" aria-live="polite">
            <p><strong>API reachable:</strong> {health.service}</p>
            <p><strong>Database:</strong> {health.database}</p>
          </div>
        ) : null}
        <p className="muted">Item listings, statistics and matches are sample previews. Reporting and claims are not saved yet.</p>
      </div>
    </section>
  );
}
