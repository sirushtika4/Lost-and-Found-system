import api from './api';

export const claimService = {
  async submitClaim(itemId, payload) {
    try {
      const response = await api.post(`/items/${itemId}/claims`, payload);
      return response.data;
    } catch (error) {
      throw new Error(error?.response?.data?.message || 'Unable to submit claim. Please try again.');
    }
  },

  async getClaims() {
    try {
      const response = await api.get('/claims');
      return response.data;
    } catch (error) {
      throw new Error(error?.response?.data?.message || 'Unable to load claims.');
    }
  },
};
