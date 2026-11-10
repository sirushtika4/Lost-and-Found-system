import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ItemCard from '../components/items/ItemCard';
import EmptyState from '../components/common/EmptyState';
import ItemRequestState from '../components/items/ItemRequestState';
import ItemPagination from '../components/items/ItemPagination';
import { useItems } from '../services/useItems';
import { itemService } from '../services/itemService';

export default function MyItemsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { items, pagination, loading, error, retry } = useItems({ page, ...(filter !== 'all' ? { type: filter } : {}), ...(statusFilter !== 'all' ? { status: statusFilter } : {}) }, true);
  const act = async (item, remove) => {
    if (remove && !window.confirm('Delete this item permanently?')) return;
    setBusy(true); setActionError('');
    try {
      if (remove) await itemService.deleteItem(item._id);
      else await itemService.updateItem(item._id, { status: item.status === 'resolved' ? 'open' : 'resolved' });
      setPage(1); retry();
    } catch (failure) { setActionError(failure.message); }
    finally { setBusy(false); }
  };
  return <div className="container section-block page-shell">
    <div className="page-header-row"><div><span className="eyebrow">Your listings</span><h1>My Items</h1></div></div>
    <div className="filter-row"><div className="segmented-control">
      {['all', 'lost', 'found'].map(type => <button key={type} className={filter === type ? 'active' : ''} onClick={() => { setFilter(type); setPage(1); }}>{type === 'all' ? 'All' : type === 'lost' ? 'Lost' : 'Found'}</button>)}
    </div><select aria-label="Item status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}>
      <option value="all">All statuses</option><option value="open">Open</option><option value="resolved">Resolved</option>
    </select></div>
    {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
    <ItemRequestState loading={loading} error={error} retry={retry} />
    {!loading && !error ? items.length ? <>
      <div className="item-grid browse-grid">{items.map(item => <div key={item._id} className="item-card-wrap with-actions">
        <ItemCard item={item} /><div className="item-actions-row">
          <Link to={`/items/${item._id}`} className="text-link-button">View</Link>
          <Link to={`/items/${item._id}/edit`} className="text-link-button">Edit</Link>
          <button disabled={busy} className="text-link-button danger" onClick={() => act(item, true)}>Delete</button>
          <button disabled={busy} className="text-link-button" onClick={() => act(item, false)}>{item.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}</button>
        </div></div>)}</div><ItemPagination pagination={pagination} onPage={setPage} />
    </> : <EmptyState title="No items match your filters." description="Report an item or adjust your filters." actionLabel="Report Lost Item" onAction={() => navigate('/report/lost')} /> : null}
  </div>;
}
