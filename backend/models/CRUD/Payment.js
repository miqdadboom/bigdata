const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
    index: true
  },
  paymentAmount: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  paymentType: {
    type: String,
    enum: ['cash', 'cheque', 'card', 'bank_transfer', 'other'],
    required: true,
    index: true
  },
  paymentDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  transactionId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  chequeNumber: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  chequeDate: {
    type: Date
  },
  companyId: {
    type: String,
    trim: true,
    index: true
  },
  branchId: {
    type: String,
    trim: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'payments'
});

paymentSchema.index({ saleId: 1, paymentStatus: 1 });
paymentSchema.index({ paymentDate: -1, paymentType: 1 });
paymentSchema.index({ companyId: 1, paymentDate: -1 });
paymentSchema.index({ paymentStatus: 1, paymentDate: -1 });
paymentSchema.index({ branchId: 1, paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

