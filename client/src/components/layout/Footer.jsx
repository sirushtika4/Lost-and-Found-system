import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h3>Lost & Found</h3>
          <p>Helping campus communities reunite belongings with their owners.</p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <ul>
            <li><Link to="/items">Browse items</Link></li>
            <li><Link to="/report/lost">Report lost</Link></li>
            <li><Link to="/report/found">Report found</Link></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/register">Register</Link></li>
            <li><Link to="/profile">Profile</Link></li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>© 2026 Lost & Found Community System</p>
      </div>
    </footer>
  );
}
