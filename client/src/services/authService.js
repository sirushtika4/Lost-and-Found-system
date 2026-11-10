import api, { getApiErrorMessage } from './api';

async function request(promise, fallback) {
  try { return (await promise).data; }
  catch (error) {
    const failure = new Error(getApiErrorMessage(error, fallback));
    failure.status = error.response?.status;
    throw failure;
  }
}
export const authService = {
  login: credentials => request(api.post('/auth/login', credentials), 'Unable to sign in.'),
  register: payload => request(api.post('/auth/register', payload), 'Unable to register.'),
  me: ({ signal } = {}) => request(api.get('/auth/me', { signal }), 'Unable to check your session.'),
  updateProfile: payload => request(api.patch('/auth/me', payload), 'Unable to save your profile. Please try again.'),
  logout: () => request(api.post('/auth/logout', {}), 'Unable to sign out. Please try again.'),
};
