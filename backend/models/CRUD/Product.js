const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  productDescription: {
    type: String,
    maxlength: 500,
    trim: true
  },
  productPrice: {
    type: Number,
    required: true,
    min: 0,
    index: true
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
  },
  sku: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true
  },
  barcode: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true
  },
  stockQuantity: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  unit: {
    type: String,
    trim: true,
    default: 'piece'
  },
  companyId: {
    type: String,
    trim: true,
    index: true
  },
  supplierId: {
    type: String,
    trim: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'products'
});

productSchema.index({ categoryId: 1, brand: 1 });
productSchema.index({ companyId: 1, isActive: 1 });
productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ productPrice: 1, isActive: 1 });
// Note: _id index already exists by default in MongoDB - no need to create it explicitly

module.exports = mongoose.model('Product', productSchema);

