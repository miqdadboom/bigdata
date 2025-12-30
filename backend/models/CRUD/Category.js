const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  categoryDescription: {
    type: String,
    maxlength: 200,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'categories'
});

categorySchema.index({ categoryName: 1 });

module.exports = mongoose.model('Category', categorySchema);

