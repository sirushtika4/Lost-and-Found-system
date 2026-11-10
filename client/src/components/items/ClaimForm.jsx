import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { claimService } from '../../services/claimService';
import Button from '../common/Button';
export default function ClaimForm({ itemId, onClose }) {
  const [explanation, setExplanation] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    if (explanation.trim().length < 10) { setError('Explain ownership in at least 10 characters.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    try { await claimService.submitClaim(itemId, { explanation, evidence }); setSuccess(true); }
    catch (failure) { setError(failure.message); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="claim-heading">
    <div className="modal-card">
      <h2 id="claim-heading">Claim this found item</h2>
      {success ? <div role="status"><p>Your claim was submitted for review.</p><Link to="/my-claims" className="text-link">View My Claims</Link></div> :
        <form onSubmit={submit}>
          <p>Describe identifying details. Do not include identity documents, passwords or other sensitive personal information. Only you and the item reporter can view this text.</p>
          <label className="field-group"><span>Ownership explanation</span><textarea value={explanation} onChange={e => setExplanation(e.target.value)} minLength={10} maxLength={2000} required rows={5} disabled={busy} /></label>
          <label className="field-group"><span>Additional evidence (optional text)</span><textarea value={evidence} onChange={e => setEvidence(e.target.value)} maxLength={1000} rows={3} disabled={busy} /></label>
          {error ? <div className="inline-error" role="alert">{error} Check your claims before retrying if the response was interrupted.</div> : null}
          <Button type="submit" disabled={busy}>{busy ? 'Submitting...' : 'Submit Claim'}</Button>
        </form>}
      <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>{success ? 'Close' : 'Cancel'}</Button>
    </div>
  </div>;
}
