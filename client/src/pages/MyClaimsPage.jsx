import { mockClaims } from '../utils/mockData';
import EmptyState from '../components/common/EmptyState';

export default function MyClaimsPage() {
  if (!mockClaims.length) {
    return (
      <div className="container section-block page-shell">
        <EmptyState title="No claims yet." description="Your submitted claims and claims received for your items will appear here." />
      </div>
    );
  }

  return (
    <div className="container section-block page-shell">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Claim tracking</span>
          <h1>My Claims</h1>
        </div>
      </div>

      <div className="claims-panels">
        <section className="panel">
          <h3>Claims I Submitted</h3>
          <div className="claims-table">
            <div className="claims-head claims-row">
              <span>Item</span>
              <span>Message</span>
              <span>Submitted</span>
              <span>Status</span>
            </div>
            {mockClaims.map((claim) => (
              <div key={claim._id} className="claims-row">
                <span>{claim.itemTitle}</span>
                <span>{claim.message}</span>
                <span>{claim.submittedDate}</span>
                <span><span className={`state-chip ${claim.status.toLowerCase()}`}>{claim.status}</span></span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Claims Received For My Items</h3>
          <p className="muted">This section will list items reported by others for belongings you submitted.</p>
        </section>
      </div>
    </div>
  );
}
