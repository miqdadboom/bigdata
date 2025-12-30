const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  clientName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  clientEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  clientPhone: {
    type: String,
    required: true,
    trim: true
  },
  clientLocation: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  region: {
    type: String,
    trim: true,
    index: true
  },
  city: {
    type: String,
    trim: true,
    index: true
  },
  companyId: {
    type: String,
    trim: true,
    index: true
  },
  companyName: {
    type: String,
    trim: true,
    index: true
  },
  branchId: {
    type: String,
    trim: true,
    index: true
  },
  branchName: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'clients'
});

clientSchema.index({ clientLocation: 1, region: 1 });
clientSchema.index({ companyId: 1, branchId: 1 });
clientSchema.index({ region: 1, city: 1 });

module.exports = mongoose.model('Client', clientSchema);

