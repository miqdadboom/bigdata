const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const Product = require('../models/CRUD/Product');
const Employee = require('../models/CRUD/Employee');
const { SparkCompanyAnalytics, SparkMarketAnalytics } = require('../models/SparkMarketAnalytics');

/**
 * Problem Detection Controller
 */

// Helper: Build date range query
const buildDateQuery = (startDate, endDate) => {
  const query = {};
  if (startDate || endDate) {
    query.saleTime = {};
    if (startDate) query.saleTime.$gte = new Date(startDate);
    if (endDate) query.saleTime.$lte = new Date(endDate);
  }
  return query;
};

/**
 * Detect Problems for a Company
 * GET /api/analytics/problems/company/:companyId
 */
exports.detectCompanyProblems = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { companyId } = req.params;
    const { sector, startDate, endDate, comparePeriod } = req.query;
    
    const requestId = `${companyId}_${sector}_${Date.now()}`;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Problem Detection] START - Request ID: ${requestId}`);
    console.log(`[Problem Detection] Company: ${companyId}, Sector: ${sector}`);
    console.log(`[Problem Detection] Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);

    if (!sector) {
      return res.status(400).json({
        success: false,
        error: 'sector parameter is required'
      });
    }

    // Check if there's any sales data for this company
    const countStartTime = Date.now();
    const companySalesCount = await Sale.countDocuments({
      saleStatus: 'completed',
      sector: sector,
      companyId: companyId
    });
    const countDuration = Date.now() - countStartTime;
    console.log(`[Problem Detection] Step 1: Count sales - Duration: ${countDuration}ms, Count: ${companySalesCount}`);

    if (companySalesCount === 0) {
      console.log(`[Problem Detection] No sales data found for company: ${companyId}`);
      return res.json({
        success: true,
        message: 'No sales data available for analysis',
        problems: [],
        currentPeriod: null,
        marketAverage: null
      });
    }

    const dateQuery = buildDateQuery(startDate, endDate);
    // Only spread dateQuery if it has properties
    const baseMatch = {
      saleStatus: 'completed',
      sector: sector,
      companyId: companyId,
      ...(Object.keys(dateQuery).length > 0 ? dateQuery : {})
    };

    // Try to read from Spark first (fast path), fallback to MongoDB aggregation if needed

    // Try to read from Spark first (fast path)
    let current = null;
    let market = null;
    let marketAvg = 0;
    let revenueDiff = 0;
    
    try {
      // Read Company Analytics from Spark
      const sparkReadStartTime = Date.now();
      const companySparkData = await SparkCompanyAnalytics.findOne({ 
        companyId: companyId, 
        sector: sector 
      }).lean();
      const companySparkDuration = Date.now() - sparkReadStartTime;
      console.log(`[Problem Detection] Step 2a: Read Company Spark - Duration: ${companySparkDuration}ms`);
      
      // Read Market Analytics from Spark
      const marketSparkStartTime = Date.now();
      const marketSparkData = await SparkMarketAnalytics.findOne({ 
        sector: sector 
      }).lean();
      const marketSparkDuration = Date.now() - marketSparkStartTime;
      console.log(`[Problem Detection] Step 2b: Read Market Spark - Duration: ${marketSparkDuration}ms`);
      
      // SKIP RECENCY CHECK - Use Spark data if available (ignore updatedAt)
      // This improves performance by using Spark data even if slightly old
      const issues = [];
      
      if (!companySparkData) {
        issues.push('Company Analytics: NOT FOUND');
        console.log(`[Problem Detection] ERROR: Spark Company Analytics NOT FOUND for ${companyId}:${sector}`);
      } else {
        const companyAge = companySparkData.updatedAt ? (Date.now() - new Date(companySparkData.updatedAt).getTime()) : null;
        const companyAgeMinutes = companyAge ? Math.round(companyAge / 60000 * 100) / 100 : 'N/A';
        
        console.log(`[Problem Detection] SUCCESS: Spark Company Analytics found - revenue=${companySparkData.revenue || 0}, salesCount=${companySparkData.salesCount || 0}, age=${companyAgeMinutes}min`);
        
        if (!companySparkData.revenue || companySparkData.revenue === 0) {
          issues.push('Company Analytics: revenue is 0 or missing');
        }
      }
      
      if (!marketSparkData) {
        issues.push('Market Analytics: NOT FOUND');
        console.log(`[Problem Detection] ERROR: Spark Market Analytics NOT FOUND for sector: ${sector}`);
      } else {
        const marketAge = marketSparkData.updatedAt ? (Date.now() - new Date(marketSparkData.updatedAt).getTime()) : null;
        const marketAgeMinutes = marketAge ? Math.round(marketAge / 60000 * 100) / 100 : 'N/A';
        
        console.log(`[Problem Detection] SUCCESS: Spark Market Analytics found - revenue=${marketSparkData.marketRevenue || 0}, salesCount=${marketSparkData.marketSalesCount || 0}, companies=${marketSparkData.totalCompanies || 0}, age=${marketAgeMinutes}min`);
      }
      
      // Use Spark data only (no MongoDB fallback - for performance)
      if (companySparkData && marketSparkData) {
        // Use Spark data (fast path)
        current = {
          revenue: companySparkData.revenue || 0,
          salesCount: companySparkData.salesCount || 0,
          avgSaleAmount: companySparkData.avgSaleAmount || 0
        };
        
        market = {
          revenue: marketSparkData.marketRevenue || 0,
          salesCount: marketSparkData.marketSalesCount || 0,
          avgSaleAmount: marketSparkData.marketAvgSale || 0,
          companiesCount: marketSparkData.totalCompanies || 1
        };
        
        marketAvg = market.companiesCount > 0 ? market.revenue / market.companiesCount : 0;
        revenueDiff = marketAvg > 0 ? ((current.revenue - marketAvg) / marketAvg) * 100 : 0;
      } else {
        // No Spark data available - return default values
        if (issues.length > 0) {
          console.log(`[Problem Detection] WARNING: Spark data issues: ${issues.join('; ')}`);
        }
        console.log(`[Problem Detection] WARNING: No Spark data available for ${companyId}:${sector} - using default values`);
        
        current = { revenue: 0, salesCount: 0, avgSaleAmount: 0 };
        market = { revenue: 0, salesCount: 0, avgSaleAmount: 0, companiesCount: 1 };
        marketAvg = 0;
        revenueDiff = 0;
      }
    } catch (sparkError) {
      // Error reading from Spark - return default values (no MongoDB fallback)
      console.error(`[Problem Detection] Error reading Spark data: ${sparkError.message}`);
      
      current = { revenue: 0, salesCount: 0, avgSaleAmount: 0 };
      market = { revenue: 0, salesCount: 0, avgSaleAmount: 0, companiesCount: 1 };
      marketAvg = 0;
      revenueDiff = 0;
    }

    // Get additional data for smarter recommendations - Optimized with $match in $lookup
    const saleMatchForRecommendations = {
      companyId: companyId,
      sector: sector,
      saleStatus: 'completed',
      ...(Object.keys(dateQuery).length > 0 ? dateQuery : {})
    };
    
    // Step 4: Recommendations - DISABLED for performance (these aggregations are too slow)
    // Top Products and Top Brands aggregations take 150+ seconds - disabled to improve performance
    const recommendationsStartTime = Date.now();
    const [topProducts, topBrands, employeeStats] = await Promise.all([
      // Top Products - DISABLED (too slow - 155+ seconds)
      Promise.resolve([]),
      // Top Brands - DISABLED (too slow - 134+ seconds)
      Promise.resolve([]),
      // Employee Performance - Keep this one (fast - 35ms)
      (async () => {
        const startTime = Date.now();
        const result = await Sale.aggregate([
        { $match: { ...baseMatch, employeeId: { $exists: true, $ne: null }}},
        { $group: {
          _id: '$employeeId',
          salesCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }},
        { $group: {
          _id: null,
          avgSalesPerEmployee: { $avg: '$salesCount' },
          totalEmployees: { $sum: 1 }
        }}
      ]).allowDiskUse(true);
        const duration = Date.now() - startTime;
        console.log(`[Problem Detection] Step 4c: Employee Stats Aggregation - Duration: ${duration}ms`);
        return result;
      })()
    ]);
    const recommendationsDuration = Date.now() - recommendationsStartTime;
    console.log(`[Problem Detection] Step 4: Recommendations (Top Products/Brands DISABLED) - Total Duration: ${recommendationsDuration}ms`);

    const topProductNames = topProducts.map(p => p.productName || 'Unknown').filter(Boolean).slice(0, 3);
    const topBrandNames = topBrands.map(b => b._id || 'Unknown').filter(Boolean).slice(0, 3);
    const avgSalesPerEmployee = employeeStats[0]?.avgSalesPerEmployee || 0;
    const totalEmployees = employeeStats[0]?.totalEmployees || 0;

    // Detect Problems with smart recommendations
    const problems = [];

    // Problem 1: Low Revenue vs Market - Simple comparison: if company revenue < market revenue, show problem
    if (current.revenue > 0 && marketAvg > 0 && current.revenue < marketAvg) {
      // Determine severity based on percentage difference
      const absDiff = Math.abs(revenueDiff);
      const severity = absDiff >= 20 ? 'high' : absDiff >= 10 ? 'medium' : 'low';
      
      const recommendation = topProductNames.length > 0
        ? `Focus on promoting top products: ${topProductNames.join(', ')}. Consider increasing inventory for these high-performing items and running targeted promotions.`
        : topBrandNames.length > 0
        ? `Focus on top brands: ${topBrandNames.join(', ')}. Increase marketing for these brands and ensure adequate stock levels.`
        : 'Investigate pricing strategy, product mix, and marketing campaigns. Compare with top-performing companies in your sector.';
      
      problems.push({
        type: 'low_revenue',
        severity: severity,
        description: `Revenue is ${Math.abs(revenueDiff).toFixed(1)}% below market average ($${current.revenue.toLocaleString()} vs $${marketAvg.toLocaleString()})`,
        impact: severity,
        recommendation: recommendation,
        metrics: {
          currentRevenue: current.revenue,
          marketAverage: marketAvg,
          difference: Math.abs(revenueDiff).toFixed(1) + '%'
        }
      });
    }

    // Problem 2: Low Average Sale Amount
    const avgSaleDiff = market.avgSaleAmount > 0 
      ? ((1 - current.avgSaleAmount / market.avgSaleAmount) * 100)
      : 0;
    
    if (current.avgSaleAmount < market.avgSaleAmount * 0.8) {
      const recommendation = `Your average sale is $${current.avgSaleAmount.toFixed(2)} compared to market average of $${market.avgSaleAmount.toFixed(2)}. ` +
        (topProductNames.length > 0
          ? `Focus on upselling top products: ${topProductNames.join(', ')}. Create product bundles and train staff on cross-selling techniques.`
          : 'Consider upselling strategies, product bundling, and training staff on value-added selling.');
      
      problems.push({
        type: 'low_avg_sale',
        severity: 'medium',
        description: `Average sale amount is ${avgSaleDiff.toFixed(1)}% lower than market ($${current.avgSaleAmount.toFixed(2)} vs $${market.avgSaleAmount.toFixed(2)})`,
        impact: 'medium',
        recommendation: recommendation,
        metrics: {
          currentAvgSale: current.avgSaleAmount,
          marketAvgSale: market.avgSaleAmount,
          difference: avgSaleDiff.toFixed(1) + '%'
        }
      });
    }

    // Problem 3: Low Sales Count
    const salesCountDiff = market.salesCount > 0 
      ? ((current.salesCount - (market.salesCount / market.companiesCount)) / (market.salesCount / market.companiesCount)) * 100
      : 0;
    
    if (salesCountDiff < -20) {
      const marketAvgSalesCount = market.salesCount / market.companiesCount;
      const recommendation = `You have ${current.salesCount} sales vs market average of ${Math.round(marketAvgSalesCount)}. ` +
        (totalEmployees > 0 && avgSalesPerEmployee > 0
          ? `Your employees average ${avgSalesPerEmployee.toFixed(1)} sales each. Consider employee training, performance incentives, or increasing staff during peak hours.`
          : 'Investigate customer acquisition strategies, improve store visibility, review opening hours, and analyze foot traffic patterns.');
      
      problems.push({
        type: 'low_sales_count',
        severity: 'high',
        description: `Sales count is ${Math.abs(salesCountDiff).toFixed(1)}% below market average (${current.salesCount} vs ${Math.round(marketAvgSalesCount)})`,
        impact: 'high',
        recommendation: recommendation,
        metrics: {
          currentSalesCount: current.salesCount,
          marketAverage: Math.round(marketAvgSalesCount),
          difference: Math.abs(salesCountDiff).toFixed(1) + '%',
          avgSalesPerEmployee: avgSalesPerEmployee.toFixed(1),
          totalEmployees: totalEmployees
        }
      });
    }

    res.json({
      success: true,
      companyId: companyId,
      sector: sector,
      currentPeriod: {
        revenue: current.revenue,
        salesCount: current.salesCount,
        avgSaleAmount: current.avgSaleAmount
      },
      marketAverage: {
        revenue: marketAvg,
        salesCount: Math.round(market.salesCount / market.companiesCount),
        avgSaleAmount: market.avgSaleAmount
      },
      problems: problems,
      problemsCount: problems.length,
      overallStatus: problems.length === 0 ? 'healthy' : problems.some(p => p.severity === 'high') ? 'critical' : 'warning'
    });
    
    const totalDuration = Date.now() - startTime;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Problem Detection] COMPLETE - Request ID: ${requestId}`);
    console.log(`[Problem Detection] TOTAL DURATION: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    console.log(`[Problem Detection] Problems found: ${problems.length}`);
    console.log(`${'='.repeat(80)}\n`);
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`\n${'='.repeat(80)}`);
    console.error(`[Problem Detection] ERROR - Request ID: ${requestId}`);
    console.error(`[Problem Detection] FAILED AFTER: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    console.error(`[Problem Detection] Error: ${error.message}`);
    console.error(`[Problem Detection] Stack: ${error.stack}`);
    console.error(`${'='.repeat(80)}\n`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Detect Problems by Region
 * GET /api/analytics/problems/region/:region
 */
exports.detectRegionProblems = async (req, res) => {
  try {
    const { region } = req.params;
    const { sector, startDate, endDate } = req.query;

    if (!sector) {
      return res.status(400).json({
        success: false,
        error: 'sector parameter is required'
      });
    }

    const dateQuery = buildDateQuery(startDate, endDate);
    const baseMatch = {
      saleStatus: 'completed',
      sector: sector,
      region: region,
      ...dateQuery
    };

    // Region Data
    const regionData = await Sale.aggregate([
      { $match: baseMatch },
      { $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        salesCount: { $sum: 1 },
        avgSaleAmount: { $avg: '$totalAmount' },
        companiesCount: { $addToSet: '$companyId' }
      }},
      { $project: {
        revenue: 1,
        salesCount: 1,
        avgSaleAmount: 1,
        companiesCount: { $size: '$companiesCount' },
        _id: 0
      }}
    ]);

    // Market Data (All regions)
    const marketData = await Sale.aggregate([
      { $match: { ...baseMatch, region: { $ne: region }}},
      { $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        salesCount: { $sum: 1 },
        avgSaleAmount: { $avg: '$totalAmount' },
        regionsCount: { $addToSet: '$region' }
      }},
      { $project: {
        revenue: 1,
        salesCount: 1,
        avgSaleAmount: 1,
        regionsCount: { $size: '$regionsCount' },
        _id: 0
      }}
    ]);

    const regionStats = regionData[0] || { revenue: 0, salesCount: 0, avgSaleAmount: 0, companiesCount: 0 };
    const market = marketData[0] || { revenue: 0, salesCount: 0, avgSaleAmount: 0, regionsCount: 1 };

    const marketAvgRevenue = market.regionsCount > 0 ? market.revenue / market.regionsCount : 0;
    const revenueDiff = marketAvgRevenue > 0 
      ? ((regionStats.revenue - marketAvgRevenue) / marketAvgRevenue) * 100 
      : 0;

    const problems = [];

    if (revenueDiff < -20) {
      problems.push({
        type: 'low_region_performance',
        severity: 'high',
        description: `Region revenue is ${Math.abs(revenueDiff).toFixed(1)}% below market average`,
        impact: 'high',
        recommendation: 'Investigate regional market conditions, competition, or economic factors'
      });
    }

    res.json({
      success: true,
      region: region,
      sector: sector,
      regionStats: {
        revenue: regionStats.revenue,
        salesCount: regionStats.salesCount,
        avgSaleAmount: regionStats.avgSaleAmount,
        companiesCount: regionStats.companiesCount
      },
      marketAverage: {
        revenue: marketAvgRevenue,
        salesCount: Math.round(market.salesCount / market.regionsCount),
        avgSaleAmount: market.avgSaleAmount
      },
      problems: problems
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

