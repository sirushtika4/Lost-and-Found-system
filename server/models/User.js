const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true, select: false },
  phoneNumber: { type: String, default: '' },
  role: { type: String, default: 'user' },
  profileImage: { type: String, default: '' },
}, { collection: 'users', timestamps: true, autoCreate: false, autoIndex: false });

// No save/hash hooks: login never rewrites existing hashes or user records.
function createUserModel(connection = mongoose) {
  return connection.models.User || connection.model('User', schema, 'users');
}
function safeUser(user) {
  return { _id: String(user._id), name: user.name, email: user.email,
    phoneNumber: user.phoneNumber || '', phone: user.phoneNumber || '',
    role: user.role, profileImage: user.profileImage || '', joinedAt: user.createdAt };
}
module.exports = { createUserModel, safeUser };
