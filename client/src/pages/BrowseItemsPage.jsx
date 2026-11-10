import { useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useItems } from '../services/useItems';
import ItemPagination from '../components/items/ItemPagination';
import ItemCard from '../components/items/ItemCard';
import ItemRequestState from '../components/items/ItemRequestState';
import EmptyState from '../components/common/EmptyState';

const categories = ['All', 'Electronics', 'Wallets', 'Bags', 'Keys', 'Documents', 'Books', 'Jewellery', 'Clothing', 'ID Cards', 'Other'];

export default function BrowseItemsPage() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    type: 'All',
    category: categories.includes(searchParams.get('category')) ? searchParams.get('category') : 'All',
    location: '',
    status: 'All',
    sort: 'newest',
  });

  const params = { page, search: query, sort: filters.sort, location: filters.location };
  if (filters.type !== 'All') params.type = filters.type.toLowerCase();
  if (filters.category !== 'All') params.category = filters.category;
  if (filters.status !== 'All') params.status = filters.status.toLowerCase();
  const { items: filteredItems, pagination, loading, error, retry } = useItems(params);

  const resetFilters = () => {
    setPage(1);
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
            onChange={(event) => { setPage(1); setQuery(event.target.value); }}
            placeholder="Search items, locations, or descriptions"
            aria-label="Search for items"
            maxLength={100}
          />
        </div>

        <div className="filter-grid">
          <label>
            <span>Type</span>
            <select aria-label="Type" value={filters.type} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, type: event.target.value })); }}>
              <option>All</option>
              <option>Lost</option>
              <option>Found</option>
            </select>
          </label>

          <label>
            <span>Category</span>
            <select aria-label="Category" value={filters.category} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, category: event.target.value })); }}>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Location</span>
            <input maxLength={100} value={filters.location} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, location: event.target.value })); }} placeholder="Library" />
          </label>

          <label>
            <span>Status</span>
            <select aria-label="Status" value={filters.status} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, status: event.target.value })); }}>
              <option>All</option>
              <option>Open</option>
              <option>Resolved</option>
            </select>
          </label>

          <label>
            <span>Sort</span>
            <select aria-label="Sort" value={filters.sort} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, sort: event.target.value })); }}>
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
        <p>{pagination?.total ?? 0} items found</p>
      </div>

      {loading ? (
        <ItemRequestState loading />
      ) : error ? (
        <ItemRequestState error={error} retry={retry} />
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
      {!loading && !error ? <ItemPagination pagination={pagination} onPage={setPage} /> : null}
    </div>
  );
}
