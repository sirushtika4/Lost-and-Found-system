import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { claimService } from '../services/claimService';
import EmptyState from '../components/common/EmptyState';
import ItemRequestState from '../components/items/ItemRequestState';
import ItemPagination from '../components/items/ItemPagination';

function ClaimsPanel({ received = false }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  const key = JSON.stringify({ page, status, version, received });
  useEffect(() => {
    let active = true;
    const operation = received ? claimService.getReceived : claimService.getMine;
    operation({ page, ...(status ? { status } : {}) }).then(response => {
      if (active) setResult({ ...response, key, error: '' });
    }).catch(error => { if (active) setResult({ key, error: error.message }); });
    return () => { active = false; };
  }, [key, page, status, received]);
  const loading = result?.key !== key;
  const review = async (claim, decision) => {
    if (inFlight.current) return;
    if (!window.confirm(`${decision === 'approved' ? 'Approve' : 'Reject'} this claim?${decision === 'approved' ? ' This resolves the item and rejects competing pending claims.' : ''}`)) return;
    inFlight.current = true; setBusy(true); setActionError(''); setSuccess('');
    try {
      await claimService.review(claim._id, decision);
      setSuccess(`Claim ${decision}.`); setVersion(value => value + 1);
    } catch (error) { setActionError(error.message); setVersion(value => value + 1); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const title = received ? 'Claims Received For My Items' : 'Claims I Submitted';
  return <section className="panel" aria-label={title}>
    <h3>{title}</h3>
    <label className="field-group"><span>Filter claim status</span><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
      <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
    </select></label>
    {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
    {success ? <p role="status">{success}</p> : null}
    <ItemRequestState loading={loading} error={!loading ? result?.error : ''} retry={() => setVersion(value => value + 1)} />
    {!loading && !result.error ? result.claims.length ? <>
      <div className="claims-table">{result.claims.map(claim => <article key={claim._id} className="panel" aria-label={`Claim for ${claim.itemTitle}`}>
        <Link to={`/items/${claim.itemId}`} className="text-link">{claim.itemTitle}</Link>
        <p><span className={`state-chip ${claim.status}`}>{claim.status}</span></p>
        <p><strong>Ownership explanation: </strong>{claim.explanation}</p>
        {claim.evidence ? <p><strong>Additional evidence: </strong>{claim.evidence}</p> : null}
        <p>Submitted: {new Date(claim.submittedAt).toLocaleString()}</p>
        {claim.reviewedAt ? <p>Reviewed: {new Date(claim.reviewedAt).toLocaleString()}</p> : null}
        {received && claim.status === 'pending' ? <div className="form-actions">
          <button className="btn btn-primary btn-sm" disabled={busy || claim.itemStatus !== 'open'} onClick={() => review(claim, 'approved')}>Approve</button>
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => review(claim, 'rejected')}>Reject</button>
        </div> : null}
      </article>)}</div>
      <ItemPagination pagination={result.pagination} onPage={setPage} />
    </> : <EmptyState title="No claims match this view." description={received ? 'Claims for found items you report will appear here.' : 'Claims you submit for found items will appear here.'} /> : null}
  </section>;
}
export default function MyClaimsPage() {
  return <div className="container section-block page-shell">
    <div className="page-header-row"><div><span className="eyebrow">Claim tracking</span><h1>My Claims</h1></div></div>
    <p>Only you and the item reporter can access claim evidence. Approval resolves the item; decisions are final.</p>
    <div className="claims-panels"><ClaimsPanel /><ClaimsPanel received /></div>
  </div>;
}
