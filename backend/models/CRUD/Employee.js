const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  employeeEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true
  },
  employeePhone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true,
    index: true
  },
  position: {
    type: String,
    trim: true,
    index: true
  },
  hireDate: {
    type: Date,
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
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'employees'
});

employeeSchema.index({ companyId: 1, branchId: 1 });
employeeSchema.index({ department: 1, isActive: 1 });
employeeSchema.index({ hireDate: 1, isActive: 1 });
// Critical indexes for employee performance aggregation
employeeSchema.index({ companyId: 1, _id: 1 }); // For $lookup from sales (companyId + _id match)
employeeSchema.index({ _id: 1, companyId: 1 }); // Alternative order for $lookup optimization

module.exports = mongoose.model('Employee', employeeSchema);

