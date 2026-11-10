import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import { useRef, useState } from 'react';

function ProfileEditor({ user, updateProfile }) {
  const [name, setName] = useState(user.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!name.trim()) { setError('Enter your name.'); return; }
    inFlight.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const response = await updateProfile({ name, phoneNumber });
      setName(response.user.name); setPhoneNumber(response.user.phoneNumber);
      setSuccess('Your profile was saved.');
    } catch (failure) { setError(failure.message); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <form className="profile-editor" onSubmit={submit}>
    <h3>Edit Profile</h3>
    <div className="form-grid two-col">
      <label className="field-group"><span>Name</span><input value={name} onChange={event => { setName(event.target.value); setSuccess(''); }} maxLength={100} required disabled={busy} /></label>
      <label className="field-group"><span>Phone number</span><input type="tel" value={phoneNumber} onChange={event => { setPhoneNumber(event.target.value); setSuccess(''); }} maxLength={30} disabled={busy} /></label>
      <label className="field-group"><span>Email (read-only)</span><input value={user.email} readOnly /></label>
    </div>
    {error ? <div className="inline-error" role="alert">{error} Review the values and try saving again.</div> : null}
    {success ? <p role="status">{success}</p> : null}
    <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving...' : 'Save Changes'}</Button>
  </form>;
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

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
          <div><span>Joined</span><strong>{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not available'}</strong></div>
        </div>

        <ProfileEditor key={user._id} user={user} updateProfile={updateProfile} />
      </div>
    </div>
  );
}
