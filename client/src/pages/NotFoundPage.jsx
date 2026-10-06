import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container section-block page-shell minimal-page">
      <div className="empty-state centered-state">
        <h1>Page Not Found</h1>
        <p>The page you are looking for does not exist or has moved.</p>
        <div className="hero-actions">
          <Link to="/" className="btn btn-primary btn-md">Go Home</Link>
          <Link to="/items" className="btn btn-secondary btn-md">Browse Items</Link>
        </div>
      </div>
    </div>
  );
}
