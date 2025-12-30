const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  sector: {
    type: String,
    enum: ['pharmacy', 'mall', 'distribution'],
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['retailer', 'distributor'],
    required: true,
    index: true
  },
  companyId: {
    type: String,
    trim: true,
    index: true
  },
  companyName: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'users'
});

userSchema.index({ username: 1, sector: 1 });

module.exports = mongoose.model('User', userSchema);

