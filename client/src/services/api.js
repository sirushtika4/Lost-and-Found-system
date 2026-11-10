import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function getApiErrorMessage(error, fallback) {
  if (error?.response?.status === 404) {
    return 'This feature is not available on the current server yet.';
  }
  if (typeof error?.response?.data?.message === 'string') {
    return error.response.data.message;
  }
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'The server took too long to respond. Please try again.';
  }
  if (!error?.response && error?.request) {
    return 'Unable to reach the server. Check your connection and try again.';
  }
  return fallback;
}

export const api = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) config.headers['X-CSRF-Protection'] = '1';
  return config;
});

api.interceptors.response.use(response => response, error => {
  // Session restoration handles its own 401, so a stale check cannot invalidate a newer login.
  const sessionRestore = error.config?.method === 'get' && /\/auth\/me$/.test(error.config?.url || '');
  if (error.response?.status === 401 && !sessionRestore && !/\/auth\/(login|register)$/.test(error.config?.url || '')) window.dispatchEvent(new Event('auth:expired'));
  return Promise.reject(error);
});

export default api;
