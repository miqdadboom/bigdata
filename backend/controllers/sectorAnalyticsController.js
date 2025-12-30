const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const mongoose = require('mongoose');
const { SparkTopProducts, SparkTopBrands, SparkEmployeePerformance, SparkMarketAnalytics, SparkSalesByRegion } = require('../models/SparkMarketAnalytics');

// Track logged messages to avoid repetition
const loggedMessages = new Map();
const LOG_INTERVAL = 300000; // Log same message only once per 5 minutes (300 seconds)
const ENABLE_SPARK_LOGGING = process.env.ENABLE_SPARK_LOGGING === 'true' || false; // Only log if explicitly enabled

// Get Sector Analytics (Market Overview)
exports.getSectorAnalytics = async (req, res) => {
  const startTime = Date.now();
  try {
    const sector = req.params.sector || req.query.sector;
    const { startDate, endDate } = req.query;

    if (!sector) {
      return res.status(400).json({ error: 'sector is required' });
    }

    // Read from Spark collections (fast path - no aggregations)
    // Summary from spark_market_analytics
    let summary = { totalRevenue: 0, totalSales: 0, avgSaleAmount: 0, totalCompanies: 0 };
    try {
      const marketSparkData = await SparkMarketAnalytics.findOne({ 
        sector: sector 
      }).lean();
      
      if (marketSparkData) {
        summary = {
          totalRevenue: marketSparkData.marketRevenue || 0,
          totalSales: marketSparkData.marketSalesCount || 0,
          avgSaleAmount: marketSparkData.marketAvgSale || 0,
          totalCompanies: marketSparkData.totalCompanies || 0
        };
      }
    } catch (sparkError) {
      console.error('[Sector Analytics] Error reading Spark market analytics:', sparkError.message);
      // Continue with default values
    }

    // Sales by Region from spark_sales_by_region
    let salesByRegion = [];
    try {
      const sparkRegions = await SparkSalesByRegion.find({ sector: sector })
        .sort({ revenue: -1 })
        .lean();
      
      salesByRegion = sparkRegions.map(region => ({
        _id: region.region,
        totalRevenue: region.revenue || 0,
        totalSales: region.salesCount || 0
      }));
    } catch (sparkError) {
      console.error('[Sector Analytics] Error reading Spark sales by region:', sparkError.message);
      // Continue with empty array
    }

    // Top Products from spark_market_analytics_top_products
    let topProducts = [];
    try {
      const sparkTopProducts = await SparkTopProducts.find({ sector: sector })
        .sort({ totalRevenue: -1 })
        .limit(50)
        .lean();
      
      topProducts = sparkTopProducts.map(p => ({
        _id: p.productId,
        productName: p.productName || 'Unknown',
        brand: p.brand || null,
        totalQuantity: p.totalQuantity || 0,
        totalRevenue: p.totalRevenue || 0,
        avgPrice: p.avgPrice || 0
      }));
    } catch (sparkError) {
      console.error('[Sector Analytics] Error reading Spark top products:', sparkError.message);
      // Continue with empty array
    }

    const duration = Date.now() - startTime;
    console.log(`[Sector Analytics] SUCCESS: Response in ${duration}ms - Sector: ${sector}`);

    res.json({
      summary,
      salesByRegion,
      topProducts,
      source: 'spark' // Indicate data source
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Sector Analytics] ERROR: Error after ${duration}ms:`, error.message);
    console.error('[Sector Analytics] Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get Sector Overview (alias for getSectorAnalytics)
exports.getSectorOverview = async (req, res) => {
  req.query.sector = req.params.sector;
  return exports.getSectorAnalytics(req, res);
};

// Get Sector Companies
exports.getSectorCompanies = async (req, res) => {
  try {
    const { sector } = req.params;
    const { startDate, endDate } = req.query;

    const matchQuery = { sector };
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }

    const companies = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$companyId',
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          avgSaleAmount: { $avg: '$totalAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Sector Regions
exports.getSectorRegions = async (req, res) => {
  try {
    const { sector } = req.params;
    const { startDate, endDate } = req.query;

    const matchQuery = { sector };
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }

    const regions = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$region',
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          avgSaleAmount: { $avg: '$totalAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json(regions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Company in Sector
exports.getCompanyInSector = async (req, res) => {
  try {
    const { sector, companyId } = req.params;
    const { startDate, endDate } = req.query;

    const matchQuery = { sector, companyId };
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }

    const companyData = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          avgSaleAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    res.json(companyData[0] || { totalRevenue: 0, totalSales: 0, avgSaleAmount: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
