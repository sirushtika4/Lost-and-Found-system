import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, CalendarDays, User, PencilLine, Trash2, CheckCheck, Mail, ShieldCheck } from 'lucide-react';
import { mockItems } from '../utils/mockData';
import PossibleMatches from '../components/items/PossibleMatches';
import Button from '../components/common/Button';

const sampleMatches = [
  { _id: 'm1', title: 'Black Phone Case', category: 'Electronics', location: 'Engineering Library', date: '2026-09-26', score: 82, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80' },
  { _id: 'm2', title: 'Silver Key Ring', category: 'Keys', location: 'Science Block', date: '2026-09-25', score: 71, image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80' },
];

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');

  const item = useMemo(() => mockItems.find((entry) => entry._id === id) || mockItems[0], [id]);

  return (
    <div className="container section-block page-shell">
      <div className="item-detail-layout">
        <div className="item-detail-image-wrap">
          <img src={item.image} alt={item.title} className="item-detail-image" />
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

          <div className="detail-actions">
            <Button type="button" variant="primary" onClick={() => setClaimOpen(true)}>
              Claim This Item
            </Button>
            <Button type="button" variant="secondary">Contact Reporter</Button>
            <Button type="button" variant="ghost" onClick={() => navigate(`/items/${item._id}/edit`)}>Edit</Button>
            <Button type="button" variant="danger">Delete</Button>
            <Button type="button" variant="secondary">Mark as Resolved</Button>
          </div>
        </div>
      </div>

      {claimOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="panel-header-row">
              <h3>Submit claim</h3>
              <button type="button" className="close-button" onClick={() => setClaimOpen(false)} aria-label="Close claim form">×</button>
            </div>
            <label className="field-group">
              <span>Message</span>
              <textarea value={claimMessage} onChange={(event) => setClaimMessage(event.target.value)} rows={5} placeholder="Describe something about the item that only the owner would know." />
            </label>
            <label className="field-group">
              <span>Proof / identifying information</span>
              <input type="text" value={claimMessage} onChange={(event) => setClaimMessage(event.target.value)} placeholder="e.g. a unique sticker or serial number" />
            </label>
            <div className="form-actions">
              <Button type="button" variant="primary" onClick={() => setClaimOpen(false)}>Submit Claim</Button>
              <Button type="button" variant="secondary" onClick={() => setClaimOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="detail-lower-section">
        <PossibleMatches matches={sampleMatches} />
      </div>
    </div>
  );
}
