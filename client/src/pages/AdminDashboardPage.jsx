import { mockItems, mockUsers } from '../utils/mockData';

const stats = [
  { label: 'Total Users', value: mockUsers.length },
  { label: 'Lost Items', value: mockItems.filter((item) => item.type === 'lost').length },
  { label: 'Found Items', value: mockItems.filter((item) => item.type === 'found').length },
  { label: 'Resolved Items', value: mockItems.filter((item) => item.status === 'resolved').length },
  { label: 'Pending Claims', value: 12 },
];

export default function AdminDashboardPage() {
  return (
    <div className="container section-block page-shell">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Admin Dashboard</h1>
        </div>
      </div>

      <div className="stats-grid admin-summary">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card admin-card">
            <h3>{stat.value}</h3>
            <p>{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="admin-grid">
        <section className="panel">
          <h3>Recent Items</h3>
          <ul className="list-stack">
            {mockItems.map((item) => (
              <li key={item._id} className="list-row">
                <span>{item.title}</span>
                <span className={`state-chip ${item.status}`}>{item.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h3>Recent Users</h3>
          <ul className="list-stack">
            {mockUsers.map((user) => (
              <li key={user._id} className="list-row">
                <span>{user.name}</span>
                <span>{user.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel admin-full-width">
          <h3>Reported / Flagged Content</h3>
          <p className="muted">This placeholder section will appear when moderation features are enabled by the backend.</p>
        </section>
      </div>
    </div>
  );
}
