export default function ItemPagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  return <nav className="form-actions" aria-label="Item pages">
    <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button>
    <span>Page {pagination.page} of {pagination.pages}</span>
    <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next</button>
  </nav>;
}
