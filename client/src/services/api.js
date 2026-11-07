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
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lost_found_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
