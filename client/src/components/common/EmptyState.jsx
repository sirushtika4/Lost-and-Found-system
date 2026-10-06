export default function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {onAction && actionLabel ? (
        <button type="button" className="btn btn-primary btn-md" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
