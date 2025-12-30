const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const Product = require('../models/CRUD/Product');
const Employee = require('../models/CRUD/Employee');
const Client = require('../models/CRUD/Client');
const { 
  SparkSalesByRegion, 
  SparkCompanyAnalytics, 
  SparkMarketAnalytics,
  SparkTopProducts,
  SparkCompanyTopProducts,
  SparkCompanyEmployees,
  SparkTopBrands,
  SparkCompanyBrands
} = require('../models/SparkMarketAnalytics');

// Get Sales Summary (KPIs)
exports.getSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate, companyId, branchId, region, sector } = req.query;
    
    // Try Spark first (fast path)
    let summary = { totalRevenue: 0, totalSales: 0, averageSaleAmount: 0 };
    try {
      if (companyId) {
        // Use Spark Company Analytics
        const query = { companyId: companyId };
        if (sector) query.sector = sector;
        
        const companySparkData = await SparkCompanyAnalytics.findOne(query).lean();
        if (companySparkData) {
          summary = {
            totalRevenue: companySparkData.revenue || 0,
            totalSales: companySparkData.salesCount || 0,
            averageSaleAmount: companySparkData.avgSaleAmount || 0
          };
        }
      } else if (sector) {
        // Use Spark Market Analytics
        const marketSparkData = await SparkMarketAnalytics.findOne({ sector: sector }).lean();
        if (marketSparkData) {
          summary = {
            totalRevenue: marketSparkData.marketRevenue || 0,
            totalSales: marketSparkData.marketSalesCount || 0,
            averageSaleAmount: marketSparkData.marketAvgSale || 0
          };
        }
      }
      
      // If Spark data found, return it (salesByStatus and salesByType still need MongoDB)
      if (summary.totalSales > 0 || summary.totalRevenue > 0) {
        // Still need to get salesByStatus and salesByType from MongoDB
        const matchQuery = {};
        if (startDate || endDate) {
          matchQuery.saleTime = {};
          if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
          if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
        }
        if (companyId) matchQuery.companyId = companyId;
        if (branchId) matchQuery.branchId = branchId;
        if (region) matchQuery.region = region;
        
        const [salesByStatus, salesByType] = await Promise.all([
          Sale.aggregate([
            { $match: matchQuery },
            { $group: { _id: '$saleStatus', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }
          ]),
          Sale.aggregate([
            { $match: matchQuery },
            { $group: { _id: '$saleType', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }
          ])
        ]);
        
        return res.json({
          summary,
          byStatus: salesByStatus,
          byType: salesByType
        });
      }
    } catch (sparkError) {
      console.error('[Analytics] Error reading Spark summary:', sparkError.message);
      // Fallback to MongoDB
    }
    
    // Fallback to MongoDB aggregation
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }
    if (companyId) matchQuery.companyId = companyId;
    if (branchId) matchQuery.branchId = branchId;
    if (region) matchQuery.region = region;

    const [
      totalSales,
      totalRevenue,
      totalCount,
      avgSaleAmount,
      salesByStatus,
      salesByType
    ] = await Promise.all([
      // Total Revenue
      Sale.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // Total Sales Count
      Sale.countDocuments(matchQuery),
      // Average Sale Amount
      Sale.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, avg: { $avg: '$totalAmount' } } }
      ]),
      // Sales by Status
      Sale.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$saleStatus', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }
      ]),
      // Sales by Type
      Sale.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$saleType', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }
      ])
    ]);

    res.json({
      summary: {
        totalRevenue: totalSales[0]?.total || 0,
        totalSales: totalCount,
        averageSaleAmount: avgSaleAmount[0]?.avg || 0
      },
      byStatus: salesByStatus,
      byType: salesByType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Sales by Region
exports.getSalesByRegion = async (req, res) => {
  try {
    const { startDate, endDate, companyId, sector } = req.query;
    
    // Read from Spark collection (fast path - no aggregations)
    let salesByRegion = [];
    try {
      const regionQuery = {};
      if (sector) {
        regionQuery.sector = sector;
      }
      
      const sparkRegions = await SparkSalesByRegion.find(regionQuery)
        .sort({ revenue: -1 })
        .lean();
      
      salesByRegion = sparkRegions.map(region => ({
        _id: region.region,
        totalRevenue: region.revenue || 0,
        totalSales: region.salesCount || 0,
        avgSaleAmount: region.avgSaleAmount || 0
      }));
    } catch (sparkError) {
      console.error('[Analytics] Error reading Spark sales by region:', sparkError.message);
      // Return empty array if Spark data not available
    }

    res.json(salesByRegion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Sales by Company
exports.getSalesByCompany = async (req, res) => {
  try {
    const { startDate, endDate, region, sector } = req.query;
    
    // Try Spark first (fast path)
    try {
      if (sector) {
        // Use Spark Company Analytics grouped by company
        const sparkCompanies = await SparkCompanyAnalytics.find({ sector: sector })
          .sort({ revenue: -1 })
          .lean();
        
        if (sparkCompanies.length > 0) {
          const salesByCompany = sparkCompanies.map(comp => ({
            companyId: comp.companyId,
            totalRevenue: comp.revenue || 0,
            totalSales: comp.salesCount || 0,
            avgSaleAmount: comp.avgSaleAmount || 0,
            branchCount: 1 // Not available in Spark
          }));
          
          return res.json(salesByCompany);
        }
      }
    } catch (sparkError) {
      console.error('[Analytics] Error reading Spark sales by company:', sparkError.message);
      // Fallback to MongoDB
    }
    
    // Fallback to MongoDB aggregation
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }
    if (region) matchQuery.region = region;

    const salesByCompany = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$companyId',
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          avgSaleAmount: { $avg: '$totalAmount' },
          branches: { $addToSet: '$branchId' }
        }
      },
      {
        $project: {
          companyId: '$_id',
          totalRevenue: 1,
          totalSales: 1,
          avgSaleAmount: 1,
          branchCount: { $size: '$branches' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json(salesByCompany);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Sales Trends (by day, week, month)
// Note: Spark doesn't store time-series data, so we use MongoDB for trends
exports.getSalesTrends = async (req, res) => {
  try {
    const { startDate, endDate, period = 'day', companyId, region, sector } = req.query;
    
    // Note: Spark doesn't store time-series trends, so we use MongoDB
    // But we can optimize by checking if Spark has recent data first
    try {
      if (companyId && sector) {
        const sparkData = await SparkCompanyAnalytics.findOne({ 
          companyId: companyId,
          sector: sector 
        }).lean();
        
        // If Spark has data, we know there's recent activity, proceed with MongoDB aggregation
        // (Spark doesn't store time-series, so we still need MongoDB for trends)
      }
    } catch (sparkError) {
      // Continue with MongoDB
    }
    
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }
    if (companyId) matchQuery.companyId = companyId;
    if (region) matchQuery.region = region;
    if (sector) matchQuery.sector = sector;

    let dateFormat;
    switch (period) {
      case 'hour':
        dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$saleTime' } };
        break;
      case 'day':
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$saleTime' } };
        break;
      case 'week':
        dateFormat = { $dateToString: { format: '%Y-W%V', date: '$saleTime' } };
        break;
      case 'month':
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$saleTime' } };
        break;
      default:
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$saleTime' } };
    }

    const trends = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: dateFormat,
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          avgSaleAmount: { $avg: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Top Selling Products
exports.getTopSellingProducts = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10, companyId, region } = req.query;
    
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery['sale.saleTime'] = {};
      if (startDate) matchQuery['sale.saleTime'].$gte = new Date(startDate);
      if (endDate) matchQuery['sale.saleTime'].$lte = new Date(endDate);
    }

    // Try to read from Spark first (fast path)
    let topProducts = [];
    try {
      const { SparkCompanyTopProducts, SparkTopProducts } = require('../models/SparkMarketAnalytics');
      
      if (companyId) {
        // Use Query 4: Company Top Products
        const sparkProducts = await SparkCompanyTopProducts.find({ 
          companyId: companyId 
        }).sort({ totalRevenue: -1 }).limit(parseInt(limit)).lean();
        
        topProducts = sparkProducts.map(p => ({
          _id: p.productId,
          productName: p.productName || 'Unknown',
          brand: p.brand || null,
          totalQuantity: p.totalQuantity || 0,
          totalRevenue: p.totalRevenue || 0,
          totalSales: 0, // Not available in Spark
          avgPrice: p.avgPrice || 0
        }));
      } else {
        // Use Query 3: Market Top Products
        const sparkProducts = await SparkTopProducts.find({})
          .sort({ totalRevenue: -1 })
          .limit(parseInt(limit))
          .lean();
        
        topProducts = sparkProducts.map(p => ({
          _id: p.productId,
          productName: p.productName || 'Unknown',
          brand: p.brand || null,
          totalQuantity: p.totalQuantity || 0,
          totalRevenue: p.totalRevenue || 0,
          totalSales: 0, // Not available in Spark
          avgPrice: p.avgPrice || 0
        }));
      }
      
      if (topProducts.length > 0) {
        return res.json(topProducts);
      }
    } catch (sparkError) {
      console.error(`[Analytics] Error reading Spark top products: ${sparkError.message}`);
      // Fallback to MongoDB aggregation
    }
    
    // Fallback to MongoDB aggregation
    topProducts = await SaleItem.aggregate([
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: '$sale' },
      {
        $match: {
          ...matchQuery,
          ...(companyId && { 'sale.companyId': companyId }),
          ...(region && { 'sale.region': region })
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$product.productName' },
          brand: { $first: '$product.brand' },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$subtotal' },
          totalSales: { $sum: 1 },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Products by Brand
exports.getProductsByBrand = async (req, res) => {
  try {
    const { startDate, endDate, companyId, sector } = req.query;
    
    // Try Spark first (fast path)
    try {
      if (companyId && sector) {
        // Use Spark Company Brands
        const sparkBrands = await SparkCompanyBrands.find({ 
          companyId: companyId,
          sector: sector 
        })
          .sort({ revenue: -1 })
          .lean();
        
        if (sparkBrands.length > 0) {
          const productsByBrand = sparkBrands.map(brand => ({
            _id: brand.brand,
            totalQuantity: brand.quantity || 0,
            totalRevenue: brand.revenue || 0,
            totalSales: 0, // Not available in Spark
            avgPrice: brand.avgPrice || 0
          }));
          
          return res.json(productsByBrand);
        }
      } else if (sector) {
        // Use Spark Top Brands (Market)
        const sparkBrands = await SparkTopBrands.find({ sector: sector })
          .sort({ totalRevenue: -1 })
          .lean();
        
        if (sparkBrands.length > 0) {
          const productsByBrand = sparkBrands.map(brand => ({
            _id: brand.brand,
            totalQuantity: 0, // Not available in Spark
            totalRevenue: brand.totalRevenue || 0,
            totalSales: 0, // Not available in Spark
            avgPrice: 0 // Not available in Spark
          }));
          
          return res.json(productsByBrand);
        }
      }
    } catch (sparkError) {
      console.error('[Analytics] Error reading Spark products by brand:', sparkError.message);
      // Fallback to MongoDB
    }
    
    // Fallback to MongoDB aggregation
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery['sale.saleTime'] = {};
      if (startDate) matchQuery['sale.saleTime'].$gte = new Date(startDate);
      if (endDate) matchQuery['sale.saleTime'].$lte = new Date(endDate);
    }
    if (companyId) matchQuery['sale.companyId'] = companyId;

    const productsByBrand = await SaleItem.aggregate([
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: '$sale' },
      { $match: matchQuery },
      {
        $group: {
          _id: '$brand',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$subtotal' },
          totalSales: { $sum: 1 },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json(productsByBrand);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Products by Category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { startDate, endDate, companyId } = req.query;
    
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery['sale.saleTime'] = {};
      if (startDate) matchQuery['sale.saleTime'].$gte = new Date(startDate);
      if (endDate) matchQuery['sale.saleTime'].$lte = new Date(endDate);
    }
    if (companyId) matchQuery['sale.companyId'] = companyId;

    const productsByCategory = await SaleItem.aggregate([
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: '$sale' },
      { $match: matchQuery },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$categoryId',
          categoryName: { $first: '$category.categoryName' },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$subtotal' },
          totalSales: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json(productsByCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Employee Performance
exports.getEmployeePerformance = async (req, res) => {
  try {
    const { startDate, endDate, companyId, branchId, limit = 10 } = req.query;
    
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }
    if (companyId) matchQuery.companyId = companyId;
    if (branchId) matchQuery.branchId = branchId;

    // Try to read from Spark first (fast path)
    let employeePerformance = [];
    try {
      const { SparkCompanyEmployees } = require('../models/SparkMarketAnalytics');
      const query = { ...(companyId ? { companyId: companyId } : {}) };
      
      const sparkEmployees = await SparkCompanyEmployees.find(query)
        .sort({ revenue: -1 })
        .limit(Math.min(parseInt(limit) || 100, 100))
        .lean();
      
      employeePerformance = sparkEmployees.map(emp => ({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName || 'Unknown',
        position: 'N/A', // Not available in Spark
        totalRevenue: emp.revenue || 0,
        totalSales: emp.salesCount || 0,
        avgSaleAmount: emp.avgSaleAmount || 0,
        maxSaleAmount: emp.avgSaleAmount || 0 // Use avg as approximation
      }));
      
      if (employeePerformance.length > 0) {
        return res.json(employeePerformance);
      }
    } catch (sparkError) {
      console.error(`[Analytics] Error reading Spark employee performance: ${sparkError.message}`);
      // Fallback to MongoDB aggregation
    }
    
    // Fallback to MongoDB aggregation
    employeePerformance = await Sale.aggregate([
      { $match: { ...matchQuery, employeeId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$employeeId',
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          avgSaleAmount: { $avg: '$totalAmount' },
          maxSaleAmount: { $max: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'employees',
          let: { empId: '$_id', compId: companyId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$empId'] },
                    ...(companyId ? [{ $eq: ['$companyId', '$$compId'] }] : [])
                  ]
                }
              }
            }
          ],
          as: 'employee'
        }
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
          $project: {
            employeeId: '$_id',
            employeeName: { $ifNull: ['$employee.employeeName', 'Unknown'] },
            position: { $ifNull: ['$employee.position', 'N/A'] },
            totalRevenue: 1,
            totalSales: 1,
            avgSaleAmount: 1,
            maxSaleAmount: 1
          }
      },
      // Filter out employees that don't belong to this company (if companyId is provided)
      ...(companyId ? [{ $match: { 'employee.companyId': companyId } }] : []),
      { $sort: { totalRevenue: -1 } },
      { $limit: Math.min(parseInt(limit) || 100, 100) } // Max 100 employees
    ]);

    res.json(employeePerformance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Dashboard Data (All KPIs)
exports.getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate, companyId, branchId, region, sector } = req.query;
    
    // Try Spark first (fast path)
    try {
      if (companyId) {
        // Use Spark Company Analytics
        const query = { companyId: companyId };
        if (sector) query.sector = sector;
        
        const companySparkData = await SparkCompanyAnalytics.findOne(query).lean();
        const sparkRegions = await SparkSalesByRegion.find(sector ? { sector: sector } : {})
          .sort({ revenue: -1 })
          .limit(10)
          .lean();
        const sparkTopProducts = await SparkCompanyTopProducts.find({ companyId: companyId })
          .sort({ totalRevenue: -1 })
          .limit(10)
          .lean();
        const sparkEmployees = await SparkCompanyEmployees.find({ companyId: companyId })
          .sort({ revenue: -1 })
          .limit(10)
          .lean();
        
        if (companySparkData) {
          return res.json({
            summary: {
              totalRevenue: companySparkData.revenue || 0,
              totalSales: companySparkData.salesCount || 0,
              avgSaleAmount: companySparkData.avgSaleAmount || 0
            },
            salesByRegion: sparkRegions.map(r => ({
              _id: r.region,
              totalRevenue: r.revenue || 0,
              totalSales: r.salesCount || 0
            })),
            salesByCompany: [], // Not available in Spark for this endpoint
            topProducts: sparkTopProducts.map(p => ({
              _id: p.productId,
              productName: p.productName || 'Unknown',
              totalQuantity: p.totalQuantity || 0,
              totalRevenue: p.totalRevenue || 0
            })),
            employeePerformance: sparkEmployees.map(e => ({
              employeeName: e.employeeName || 'Unknown',
              totalRevenue: e.revenue || 0,
              totalSales: e.salesCount || 0,
              avgSaleAmount: e.avgSaleAmount || 0,
              maxSaleAmount: e.avgSaleAmount || 0
            }))
          });
        }
      }
    } catch (sparkError) {
      console.error('[Analytics] Error reading Spark dashboard data:', sparkError.message);
      // Fallback to MongoDB
    }
    
    // Fallback to MongoDB aggregation
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }
    if (companyId) matchQuery.companyId = companyId;
    if (branchId) matchQuery.branchId = branchId;
    if (region) matchQuery.region = region;

    // Get all data in parallel
    const [
      summary,
      salesByRegion,
      salesByCompany,
      topProducts,
      employeePerformance
    ] = await Promise.all([
      // Summary
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalSales: { $sum: 1 },
            avgSaleAmount: { $avg: '$totalAmount' }
          }
        }
      ]),
      // Sales by Region
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$region',
            totalRevenue: { $sum: '$totalAmount' },
            totalSales: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 }
      ]),
      // Sales by Company
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$companyId',
            totalRevenue: { $sum: '$totalAmount' },
            totalSales: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 }
      ]),
      // Top Products
      SaleItem.aggregate([
        {
          $lookup: {
            from: 'sales',
            localField: 'saleId',
            foreignField: '_id',
            as: 'sale'
          }
        },
        { $unwind: '$sale' },
        {
          $match: {
            ...matchQuery,
            'sale.saleTime': matchQuery.saleTime || {}
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: '$productId',
            productName: { $first: '$product.productName' },
            totalQuantity: { $sum: '$quantity' },
            totalRevenue: { $sum: '$subtotal' }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 }
      ]),
      // Employee Performance
      Sale.aggregate([
        { $match: { ...matchQuery, employeeId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$employeeId',
            totalRevenue: { $sum: '$totalAmount' },
            totalSales: { $sum: 1 },
            avgSaleAmount: { $avg: '$totalAmount' },
            maxSaleAmount: { $max: '$totalAmount' }
          }
        },
        {
          $lookup: {
            from: 'employees',
            let: { empId: '$_id', compId: matchQuery.companyId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$empId'] },
                      ...(matchQuery.companyId ? [{ $eq: ['$companyId', '$$compId'] }] : [])
                    ]
                  }
                }
              }
            ],
            as: 'employee'
          }
        },
        { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            employeeName: { $ifNull: ['$employee.employeeName', 'Unknown'] },
            position: { $ifNull: ['$employee.position', 'N/A'] },
            totalRevenue: 1,
            totalSales: 1,
            avgSaleAmount: { $ifNull: ['$avgSaleAmount', 0] },
            maxSaleAmount: { $ifNull: ['$maxSaleAmount', 0] }
          }
        },
        // Filter out employees that don't belong to this company (if companyId is provided)
        ...(matchQuery.companyId ? [{ $match: { 'employee.companyId': matchQuery.companyId } }] : []),
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      summary: summary[0] || {
        totalRevenue: 0,
        totalSales: 0,
        avgSaleAmount: 0
      },
      salesByRegion,
      salesByCompany,
      topProducts,
      employeePerformance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

