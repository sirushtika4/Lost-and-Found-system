import { useMemo, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { mockItems } from '../utils/mockData';
import ItemCard from '../components/items/ItemCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

const categories = ['All', 'Electronics', 'Wallets', 'Bags', 'Keys', 'Documents', 'Books', 'Jewellery', 'Clothing', 'ID Cards', 'Other'];

export default function BrowseItemsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    type: 'All',
    category: 'All',
    location: '',
    status: 'All',
    sort: 'newest',
  });

  const filteredItems = useMemo(() => {
    let results = [...mockItems];

    if (query) {
      results = results.filter((item) => `${item.title} ${item.description} ${item.location}`.toLowerCase().includes(query.toLowerCase()));
    }

    if (filters.type !== 'All') {
      results = results.filter((item) => item.type === filters.type.toLowerCase());
    }

    if (filters.category !== 'All') {
      results = results.filter((item) => item.category === filters.category);
    }

    if (filters.location) {
      results = results.filter((item) => item.location.toLowerCase().includes(filters.location.toLowerCase()));
    }

    if (filters.status !== 'All') {
      results = results.filter((item) => item.status === filters.status.toLowerCase());
    }

    results.sort((a, b) => {
      const first = new Date(a.createdAt).getTime();
      const second = new Date(b.createdAt).getTime();
      return filters.sort === 'oldest' ? first - second : second - first;
    });

    return results;
  }, [query, filters]);

  const resetFilters = () => {
    setQuery('');
    setFilters({ type: 'All', category: 'All', location: '', status: 'All', sort: 'newest' });
  };

  return (
    <div className="container section-block page-shell">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Discover items</span>
          <h1>Browse Lost & Found Items</h1>
        </div>
      </div>

      <div className="filter-panel">
        <div className="search-shell">
          <Search size={18} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items, locations, or descriptions"
            aria-label="Search for items"
          />
        </div>

        <div className="filter-grid">
          <label>
            <span>Type</span>
            <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
              <option>All</option>
              <option>Lost</option>
              <option>Found</option>
            </select>
          </label>

          <label>
            <span>Category</span>
            <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Location</span>
            <input value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} placeholder="Library" />
          </label>

          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option>All</option>
              <option>Open</option>
              <option>Claimed</option>
              <option>Resolved</option>
            </select>
          </label>

          <label>
            <span>Sort</span>
            <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>

          <button type="button" className="btn btn-secondary btn-md reset-btn" onClick={resetFilters}>
            <RotateCcw size={16} /> Reset Filters
          </button>
        </div>
      </div>

      <div className="results-topbar">
        <p>{filteredItems.length} items found</p>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading items..." />
      ) : error ? (
        <div className="inline-error">{error}</div>
      ) : filteredItems.length ? (
        <div className="item-grid browse-grid">
          {filteredItems.map((item) => (
            <ItemCard key={item._id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing matched your search."
          description="Try adjusting your filters or search terms to find a match."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      )}
    </div>
  );
}
