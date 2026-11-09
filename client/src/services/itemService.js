import api from './api';

export const itemService = {
  async getItems(params = {}) {
    try {
      const response = await api.get('/items', { params });
      return response.data;
    } catch (error) {
      throw new Error(error?.response?.data?.message || 'Unable to load items. Please try again.');
    }
  },

  async getMyItems(params = {}) {
    try { return (await api.get('/items/mine', { params })).data; }
    catch (error) { throw new Error(error?.response?.data?.message || 'Unable to load your items. Please try again.'); }
  },

  async getItemById(id) {
    try {
      const response = await api.get(`/items/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error?.response?.data?.message || 'Unable to load item details.');
    }
  },

  async createItem(payload) {
    try {
      const response = await api.post('/items', payload);
      return response.data;
    } catch (error) {
      throw new Error(error?.response?.data?.message || 'Unable to submit item. Please try again.');
    }
  },

  async updateItem(id, payload) {
    try {
      const response = await api.patch(`/items/${id}`, payload);
      return response.data;
    } catch (error) {
      throw new Error(error?.response?.data?.message || 'Unable to update item.');
    }
  },

  async deleteItem(id) {
    try {
      // A JSON body keeps Axios from dropping Content-Type, required by our CSRF policy.
      await api.delete(`/items/${id}`, { data: {} });
      return true;
    } catch (error) {
      throw new Error(error?.response?.data?.message || 'Unable to delete item.');
    }
  },
};

export function itemPayload(form) {
  return Object.fromEntries(['title', 'category', 'description', 'color', 'brand', 'location', 'image', 'type'].map(key => [key, form[key] || '']).concat([['dateLostOrFound', form.date]]));
}
