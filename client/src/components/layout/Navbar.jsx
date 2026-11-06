import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Browse Items', to: '/items' },
  { label: 'Report Lost', to: '/report/lost' },
  { label: 'Report Found', to: '/report/found' },
];

function ThemeToggle({ onToggle }) {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === 'light' ? Sun : Moon;
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className="nav-link nav-action theme-toggle"
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => {
        toggleTheme();
        onToggle?.();
      }}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link to="/" className="brand" aria-label="Lost & Found home">
          <div className="brand-mark">L&F</div>
          <div>
            <span className="brand-name">Lost & Found</span>
            <span className="brand-subtitle">Community System</span>
          </div>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}

          <ThemeToggle />

          {!user ? (
            <>
              <NavLink to="/login" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Login
              </NavLink>
              <NavLink to="/register" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Register
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/my-items" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                My Items
              </NavLink>
              <NavLink to="/my-claims" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                My Claims
              </NavLink>
              <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Profile
              </NavLink>
              {user.role === 'admin' ? (
                <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Admin Dashboard
                </NavLink>
              ) : null}
              <button type="button" className="nav-link nav-action" onClick={handleLogout}>
                <LogOut size={16} />
                Logout
              </button>
            </>
          )}
        </nav>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen ? (
        <div className="mobile-nav-panel">
          <div className="container mobile-nav-stack">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                {item.label}
              </NavLink>
            ))}

            <ThemeToggle onToggle={() => setMenuOpen(false)} />

            {!user ? (
              <>
                <NavLink to="/login" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Login
                </NavLink>
                <NavLink to="/register" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Register
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/my-items" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  My Items
                </NavLink>
                <NavLink to="/my-claims" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  My Claims
                </NavLink>
                <NavLink to="/profile" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  Profile
                </NavLink>
                {user.role === 'admin' ? (
                  <NavLink to="/admin" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    Admin Dashboard
                  </NavLink>
                ) : null}
                <button type="button" className="nav-link nav-action" onClick={handleLogout}>
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
