import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReportItemForm from '../components/forms/ReportItemForm';
import ItemRequestState from '../components/items/ItemRequestState';
import { useItem } from '../services/useItems';
import { itemService, itemPayload } from '../services/itemService';
import { useAuth } from '../context/AuthContext';

export default function EditItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { item, loading, error, retry } = useItem(id);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const initialValues = useMemo(() => item ? { title: item.title, category: item.category, description: item.description,
    color: item.color, brand: item.brand, location: item.location, date: item.dateLostOrFound, image: item.image } : null, [item]);
  const handleSubmit = async values => {
    setSubmitting(true); setSaveError('');
    try { await itemService.updateItem(id, itemPayload(values)); navigate(`/items/${id}`); }
    catch (failure) { setSaveError(failure.message); }
    finally { setSubmitting(false); }
  };
  return <div className="container section-block page-shell narrow-page">
    <div className="page-header-row"><div><span className="eyebrow">Update listing</span><h1>Edit Item</h1></div></div>
    <ItemRequestState loading={loading} error={error} retry={retry} />
    {saveError ? <div className="inline-error" role="alert">{saveError} Please review and submit again.</div> : null}
    {!loading && !error && item ? (user?._id === item.userId || user?.role === 'admin' ?
      <div className="panel"><ReportItemForm mode={item.type} initialValues={initialValues} onSubmit={handleSubmit} submitting={submitting} /></div> :
      <div className="inline-error" role="alert">You cannot edit this item.</div>) : null}
  </div>;
}
