import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="container section-block page-shell narrow-page">
      <div className="profile-shell panel">
        <div className="profile-header">
          <div className="avatar">{user.name?.charAt(0) || 'U'}</div>
          <div>
            <span className="eyebrow">Profile</span>
            <h1>{user.name}</h1>
          </div>
        </div>

        <div className="profile-grid">
          <div><span>Email</span><strong>{user.email}</strong></div>
          <div><span>Phone</span><strong>{user.phone || 'Not provided'}</strong></div>
          <div><span>Role</span><strong>{user.role}</strong></div>
          <div><span>Joined</span><strong>{new Date(user.joinedAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
        </div>

        <div className="profile-editor">
          <h3>Edit Profile</h3>
          <div className="form-grid two-col">
            <label className="field-group">
              <span>Name</span>
              <input value={user.name} readOnly />
            </label>
            <label className="field-group">
              <span>Email</span>
              <input value={user.email} readOnly />
            </label>
          </div>
          <Button type="button" variant="primary">Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
