const mongoose = require('mongoose');
const { claimSchema } = require('./Claim');
const categories = ['Electronics', 'Wallets', 'Bags', 'Keys', 'Documents', 'Books', 'Jewellery', 'Clothing', 'ID Cards', 'Other'];
const schema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 150 },
  description: { type: String, required: true, maxlength: 4000 },
  type: { type: String, required: true, enum: ['lost', 'found'] },
  category: { type: String, required: true, enum: categories },
  color: { type: String, default: '', maxlength: 80 },
  brand: { type: String, default: '', maxlength: 100 },
  location: { type: String, required: true, maxlength: 200 },
  dateLostOrFound: { type: String, required: true },
  image: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  claims: { type: [claimSchema], default: undefined, select: false },
  approvedClaimId: { type: mongoose.Schema.Types.ObjectId, select: false },
}, { collection: 'items', timestamps: true, autoCreate: false, autoIndex: false });
function createItemModel(connection = mongoose) {
  return connection.models.Item || connection.model('Item', schema, 'items');
}
function safeItem(item) {
  return Object.fromEntries(['_id', 'title', 'description', 'type', 'category', 'color', 'brand', 'location', 'dateLostOrFound', 'image', 'status', 'userId', 'createdAt', 'updatedAt'].map(key => [key, ['_id', 'userId'].includes(key) ? String(item[key]) : item[key]]));
}
module.exports = { createItemModel, safeItem, categories };
