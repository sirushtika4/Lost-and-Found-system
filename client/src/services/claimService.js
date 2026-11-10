import api from './api';
async function request(operation, fallback) {
  try { return (await operation()).data; }
  catch (error) { throw new Error(error?.response?.data?.message || fallback); }
}
export const claimService = {
  submitClaim: (itemId, payload) => request(() => api.post('/claims', { itemId, ...payload }), 'Unable to submit claim. Please try again.'),
  getMine: params => request(() => api.get('/claims/mine', { params }), 'Unable to load submitted claims. Please retry.'),
  getReceived: params => request(() => api.get('/claims/received', { params }), 'Unable to load received claims. Please retry.'),
  getById: id => request(() => api.get(`/claims/${id}`), 'Unable to load claim.'),
  review: (id, status) => request(() => api.patch(`/claims/${id}/status`, { status }), 'Unable to review claim. Please retry.'),
};
