import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mockItems } from '../utils/mockData';
import ItemCard from '../components/items/ItemCard';
import EmptyState from '../components/common/EmptyState';

export default function MyItemsPage() {
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const items = useMemo(() => {
    let results = mockItems.filter((item) => item.userId === 'u1');

    if (filter !== 'all') {
      results = results.filter((item) => item.type === filter);
    }

    if (statusFilter !== 'all') {
      results = results.filter((item) => item.status === statusFilter);
    }

    return results;
  }, [filter, statusFilter]);

  return (
    <div className="container section-block page-shell">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Your listings</span>
          <h1>My Items</h1>
        </div>
      </div>

      <div className="filter-row">
        <div className="segmented-control">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'lost' ? 'active' : ''} onClick={() => setFilter('lost')}>Lost</button>
          <button type="button" className={filter === 'found' ? 'active' : ''} onClick={() => setFilter('found')}>Found</button>
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="claimed">Claimed</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {items.length ? (
        <div className="item-grid browse-grid">
          {items.map((item) => (
            <div key={item._id} className="item-card-wrap with-actions">
              <ItemCard item={item} />
              <div className="item-actions-row">
                <Link to={`/items/${item._id}`} className="text-link-button">View</Link>
                <Link to={`/items/${item._id}/edit`} className="text-link-button">Edit</Link>
                <button type="button" className="text-link-button danger">Delete</button>
                <button type="button" className="text-link-button">Mark Resolved</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="You haven't reported any items yet." description="Start by reporting a lost or found item to help your community." actionLabel="Report Lost Item" onAction={() => window.location.href = '/report/lost'} />
      )}
    </div>
  );
}
