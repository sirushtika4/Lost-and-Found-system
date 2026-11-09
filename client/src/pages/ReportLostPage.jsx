import { useState } from 'react';
import { itemService, itemPayload } from '../services/itemService';
import { useNavigate } from 'react-router-dom';
import ReportItemForm from '../components/forms/ReportItemForm';

export default function ReportLostPage() {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async values => {
    setSubmitting(true); setError('');
    try { const response = await itemService.createItem(itemPayload(values)); navigate(`/items/${response.item._id}`); }
    catch (failure) { setError(failure.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="container section-block page-shell narrow-page">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Campus safety</span>
          <h1>Report a Lost Item</h1>
        </div>
      </div>
      {error ? <div className="inline-error" role="alert">{error} Please review and submit again.</div> : null}
      <div className="panel">
        <ReportItemForm mode="lost" onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </div>
  );
}
