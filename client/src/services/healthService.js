import api, { getApiErrorMessage } from './api';

export const healthService = {
  async getHealth({ signal } = {}) {
    try {
      const { data } = await api.get('/health', { signal });
      if (data?.status !== 'OK' || typeof data.service !== 'string' || typeof data.database !== 'string') {
        throw new Error('Unexpected health response.');
      }
      return data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Unable to verify the server status. Please try again.'));
    }
  },
};
