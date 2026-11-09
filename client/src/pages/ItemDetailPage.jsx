import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, CalendarDays, ShieldCheck } from 'lucide-react';
import { useItem } from '../services/useItems';
import { itemService } from '../services/itemService';
import { useAuth } from '../context/AuthContext';
import ItemRequestState from '../components/items/ItemRequestState';
import Button from '../components/common/Button';

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { item, loading, error, retry } = useItem(id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const canModify = item && user && (user._id === item.userId || user.role === 'admin');
  const act = async remove => {
    if (remove && !window.confirm('Delete this item permanently?')) return;
    setBusy(true); setActionError('');
    try {
      if (remove) { await itemService.deleteItem(id); navigate('/my-items'); }
      else { await itemService.updateItem(id, { status: item.status === 'resolved' ? 'open' : 'resolved' }); retry(); }
    } catch (failure) { setActionError(failure.message); }
    finally { setBusy(false); }
  };
  if (loading || error || !item) return <div className="container section-block page-shell"><ItemRequestState loading={loading} error={error} retry={retry} /></div>;

  return (
    <div className="container section-block page-shell">
      <div className="item-detail-layout">
        <div className="item-detail-image-wrap">
          {item.image ? <img src={item.image} alt={item.title} className="item-detail-image" referrerPolicy="no-referrer" /> : <p>No image provided</p>}
        </div>

        <div className="item-detail-content">
          <div className="detail-header-row">
            <span className={`status-badge status-${item.type}`}>{item.type === 'lost' ? 'Lost' : 'Found'}</span>
            <span className={`state-chip ${item.status}`}>{item.status}</span>
          </div>

          <h1>{item.title}</h1>
          <div className="detail-grid meta-block">
            <span><ShieldCheck size={16} /> {item.category}</span>
            <span><MapPin size={16} /> {item.location}</span>
            <span><CalendarDays size={16} /> {new Date(item.dateLostOrFound).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>

          <div className="detail-copy">
            <p>{item.description}</p>
          </div>

          <div className="detail-info-grid">
            <div><span>Color</span><strong>{item.color}</strong></div>
            <div><span>Brand</span><strong>{item.brand || 'Unspecified'}</strong></div>
            <div><span>Location</span><strong>{item.location}</strong></div>
            <div><span>Reported by</span><strong>Campus community</strong></div>
            <div><span>Reported date</span><strong>{new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
            <div><span>{item.type === 'lost' ? 'Date lost' : 'Date found'}</span><strong>{new Date(item.dateLostOrFound).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
          </div>

          {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
          <div className="detail-actions">
            <Button type="button" variant="primary" disabled title="Claims are not available yet">Claim This Item</Button>
            <Button type="button" variant="secondary" disabled title="Contact sharing is not available yet">Contact Reporter</Button>
            {canModify ? <>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => navigate(`/items/${item._id}/edit`)}>Edit</Button>
              <Button type="button" variant="danger" disabled={busy} onClick={() => act(true)}>Delete</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => act(false)}>{item.status === 'resolved' ? 'Reopen' : 'Mark as Resolved'}</Button>
            </> : null}
          </div>
          <p>Claims, reporter contact and automatic matching are not available yet.</p>
        </div>
      </div>

    </div>
  );
}
