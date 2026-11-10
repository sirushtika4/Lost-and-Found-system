import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [check, setCheck] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const current = ++generation.current;
    const restoreSession = async () => {
      try {
        const response = await authService.me({ signal });
        if (current === generation.current && !signal.aborted) { setUser(response.user); setSessionError(''); }
      } catch (error) {
        if (current === generation.current && !signal.aborted) {
          if (error.status === 401) { setUser(null); setSessionError(''); }
          else setSessionError(error.message);
        }
      } finally {
        if (current === generation.current && !signal.aborted) {
          setLoading(false);
          // Migration cleanup only: authentication never reads browser storage.
          try { localStorage.removeItem('lost_found_token'); } catch {}
        }
      }
    };
    restoreSession();
    const expired = () => { generation.current++; setLoading(false); setUser(null); setSessionError(''); };
    const focused = () => setCheck(value => value + 1);
    window.addEventListener('auth:expired', expired);
    window.addEventListener('focus', focused);
    return () => {
      controller.abort();
      window.removeEventListener('auth:expired', expired);
      window.removeEventListener('focus', focused);
    };
  }, [check]);

  const retrySession = useCallback(() => {
    setLoading(true);
    setSessionError('');
    setCheck(value => value + 1);
  }, []);
  const login = useCallback(async credentials => {
    generation.current++;
    setLoading(true);
    try {
      const response = await authService.login(credentials);
      generation.current++;
      setUser(response.user);
      setSessionError('');
      return response;
    } finally { setLoading(false); }
  }, []);
  const register = useCallback(async payload => {
    generation.current++;
    setLoading(true);
    try {
      const response = await authService.register(payload);
      generation.current++;
      setUser(response.user);
      setSessionError('');
      return response;
    } finally { setLoading(false); }
  }, []);
  const logout = useCallback(async () => {
    generation.current++;
    await authService.logout();
    generation.current++;
    setUser(null);
    setSessionError('');
  }, []);
  const updateProfile = useCallback(async payload => {
    generation.current++;
    const response = await authService.updateProfile(payload);
    generation.current++;
    // A late save must never restore a logged-out user or replace another account.
    setUser(current => current?._id === response.user._id ? response.user : current);
    return response;
  }, []);
  const value = useMemo(() => ({ user, login, logout, register, updateProfile, loading, sessionError, retrySession }),
    [user, login, logout, register, updateProfile, loading, sessionError, retrySession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
