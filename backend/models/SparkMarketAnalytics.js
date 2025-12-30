const mongoose = require('mongoose');

/**
 * Spark Market Analytics Models
 * Models for reading Spark-calculated analytics from MongoDB
 */

// Top Products Schema
const SparkTopProductsSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    required: true,
    index: true
  },
  productName: String,
  brand: String,
  totalRevenue: Number,
  totalQuantity: Number,
  avgPrice: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  window: String
}, {
  timestamps: false
});

// Top Brands Schema
const SparkTopBrandsSchema = new mongoose.Schema({
  brand: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    required: true,
    index: true
  },
  totalRevenue: Number,
  productCount: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  window: String
}, {
  timestamps: false
});

// Employee Performance Schema
const SparkEmployeePerformanceSchema = new mongoose.Schema({
  sector: {
    type: String,
    required: true,
    index: true
  },
  avgSaleAmount: Number,
  totalSales: Number,
  totalEmployees: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  window: String
}, {
  timestamps: false
});

// Company Analytics Schema - NEW for Problem Detection
const SparkCompanyAnalyticsSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    required: true,
    index: true
  },
  revenue: Number,
  salesCount: Number,
  avgSaleAmount: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  window: String
}, {
  timestamps: false
});

// Compound index for faster lookups
SparkCompanyAnalyticsSchema.index({ companyId: 1, sector: 1 });

// Market Analytics Schema - NEW for Problem Detection
const SparkMarketAnalyticsSchema = new mongoose.Schema({
  sector: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  marketRevenue: Number,
  marketSalesCount: Number,
  marketAvgSale: Number,
  totalCompanies: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  window: String
}, {
  timestamps: false
});

// Company Brands Schema - NEW for Root Cause Analysis
const SparkCompanyBrandsSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    required: true,
    index: true
  },
  brand: {
    type: String,
    required: true,
    index: true
  },
  revenue: Number,
  quantity: Number,
  avgPrice: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  window: String
}, {
  timestamps: false
});

// Company Employees Schema - NEW for Root Cause Analysis
// Note: sector removed - Spark saves ALL employees per company (aggregated across sectors)
const SparkCompanyEmployeesSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    index: true
  },
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  employeeName: String,
  revenue: Number,
  salesCount: Number,
  avgSaleAmount: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Company Top Products Schema - NEW for Company Analytics
const SparkCompanyTopProductsSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    required: true,
    index: true
  },
  productId: {
    type: String,
    required: true,
    index: true
  },
  productName: String,
  brand: String,
  totalRevenue: Number,
  totalQuantity: Number,
  avgPrice: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Sales by Sector Schema - Query 1
const SparkSalesBySectorSchema = new mongoose.Schema({
  sector: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  revenue: Number,
  salesCount: Number,
  avgSaleAmount: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Sales by Region Schema - Query 2
const SparkSalesByRegionSchema = new mongoose.Schema({
  region: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    required: true,
    index: true
  },
  revenue: Number,
  salesCount: Number,
  avgSaleAmount: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Create models with custom collection names
// Updated: Spark now writes to collections without dots (MongoDB connector doesn't support dots)
const SparkTopProducts = mongoose.model('SparkTopProducts', SparkTopProductsSchema, 'spark_market_analytics_top_products');
const SparkTopBrands = mongoose.model('SparkTopBrands', SparkTopBrandsSchema, 'spark_market_analytics_top_brands');
const SparkEmployeePerformance = mongoose.model('SparkEmployeePerformance', SparkEmployeePerformanceSchema, 'spark_market_analytics_employee_performance');
const SparkCompanyAnalytics = mongoose.model('SparkCompanyAnalytics', SparkCompanyAnalyticsSchema, 'spark_company_analytics');
const SparkMarketAnalytics = mongoose.model('SparkMarketAnalytics', SparkMarketAnalyticsSchema, 'spark_market_analytics');
const SparkCompanyBrands = mongoose.model('SparkCompanyBrands', SparkCompanyBrandsSchema, 'spark_company_brands');
const SparkCompanyEmployees = mongoose.model('SparkCompanyEmployees', SparkCompanyEmployeesSchema, 'spark_company_employees');
const SparkCompanyTopProducts = mongoose.model('SparkCompanyTopProducts', SparkCompanyTopProductsSchema, 'spark_company_top_products');
const SparkSalesBySector = mongoose.model('SparkSalesBySector', SparkSalesBySectorSchema, 'spark_sales_by_sector');
const SparkSalesByRegion = mongoose.model('SparkSalesByRegion', SparkSalesByRegionSchema, 'spark_sales_by_region');

// Compound indexes for faster lookups
SparkCompanyBrandsSchema.index({ companyId: 1, sector: 1 });
SparkCompanyEmployeesSchema.index({ companyId: 1, employeeId: 1 }); // Compound index for company+employee (no sector)
SparkCompanyTopProductsSchema.index({ companyId: 1, sector: 1, productId: 1 }, { unique: true }); // Compound index for company+sector+product (unique)
SparkSalesByRegionSchema.index({ region: 1, sector: 1 }); // Compound index for region+sector

module.exports = {
  SparkTopProducts,
  SparkTopBrands,
  SparkEmployeePerformance,
  SparkCompanyAnalytics,
  SparkMarketAnalytics,
  SparkCompanyBrands,
  SparkCompanyEmployees,
  SparkCompanyTopProducts,
  SparkSalesBySector,
  SparkSalesByRegion
};

