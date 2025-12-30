const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  saleTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  deliveryTime: {
    type: Date,
    required: false,
    index: true
  },
  saleStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'completed'],
    default: 'completed',
    index: true
  },
  saleNotes: {
    type: String,
    trim: true
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    index: true
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
  saleType: {
    type: String,
    enum: ['retail', 'wholesale', 'online', 'pharmacy', 'distribution', 'other'],
    default: 'retail',
    index: true
  },
  // Sector: Main business sector (pharmacy, mall, distribution)
  sector: {
    type: String,
    enum: ['pharmacy', 'mall', 'distribution', 'other'],
    index: true
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Source tracking for data ingestion
  source: {
    type: String,
    trim: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'sales'
});

saleSchema.index({ saleTime: -1, saleStatus: 1 });
saleSchema.index({ companyId: 1, saleTime: -1 });
saleSchema.index({ region: 1, saleTime: -1 });
saleSchema.index({ employeeId: 1, saleTime: -1 });
saleSchema.index({ clientId: 1, saleTime: -1 });
saleSchema.index({ saleStatus: 1, saleTime: -1 });
saleSchema.index({ branchId: 1, saleTime: -1 });
saleSchema.index({ saleType: 1, saleTime: -1 });
saleSchema.index({ sector: 1, saleTime: -1 });
saleSchema.index({ sector: 1, region: 1, saleTime: -1 });
saleSchema.index({ companyId: 1, sector: 1, saleTime: -1 });
saleSchema.index({ source: 1, saleTime: -1 });
// Critical compound indexes for analytics performance
saleSchema.index({ saleStatus: 1, sector: 1, companyId: 1, saleTime: -1 }); // For problem detection and root cause
saleSchema.index({ saleStatus: 1, sector: 1, saleTime: -1 }); // For market aggregations
saleSchema.index({ companyId: 1, saleStatus: 1, sector: 1 }); // For company-specific queries
// Additional indexes for getCompanyDetailedAnalytics performance
saleSchema.index({ companyId: 1, saleStatus: 1, employeeId: 1 }); // For employee performance aggregation
saleSchema.index({ companyId: 1, employeeId: 1, saleTime: -1 }); // For employee performance with time filter
saleSchema.index({ companyId: 1, saleStatus: 1, saleTime: -1 }); // For company analytics with time filter

module.exports = mongoose.model('Sale', saleSchema);

