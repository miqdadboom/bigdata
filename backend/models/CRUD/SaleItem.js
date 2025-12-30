const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  itemNotes: {
    type: String,
    trim: true
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  },
  brand: {
    type: String,
    trim: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'sale_items'
});

// Compound indexes for common aggregations
saleItemSchema.index({ saleId: 1, productId: 1 });
saleItemSchema.index({ productId: 1, createdAt: -1 });
saleItemSchema.index({ categoryId: 1, createdAt: -1 });
saleItemSchema.index({ brand: 1, createdAt: -1 });
saleItemSchema.index({ saleId: 1, productId: 1, quantity: 1, subtotal: 1 });
// Critical indexes for analytics performance
saleItemSchema.index({ productId: 1, brand: 1 }); // For brand analysis
saleItemSchema.index({ saleId: 1, brand: 1 }); // For brand lookups
// Note: saleId and productId already have indexes from field definition (index: true)

// Calculate subtotal before saving
saleItemSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('price')) {
    this.subtotal = (this.quantity * this.price) - (this.discount || 0);
  }
  next();
});

module.exports = mongoose.model('SaleItem', saleItemSchema);

