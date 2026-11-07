import api, { getApiErrorMessage } from './api';

export const authService = {
  async login(credentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.token) {
        localStorage.setItem('lost_found_token', response.data.token);
      }
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Login failed. Check your email and password.'));
    }
  },

  async register(payload) {
    try {
      const response = await api.post('/auth/register', payload);
      if (response.data.token) {
        localStorage.setItem('lost_found_token', response.data.token);
      }
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Unable to register right now. Please try again.'));
    }
  },

  async me() {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Unable to load your account.'));
    }
  },

};
