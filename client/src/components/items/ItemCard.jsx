import { Link } from 'react-router-dom';
import { MapPin, CalendarDays, Tag, ArrowRight } from 'lucide-react';

export default function ItemCard({ item }) {
  if (!item) return null;

  return (
    <article className="item-card">
      <div className="item-card-image-wrap">
        <img src={item.image} alt={item.title} className="item-card-image" />
        <span className={`status-badge status-${item.type}`}>{item.type === 'lost' ? 'Lost' : 'Found'}</span>
      </div>

      <div className="item-card-body">
        <div className="item-card-meta">
          <span className="category-badge">{item.category}</span>
          <span className={`state-chip ${item.status}`}>{item.status}</span>
        </div>

        <h3>{item.title}</h3>

        <div className="item-card-details">
          <span><MapPin size={14} /> {item.location}</span>
          <span><CalendarDays size={14} /> {new Date(item.dateLostOrFound).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>

        <div className="item-card-footer">
          <Link to={`/items/${item._id}`} className="view-link">
            View details
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
