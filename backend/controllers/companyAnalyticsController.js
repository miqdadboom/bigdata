const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const { SparkCompanyAnalytics, SparkCompanyEmployees, SparkCompanyTopProducts, SparkSalesByRegion } = require('../models/SparkMarketAnalytics');

// Get Company Analytics (Dashboard - Lightweight)
exports.getCompanyAnalytics = async (req, res) => {
  const startTime = Date.now();
  try {
    // Get companyId from URL params first, then from query
    const companyId = req.params.companyId || req.query.companyId;
    const { startDate, endDate, sector } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    // Read from Spark collections (fast path - no aggregations)
    // Summary from spark_company_analytics
    let summary = { totalRevenue: 0, totalSales: 0, avgSaleAmount: 0 };
    try {
      const query = { companyId: companyId };
      if (sector) {
        query.sector = sector;
      }
      
      const companySparkData = await SparkCompanyAnalytics.findOne(query).lean();
      
      if (companySparkData) {
        summary = {
          totalRevenue: companySparkData.revenue || 0,
          totalSales: companySparkData.salesCount || 0,
          avgSaleAmount: companySparkData.avgSaleAmount || 0
        };
      }
    } catch (sparkError) {
      console.error('[Company Analytics] Error reading Spark company analytics:', sparkError.message);
      // Continue with default values
    }

    // Sales by Region from spark_sales_by_region (filtered by company's sector if provided)
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
        totalSales: region.salesCount || 0
      }));
    } catch (sparkError) {
      console.error('[Company Analytics] Error reading Spark sales by region:', sparkError.message);
      // Continue with empty array
    }

    const duration = Date.now() - startTime;
    console.log(`[Company Analytics] SUCCESS: Response in ${duration}ms - Company: ${companyId}, Sector: ${sector || 'any'}`);

    res.json({
      summary,
      salesByRegion
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Company Analytics] ERROR: Error after ${duration}ms:`, error.message);
    console.error('[Company Analytics] Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get Company Detailed Analytics (for Problem Analysis page - includes Top Products and Employee Performance)
exports.getCompanyDetailedAnalytics = async (req, res) => {
  const startTime = Date.now();
  const requestId = `detailed_${req.params.companyId || req.query.companyId}_${Date.now()}`;
  
  try {
    const companyId = req.params.companyId || req.query.companyId;
    const { startDate, endDate } = req.query;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Company Detailed Analytics]  START - Request ID: ${requestId}`);
    console.log(`[Company Detailed Analytics] Company: ${companyId}`);
    console.log(`[Company Detailed Analytics] Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const matchQuery = { companyId };
    if (startDate || endDate) {
      matchQuery.saleTime = {};
      if (startDate) matchQuery.saleTime.$gte = new Date(startDate);
      if (endDate) matchQuery.saleTime.$lte = new Date(endDate);
    }

    // Use Spark data for Employee Performance (fast path)
    let employeePerformance = [];
    const employeeStartTime = Date.now();
    try {
      const sparkEmployees = await SparkCompanyEmployees.find({ 
        companyId: companyId 
      }).sort({ revenue: -1 }).limit(50).lean();
      
      if (sparkEmployees && sparkEmployees.length > 0) {
        employeePerformance = sparkEmployees.map(emp => ({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName || `Employee ${emp.employeeId?.slice(-4) || 'Unknown'}`,
          position: 'N/A', // Spark doesn't store position
          totalRevenue: emp.revenue || 0,
          totalSales: emp.salesCount || 0,
          avgSaleAmount: emp.avgSaleAmount || 0,
          maxSaleAmount: emp.avgSaleAmount || 0 // Spark doesn't store max, use avg as approximation
        }));
        const employeeDuration = Date.now() - employeeStartTime;
        console.log(`[Company Detailed Analytics]   Employee Performance (Spark) - Duration: ${employeeDuration}ms, Found: ${employeePerformance.length}`);
      } else {
        // Fallback to MongoDB aggregation if Spark data not available
        console.log(`[Company Detailed Analytics] WARNING:  No Spark employee data, using MongoDB aggregation`);
        const employeeAggStartTime = Date.now();
        employeePerformance = await Sale.aggregate([
          { $match: { ...matchQuery, employeeId: { $exists: true, $ne: null } } },
          {
            $lookup: {
              from: 'employees',
              let: { empId: '$employeeId', compId: companyId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$_id', '$$empId'] },
                        { $eq: ['$companyId', '$$compId'] }
                      ]
                    }
                  }
                }
              ],
              as: 'employee'
            }
          },
          { $unwind: { path: '$employee', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: '$employeeId',
              employeeName: { $first: '$employee.employeeName' },
              position: { $first: '$employee.position' },
              totalRevenue: { $sum: '$totalAmount' },
              totalSales: { $sum: 1 },
              avgSaleAmount: { $avg: '$totalAmount' },
              maxSaleAmount: { $max: '$totalAmount' }
            }
          },
          {
            $project: {
              employeeId: '$_id',
              employeeName: { $ifNull: ['$employeeName', 'Unknown'] },
              position: { $ifNull: ['$position', 'N/A'] },
              totalRevenue: 1,
              totalSales: 1,
              avgSaleAmount: 1,
              maxSaleAmount: 1
            }
          },
          { $sort: { totalRevenue: -1 } },
          { $limit: 50 }
        ]).allowDiskUse(true);
        const employeeAggDuration = Date.now() - employeeAggStartTime;
        console.log(`[Company Detailed Analytics]   Employee Performance (MongoDB) - Duration: ${employeeAggDuration}ms, Found: ${employeePerformance.length}`);
      }
    } catch (employeeError) {
      console.error(`[Company Detailed Analytics] ERROR: Employee Performance Error: ${employeeError.message}`);
      employeePerformance = [];
    }

    // Top Products - Read from Spark (fast path)
    let topProducts = [];
    const topProductsStartTime = Date.now();
    try {
      const sparkProducts = await SparkCompanyTopProducts.find({ 
        companyId: companyId 
      }).sort({ totalRevenue: -1 }).limit(15).lean();
      
      if (sparkProducts && sparkProducts.length > 0) {
        topProducts = sparkProducts.map(p => ({
          _id: p.productId,
          productName: p.productName || 'Unknown',
          brand: p.brand || null,
          totalQuantity: p.totalQuantity || 0,
          totalRevenue: p.totalRevenue || 0,
          avgPrice: p.avgPrice || 0
        }));
        const topProductsDuration = Date.now() - topProductsStartTime;
        console.log(`[Company Detailed Analytics]   Top Products (Spark) - Duration: ${topProductsDuration}ms, Found: ${topProducts.length}`);
      } else {
        // Fallback to MongoDB aggregation if Spark data not available
        console.log(`[Company Detailed Analytics] WARNING:  No Spark top products data, using MongoDB aggregation`);
        const topProductsAggStartTime = Date.now();
        topProducts = await SaleItem.aggregate([
          // First, get saleIds that match our criteria (early filtering)
          {
            $lookup: {
              from: 'sales',
              let: { saleId: '$saleId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$_id', '$$saleId'] },
                    ...matchQuery
                  }
                },
                { $project: { _id: 1 } }
              ],
              as: 'sale'
            }
          },
          { $match: { 'sale.0': { $exists: true } }}, // Only items with matching sales
          { $unwind: '$sale' },
          // Then lookup product details
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              as: 'product'
            }
          },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$productId',
              productName: { $first: '$product.productName' },
              brand: { $first: '$product.brand' },
              totalQuantity: { $sum: '$quantity' },
              totalRevenue: { $sum: '$subtotal' },
              avgPrice: { $avg: '$price' }
            }
          },
          { $sort: { totalRevenue: -1 } },
          { $limit: 15 }
        ]).allowDiskUse(true);
        const topProductsAggDuration = Date.now() - topProductsAggStartTime;
        console.log(`[Company Detailed Analytics]   Top Products (MongoDB) - Duration: ${topProductsAggDuration}ms, Found: ${topProducts.length}`);
      }
    } catch (topProductsError) {
      console.error(`[Company Detailed Analytics] ERROR: Top Products Error: ${topProductsError.message}`);
      // Fallback to MongoDB aggregation
      const topProductsAggStartTime = Date.now();
      topProducts = await SaleItem.aggregate([
        {
          $lookup: {
            from: 'sales',
            let: { saleId: '$saleId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$saleId'] },
                  ...matchQuery
                }
              },
              { $project: { _id: 1 } }
            ],
            as: 'sale'
          }
        },
        { $match: { 'sale.0': { $exists: true } }},
        { $unwind: '$sale' },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$productId',
            productName: { $first: '$product.productName' },
            brand: { $first: '$product.brand' },
            totalQuantity: { $sum: '$quantity' },
            totalRevenue: { $sum: '$subtotal' },
            avgPrice: { $avg: '$price' }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 15 }
      ]).allowDiskUse(true);
      const topProductsAggDuration = Date.now() - topProductsAggStartTime;
      console.log(`[Company Detailed Analytics]   Top Products (MongoDB Fallback) - Duration: ${topProductsAggDuration}ms, Found: ${topProducts.length}`);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Company Detailed Analytics] SUCCESS: COMPLETE - Request ID: ${requestId}`);
    console.log(`[Company Detailed Analytics]   TOTAL DURATION: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`${'='.repeat(80)}\n`);

    res.json({
      topProducts,
      employeePerformance
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[Company Detailed Analytics] ERROR: ERROR after ${totalDuration}ms:`, error.message);
    console.error('[Company Detailed Analytics] Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
