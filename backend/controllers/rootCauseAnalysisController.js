const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const Product = require('../models/CRUD/Product');
const Employee = require('../models/CRUD/Employee');
const { SparkTopProducts, SparkTopBrands, SparkEmployeePerformance, SparkCompanyAnalytics, SparkMarketAnalytics, SparkCompanyBrands, SparkCompanyEmployees } = require('../models/SparkMarketAnalytics');

/**
 * Root Cause Analysis Controller
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
 * Analyze Root Causes for Company Problems
 * GET /api/analytics/root-cause/company/:companyId
 */
exports.analyzeCompanyRootCause = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { companyId } = req.params;
    const { sector, startDate, endDate } = req.query;
    
    const requestId = `${companyId}_${sector}_${Date.now()}`;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Root Cause Analysis] START - Request ID: ${requestId}`);
    console.log(`[Root Cause Analysis] Company: ${companyId}, Sector: ${sector}`);
    console.log(`[Root Cause Analysis] Timestamp: ${new Date().toISOString()}`);
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
    console.log(`[Root Cause Analysis]   Step 1: Count sales - Duration: ${countDuration}ms, Count: ${companySalesCount}`);

    if (companySalesCount === 0) {
      return res.json({
        success: true,
        message: 'No sales data available for analysis',
        rootCauses: [],
        analysis: null
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

    // Market Data for Comparison
    const marketMatch = {
      saleStatus: 'completed',
      sector: sector,
      companyId: { $ne: companyId },
      ...(Object.keys(dateQuery).length > 0 ? dateQuery : {})
    };

    // Only log once when starting (reduce noise)
    console.log(`[Root Cause Analysis] Company: ${companyId}, Sector: ${sector}, Sales: ${companySalesCount}`);

    // Helper: Build market match for use after $unwind: '$sale'
    const buildMarketMatchAfterUnwind = () => {
      const match = {
        'sale.saleStatus': 'completed',
        'sale.sector': sector,
        'sale.companyId': { $ne: companyId }
      };
      if (dateQuery.saleTime) {
        match['sale.saleTime'] = dateQuery.saleTime;
      }
      return match;
    };

    // Build sale match queries (used in multiple places)
    const saleMatchForCompany = {
      companyId: companyId,
      saleStatus: 'completed',
      sector: sector,
      ...(dateQuery.saleTime ? dateQuery : {})
    };
    const saleMatchForMarket = {
      saleStatus: 'completed',
      sector: sector,
      companyId: { $ne: companyId },
      ...(dateQuery.saleTime ? dateQuery : {})
    };

    // Brand Analysis - Try Spark first, fallback to MongoDB
    let companyBrands = [];
    let marketBrands = [];
    
    const brandAnalysisStartTime = Date.now();
    try {
      // Try to read from Spark first (fast path)
      // Note: Spark saves top 5 brands per company+sector (sector is important for comparison)
      const companyBrandsStartTime = Date.now();
      const companyBrandsSpark = await SparkCompanyBrands.find({ 
        companyId: companyId,
        sector: sector  // Sector is important - comparison is per sector
      }).sort({ revenue: -1 }).limit(5).lean();  // Top 5 per company+sector
      const companyBrandsDuration = Date.now() - companyBrandsStartTime;
      console.log(`[Root Cause Analysis]   Step 2a: Read Company Brands from Spark - Duration: ${companyBrandsDuration}ms, Found: ${companyBrandsSpark.length}`);
      
      const marketBrandsStartTime = Date.now();
      const marketBrandsSpark = await SparkTopBrands.find({ 
        sector: sector 
      }).sort({ totalRevenue: -1 }).limit(10).lean();
      const marketBrandsDuration = Date.now() - marketBrandsStartTime;
      console.log(`[Root Cause Analysis]   Step 2b: Read Market Brands from Spark - Duration: ${marketBrandsDuration}ms, Found: ${marketBrandsSpark.length}`);
      
      // SKIP RECENCY CHECK - Use Spark data if available (ignore updatedAt)
      // Accept partial data - use what's available
      if (companyBrandsSpark.length > 0) {
        companyBrands = companyBrandsSpark.map(b => ({
          _id: b.brand,
          revenue: b.revenue || 0,
          quantity: b.quantity || 0,
          avgPrice: b.avgPrice || null
        }));
        console.log(`[Root Cause Analysis] SUCCESS: Using Spark company brands data: ${companyId}:${sector} (${companyBrands.length} brands)`);
      } else {
        console.log(`[Root Cause Analysis] WARNING:  No Spark company brands data for ${companyId}:${sector}`);
        companyBrands = [];
      }
      
      if (marketBrandsSpark.length > 0) {
        marketBrands = marketBrandsSpark.map(b => ({
          _id: b.brand,
          revenue: b.totalRevenue || 0,
          quantity: 0, // Market brands don't have quantity in Spark
          avgPrice: null
        }));
        console.log(`[Root Cause Analysis] SUCCESS: Using Spark market brands data: ${sector} (${marketBrands.length} brands)`);
      } else {
        console.log(`[Root Cause Analysis] WARNING:  No Spark market brands data for ${sector}`);
        marketBrands = [];
      }
      
      // Use whatever data is available (even if one is empty)
      // This allows analysis to continue with partial data
      const brandAnalysisDuration = Date.now() - brandAnalysisStartTime;
      console.log(`[Root Cause Analysis]   Step 2: Brand Analysis Complete - Total Duration: ${brandAnalysisDuration}ms`);
    } catch (sparkError) {
      const brandAnalysisDuration = Date.now() - brandAnalysisStartTime;
      console.log(`[Root Cause Analysis] WARNING:  Step 2: Error reading Spark brand data after ${brandAnalysisDuration}ms: ${sparkError.message} - returning empty arrays`);
      companyBrands = [];
      marketBrands = [];
    }

    // Removed verbose logging - only log if there's an issue

    // Product Quality/Type Analysis - DISABLED for performance
    // These aggregations are too slow - return empty arrays
    const companyProducts = [];
    const marketProducts = [];

    // Price Analysis - DISABLED for performance
    // Will be set later after current and market are defined (see below)

    // Removed verbose logging - only log if there's an issue

    // Employee Performance Analysis - Try Spark first, fallback to MongoDB
    let companyEmployees = [];
    let marketEmployees = [];
    
    // Helper function to clean employee names
    const cleanEmployeeName = (name, employeeId) => {
      if (!name || name.trim() === '') {
        // If name is null/empty, use employeeId as fallback
        return employeeId ? `Employee ${employeeId.toString().slice(-4)}` : 'Unknown Employee';
      }
      let cleanName = name.toString().trim();
      
      // Remove company name suffix
      if (cleanName.includes(' - ')) {
        const parts = cleanName.split(' - ');
        if (parts.length > 1 && (parts[1].includes('شركة') || parts[1].includes('Company'))) {
          cleanName = parts[0].trim();
        }
      }
      cleanName = cleanName.replace(/\s*-\s*شركة.*$/i, '').replace(/\s*-\s*Company.*$/i, '').trim();
      
      // If after cleaning it's still empty or looks like an ID, use employeeId
      if (!cleanName || cleanName.length < 3 || /^[0-9a-f]{4,}$/i.test(cleanName)) {
        return employeeId ? `Employee ${employeeId.toString().slice(-4)}` : 'Unknown Employee';
      }
      
      return cleanName;
    };
    
    try {
      const employeeAnalysisStartTime = Date.now();
      // Try to read from Spark first (fast path)
      // Note: Spark saves ALL employees per company (aggregated across sectors)
      // So we search by companyId only (not by sector)
      const companyEmployeesStartTime = Date.now();
      const companyEmployeesSpark = await SparkCompanyEmployees.find({ 
        companyId: companyId  // No sector filter - get all employees for this company
      }).sort({ revenue: -1 }).limit(10).lean();  // Limit to top 10 for display
      const companyEmployeesDuration = Date.now() - companyEmployeesStartTime;
      console.log(`[Root Cause Analysis]   Step 3a: Read Company Employees from Spark - Duration: ${companyEmployeesDuration}ms, Found: ${companyEmployeesSpark.length}`);
      
      const marketEmployeesStartTime = Date.now();
      const marketEmployeesSpark = await SparkEmployeePerformance.findOne({ 
        sector: sector 
      }).lean();
      const marketEmployeesDuration = Date.now() - marketEmployeesStartTime;
      console.log(`[Root Cause Analysis]   Step 3b: Read Market Employees from Spark - Duration: ${marketEmployeesDuration}ms`);
      
      // Get market data for revenue calculation
      const marketSparkDataStartTime = Date.now();
      const marketSparkData = await SparkMarketAnalytics.findOne({ sector: sector }).lean();
      const marketSparkDataDuration = Date.now() - marketSparkDataStartTime;
      console.log(`[Root Cause Analysis]   Step 3c: Read Market Analytics from Spark - Duration: ${marketSparkDataDuration}ms`);
      
      // Check if Spark data is recent (within last 3 minutes)
      // SKIP RECENCY CHECK - Use Spark data if available (ignore updatedAt)
      const hasCompanyEmployees = companyEmployeesSpark.length > 0;
      const hasMarketEmployees = marketEmployeesSpark != null;
      const hasMarketData = marketSparkData != null;
      
      if (hasCompanyEmployees && hasMarketEmployees && hasMarketData) {
        // Use Spark data (fast path)
        companyEmployees = companyEmployeesSpark.map(emp => ({
          _id: emp.employeeId,
          employeeName: cleanEmployeeName(emp.employeeName, emp.employeeId),
          salesCount: emp.salesCount || 0,
          revenue: emp.revenue || 0,
          avgSaleAmount: emp.avgSaleAmount || 0
        }));
        
        // Calculate market averages from Spark data
        const avgSalesPerEmployee = marketEmployeesSpark.totalEmployees > 0 
          ? marketEmployeesSpark.totalSales / marketEmployeesSpark.totalEmployees 
          : 0;
        // avgRevenuePerEmployee = total market revenue / total employees
        const avgRevenuePerEmployee = marketEmployeesSpark.totalEmployees > 0 && marketSparkData.marketRevenue
          ? marketSparkData.marketRevenue / marketEmployeesSpark.totalEmployees
          : 0;
        
        marketEmployees = [{
          _id: null,
          avgSalesPerEmployee: avgSalesPerEmployee,
          avgRevenuePerEmployee: avgRevenuePerEmployee
        }];
        console.log(`[Root Cause Analysis] Using Spark data for Employee Performance: ${companyId}:${sector}`);
      } else {
        // No Spark data available - return empty arrays
        console.log(`[Root Cause Analysis] WARNING:  No Spark employee data available for ${companyId}:${sector} - returning empty arrays`);
        companyEmployees = [];
        marketEmployees = [];
      }
    } catch (sparkError) {
      console.log(`[Root Cause Analysis] WARNING:  Error reading Spark employee data: ${sparkError.message} - returning empty arrays`);
      companyEmployees = [];
      marketEmployees = [];
    }

    // Removed verbose logging - only log if there's an issue

    // First, check if there's a revenue problem (same logic as Problem Detection)
    // Try to read from Spark first (fast path)
    let current = null;
    let market = null;
    let marketAvg = 0;
    let revenueDiff = 0;
    
    try {
      const analyticsStartTime = Date.now();
      // Read Company Analytics from Spark
      const companySparkStartTime = Date.now();
      const companySparkData = await SparkCompanyAnalytics.findOne({ 
        companyId: companyId, 
        sector: sector 
      }).lean();
      const companySparkDuration = Date.now() - companySparkStartTime;
      console.log(`[Root Cause Analysis]   Step 4a: Read Company Analytics from Spark - Duration: ${companySparkDuration}ms`);
      
      // Read Market Analytics from Spark
      const marketSparkStartTime = Date.now();
      const marketSparkData = await SparkMarketAnalytics.findOne({ 
        sector: sector 
      }).lean();
      const marketSparkDuration = Date.now() - marketSparkStartTime;
      console.log(`[Root Cause Analysis]   Step 4b: Read Market Analytics from Spark - Duration: ${marketSparkDuration}ms`);
      
      // Detailed logging to identify missing data
      const issues = [];
      
      if (!companySparkData) {
        issues.push('Company Analytics: NOT FOUND');
        console.log(`[Root Cause Analysis] ERROR: Spark Company Analytics NOT FOUND for ${companyId}:${sector}`);
      } else {
        const companyAge = companySparkData.updatedAt ? (Date.now() - new Date(companySparkData.updatedAt).getTime()) : null;
        const companyAgeMinutes = companyAge ? Math.round(companyAge / 60000 * 100) / 100 : 'N/A';
        
        console.log(`[Root Cause Analysis] SUCCESS: Spark Company Analytics found - revenue=${companySparkData.revenue || 0}, salesCount=${companySparkData.salesCount || 0}, age=${companyAgeMinutes}min`);
        
        if (!companySparkData.revenue || companySparkData.revenue === 0) {
          issues.push('Company Analytics: revenue is 0 or missing');
        }
      }
      
      if (!marketSparkData) {
        issues.push('Market Analytics: NOT FOUND');
        console.log(`[Root Cause Analysis] ERROR: Spark Market Analytics NOT FOUND for sector: ${sector}`);
      } else {
        const marketAge = marketSparkData.updatedAt ? (Date.now() - new Date(marketSparkData.updatedAt).getTime()) : null;
        const marketAgeMinutes = marketAge ? Math.round(marketAge / 60000 * 100) / 100 : 'N/A';
        
        console.log(`[Root Cause Analysis] SUCCESS: Spark Market Analytics found - revenue=${marketSparkData.marketRevenue || 0}, salesCount=${marketSparkData.marketSalesCount || 0}, companies=${marketSparkData.totalCompanies || 0}, age=${marketAgeMinutes}min`);
      }
      
      // SKIP RECENCY CHECK - Use Spark data if available (ignore updatedAt)
      const isSparkDataValid = companySparkData && marketSparkData && companySparkData.revenue > 0;
      
      if (isSparkDataValid) {
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
        if (issues.length > 0) {
          console.log(`[Root Cause Analysis] WARNING:  Spark data issues: ${issues.join('; ')}`);
        }
        console.log(`[Root Cause Analysis] WARNING: No Spark data available for ${companyId}:${sector} - returning default values`);
        // Return default/empty values instead of slow MongoDB aggregation
        current = { revenue: 0, salesCount: 0, avgSaleAmount: 0 };
        market = { revenue: 0, salesCount: 0, avgSaleAmount: 0, companiesCount: 1 };
        marketAvg = 0;
        revenueDiff = 0;
      }
    } catch (sparkError) {
      console.log(`[Root Cause Analysis] WARNING:  Error reading Spark data: ${sparkError.message} - returning default values`);
      current = { revenue: 0, salesCount: 0, avgSaleAmount: 0 };
      market = { revenue: 0, salesCount: 0, avgSaleAmount: 0, companiesCount: 1 };
      marketAvg = 0;
      revenueDiff = 0;
    }
    // Simple comparison: if company revenue < market revenue, there's a problem
    const hasRevenueProblem = current.revenue > 0 && marketAvg > 0 && current.revenue < marketAvg;

    // Price Analysis - DISABLED for performance
    // Use avgSaleAmount from Spark data instead (already calculated)
    // Note: current and market are now defined above
    const companyPrices = [{
      _id: null,
      avgPrice: current.avgSaleAmount || 0,
      minPrice: null,
      maxPrice: null
    }];
    const marketPrices = [{
      _id: null,
      avgPrice: market.avgSaleAmount || 0,
      minPrice: null,
      maxPrice: null
    }];

    // Analyze Root Causes
    const rootCauses = [];

    // If there's a revenue problem, add it as a root cause and analyze with lower thresholds
    if (hasRevenueProblem) {
      const avgSaleDiff = market.avgSaleAmount > 0 
        ? ((current.avgSaleAmount - market.avgSaleAmount) / market.avgSaleAmount) * 100
        : 0;
      const salesCountDiff = market.salesCount > 0 
        ? ((current.salesCount - (market.salesCount / market.companiesCount)) / (market.salesCount / market.companiesCount)) * 100
        : 0;

      // Determine severity based on percentage difference
      const absDiff = Math.abs(revenueDiff);
      const severity = absDiff >= 20 ? 'high' : absDiff >= 10 ? 'medium' : 'low';
      
      let revenueRootCause = {
        type: 'low_revenue',
        severity: severity,
        description: `Revenue is ${Math.abs(revenueDiff).toFixed(1)}% below market average ($${current.revenue.toLocaleString()} vs $${Math.round(marketAvg).toLocaleString()})`,
        details: {
          currentRevenue: current.revenue,
          marketAverage: Math.round(marketAvg),
          revenueDifference: Math.abs(revenueDiff).toFixed(1) + '%',
          currentSalesCount: current.salesCount,
          marketAvgSalesCount: Math.round(market.salesCount / market.companiesCount),
          currentAvgSale: current.avgSaleAmount,
          marketAvgSale: market.avgSaleAmount
        },
        recommendation: ''
      };

      // Build comprehensive recommendation based on all factors
      const factors = [];
      if (avgSaleDiff < -10) {
        factors.push(`low average sale amount (${Math.abs(avgSaleDiff).toFixed(1)}% below market)`);
      }
      if (salesCountDiff < -10) {
        factors.push(`low sales count (${Math.abs(salesCountDiff).toFixed(1)}% below market)`);
      }
      if (revenueDiff < -20) {
        factors.push('significant revenue gap');
      }

      revenueRootCause.recommendation = `Your revenue is ${Math.abs(revenueDiff).toFixed(1)}% below market average. ` +
        (factors.length > 0 
          ? `Contributing factors: ${factors.join(', ')}. ` 
          : '') +
        `Immediate actions: 1) Analyze top-performing products and increase inventory, ` +
        `2) Review pricing strategy, 3) Improve employee sales performance, ` +
        `4) Enhance marketing and customer acquisition, 5) Compare with market leaders to identify gaps.`;

      rootCauses.push(revenueRootCause);
    }

    // If there's a revenue problem, analyze all potential root causes with lower thresholds
    const analysisThreshold = hasRevenueProblem ? 15 : 30; // Lower threshold if revenue problem exists
    const priceThreshold = hasRevenueProblem ? 15 : 20; // Lower threshold if revenue problem exists
    const employeeThreshold = hasRevenueProblem ? 15 : 20; // Lower threshold if revenue problem exists

    // Brand Analysis - Compare brand percentage of total revenue, not absolute values
    const topMarketBrand = marketBrands[0];
    const companyTopBrand = companyBrands[0];
    const top3MarketBrands = marketBrands.slice(0, 3).map(b => b._id).filter(Boolean);
    const top3CompanyBrands = companyBrands.slice(0, 3).map(b => b._id).filter(Boolean);
    
    // Calculate total revenue for percentage calculation
    const companyTotalRevenue = current.revenue;
    const marketTotalRevenue = market.revenue;
    
    if (topMarketBrand && companyTopBrand && companyTotalRevenue > 0 && marketTotalRevenue > 0) {
      // Calculate brand percentage of total revenue for top brands
      const companyBrandPercentage = (companyTopBrand.revenue / companyTotalRevenue) * 100;
      const marketBrandPercentage = (topMarketBrand.revenue / marketTotalRevenue) * 100;
      
      // Compare percentages - if company's brand percentage is significantly lower than market
      const brandPercentageDiff = companyBrandPercentage - marketBrandPercentage;
      
      // Check if same brand
      const isSameBrand = companyTopBrand._id === topMarketBrand._id;
      
      // Calculate Top 3 brands coverage for both company and market
      const companyTop3Revenue = companyBrands.slice(0, 3).reduce((sum, b) => sum + (b.revenue || 0), 0);
      const marketTop3Revenue = marketBrands.slice(0, 3).reduce((sum, b) => sum + (b.revenue || 0), 0);
      const companyTop3Percentage = (companyTop3Revenue / companyTotalRevenue) * 100;
      const marketTop3Percentage = (marketTop3Revenue / marketTotalRevenue) * 100;
      
      // Check how many of top 3 market brands are in company's top 3
      const commonTop3Brands = top3MarketBrands.filter(b => top3CompanyBrands.includes(b));
      const top3BrandMatch = commonTop3Brands.length;
      
      // More accurate brand issue detection:
      // 1. Different top brand AND significant market share difference (>15% absolute)
      // 2. Same brand BUT significant percentage gap (>15% absolute AND company < market)
      // 3. Top 3 brands don't match well (less than 2 common brands) AND top 3 coverage gap >20%
      const significantPercentageGap = Math.abs(brandPercentageDiff) > 15 && brandPercentageDiff < 0;
      const top3CoverageGap = (marketTop3Percentage - companyTop3Percentage) > 20;
      const poorTop3Match = top3BrandMatch < 2;
      
      const hasBrandIssue = (!isSameBrand && significantPercentageGap) || 
        (isSameBrand && significantPercentageGap) ||
        (poorTop3Match && top3CoverageGap);
      
      if (hasBrandIssue) {
        const missingBrands = top3MarketBrands.filter(b => !top3CompanyBrands.includes(b));
        
        // Build recommendation based on specific issue type
        let recommendation = '';
        let severity = 'medium';
        let description = '';
        
        if (!isSameBrand && significantPercentageGap) {
          // Different top brand with significant gap
          severity = Math.abs(brandPercentageDiff) > 25 ? 'high' : 'medium';
          description = `Your top brand "${companyTopBrand._id}" (${companyBrandPercentage.toFixed(1)}%) differs from market leader "${topMarketBrand._id}" (${marketBrandPercentage.toFixed(1)}%), with a ${Math.abs(brandPercentageDiff).toFixed(1)}% gap.`;
          recommendation = `Consider adding market-leading brand "${topMarketBrand._id}" to your portfolio. ` +
            (missingBrands.length > 0 ? `Also consider: ${missingBrands.slice(0, 2).join(', ')}. ` : '') +
            `These brands represent ${marketTop3Percentage.toFixed(1)}% of market revenue and could help capture more market share.`;
        } else if (isSameBrand && significantPercentageGap) {
          // Same brand but significant percentage gap
          severity = Math.abs(brandPercentageDiff) > 25 ? 'high' : 'medium';
          description = `Your top brand "${companyTopBrand._id}" represents ${companyBrandPercentage.toFixed(1)}% of revenue vs ${marketBrandPercentage.toFixed(1)}% in market (${Math.abs(brandPercentageDiff).toFixed(1)}% gap).`;
          recommendation = `Increase focus on "${companyTopBrand._id}": enhance marketing, improve product placement, and run targeted promotions. ` +
            `Also consider diversifying your brand portfolio to reduce dependency on a single brand.`;
        } else if (poorTop3Match && top3CoverageGap) {
          // Top 3 brands don't align well
          severity = top3CoverageGap > 30 ? 'high' : 'medium';
          description = `Your top 3 brands cover ${companyTop3Percentage.toFixed(1)}% of revenue vs ${marketTop3Percentage.toFixed(1)}% in market. ` +
            `Only ${top3BrandMatch} of your top 3 brands match market leaders.`;
          recommendation = `Align your brand portfolio with market trends. ` +
            (missingBrands.length > 0 ? `Consider adding: ${missingBrands.slice(0, 2).join(', ')}. ` : '') +
            `These brands could help improve your market coverage.`;
        }
        
        rootCauses.push({
          type: 'brand_issue',
          severity: severity,
          description: description,
          details: {
            companyTopBrand: companyTopBrand._id,
            marketTopBrand: topMarketBrand._id,
            companyBrandRevenue: companyTopBrand.revenue,
            marketBrandRevenue: topMarketBrand.revenue,
            companyBrandPercentage: companyBrandPercentage.toFixed(1) + '%',
            marketBrandPercentage: marketBrandPercentage.toFixed(1) + '%',
            top3MarketBrands: top3MarketBrands,
            top3CompanyBrands: top3CompanyBrands,
            isSameBrand: isSameBrand
          },
          recommendation: recommendation
        });
      }
    }

    // Price Analysis
    const companyAvgPrice = companyPrices[0]?.avgPrice || 0;
    const marketAvgPrice = marketPrices[0]?.avgPrice || 0;
    const companyMinPrice = companyPrices[0]?.minPrice || 0;
    const companyMaxPrice = companyPrices[0]?.maxPrice || 0;
    const marketMinPrice = marketPrices[0]?.minPrice || 0;
    const marketMaxPrice = marketPrices[0]?.maxPrice || 0;
    
    if (marketAvgPrice > 0) {
      const priceDiff = ((companyAvgPrice - marketAvgPrice) / marketAvgPrice) * 100;
      if (priceDiff > priceThreshold) {
        const priceRangeDiff = ((companyMaxPrice - companyMinPrice) - (marketMaxPrice - marketMinPrice)) / (marketMaxPrice - marketMinPrice) * 100;
        const recommendation = `Your average price is $${companyAvgPrice.toFixed(2)} (${priceDiff.toFixed(1)}% above market average of $${marketAvgPrice.toFixed(2)}). ` +
          (priceRangeDiff > 30
            ? `Your price range is too wide ($${companyMinPrice.toFixed(2)} - $${companyMaxPrice.toFixed(2)}). ` +
              `Consider competitive pricing for high-end products or introduce budget-friendly alternatives. ` +
              `Focus on value proposition: justify higher prices with better quality, service, or exclusive products.`
            : `Review pricing strategy: consider competitive pricing for top-selling products. ` +
              `Analyze which products customers are price-sensitive about and adjust accordingly. ` +
              `Consider promotional pricing or bundle deals to maintain margins while attracting price-conscious customers.`);
        
        rootCauses.push({
          type: 'pricing_issue',
          severity: 'high',
          description: `Average product price is ${priceDiff.toFixed(1)}% higher than market average ($${companyAvgPrice.toFixed(2)} vs $${marketAvgPrice.toFixed(2)})`,
          details: {
            companyAvgPrice: companyAvgPrice,
            marketAvgPrice: marketAvgPrice,
            companyPriceRange: { min: companyMinPrice, max: companyMaxPrice },
            marketPriceRange: { min: marketMinPrice, max: marketMaxPrice },
            priceDifference: priceDiff.toFixed(1) + '%'
          },
          recommendation: recommendation
        });
      } else if (priceDiff < -priceThreshold) {
        const recommendation = `Your average price is $${companyAvgPrice.toFixed(2)} (${Math.abs(priceDiff).toFixed(1)}% below market average of $${marketAvgPrice.toFixed(2)}). ` +
          `While lower prices can attract customers, this may indicate undervaluing products or missing upselling opportunities. ` +
          `Consider: 1) Review product mix - add premium products, 2) Train staff on upselling, 3) Create product bundles, 4) Improve product presentation to justify higher prices.`;
        
        rootCauses.push({
          type: 'pricing_issue',
          severity: 'medium',
          description: `Average product price is ${Math.abs(priceDiff).toFixed(1)}% below market average ($${companyAvgPrice.toFixed(2)} vs $${marketAvgPrice.toFixed(2)})`,
          details: {
            companyAvgPrice: companyAvgPrice,
            marketAvgPrice: marketAvgPrice,
            priceDifference: Math.abs(priceDiff).toFixed(1) + '%'
          },
          recommendation: recommendation
        });
      }
    }

    // Employee Performance Analysis
    // Logic: Count employees with total revenue per employee above market average
    // marketAvgRevenuePerEmployee = average total revenue per employee across all market employees
    // For each company employee: their total revenue IS their revenue per employee
    // We compare: company employee's total revenue vs market average revenue per employee
    const marketAvgSalesPerEmployee = marketEmployees[0]?.avgSalesPerEmployee || 0;
    const marketAvgRevenuePerEmployee = marketEmployees[0]?.avgRevenuePerEmployee || 0;
    
    // For each company employee, their total revenue IS their revenue per employee
    // (because each employee has their own total revenue)
    // We compare: company employee's total revenue vs market average revenue per employee
    const companyEmployeesWithRevenue = companyEmployees.map(emp => ({
      ...emp,
      revenuePerEmployee: emp.revenue // Total revenue for this employee = revenue per employee
    }));
    
    // Count employees with revenue per employee above market average
    // Only analyze if we have market data and company employees
    const employeesAboveMarket = marketAvgRevenuePerEmployee > 0 && companyEmployees.length > 0
      ? companyEmployeesWithRevenue.filter(emp => 
          emp.revenuePerEmployee > marketAvgRevenuePerEmployee
        ).length
      : 0;
    
    const totalEmployees = companyEmployees.length;
    const employeesAboveMarketPercentage = totalEmployees > 0 
      ? (employeesAboveMarket / totalEmployees) * 100 
      : 0;
    
    // Problem exists if less than 50% of employees are above market average
    // Or if the percentage is significantly low (less than 30%)
    const hasEmployeePerformanceProblem = employeesAboveMarketPercentage < 50;
    const isSignificantProblem = employeesAboveMarketPercentage < 30;
    
    if (hasEmployeePerformanceProblem && marketAvgRevenuePerEmployee > 0) {
      const companyAvgRevenuePerEmployee = companyEmployees.length > 0
        ? companyEmployees.reduce((sum, e) => sum + e.revenue, 0) / companyEmployees.length
        : 0;
      
      const topPerformers = companyEmployeesWithRevenue
        .filter(emp => emp.revenuePerEmployee > marketAvgRevenuePerEmployee)
        .sort((a, b) => b.revenuePerEmployee - a.revenuePerEmployee)
        .slice(0, 3);
      
      const lowPerformers = companyEmployeesWithRevenue
        .filter(emp => emp.revenuePerEmployee <= marketAvgRevenuePerEmployee)
        .sort((a, b) => a.revenuePerEmployee - b.revenuePerEmployee)
        .slice(0, 3);
      
      const topPerformerNames = topPerformers.length > 0 
        ? topPerformers.map(emp => cleanEmployeeName(emp.employeeName, emp._id)).filter(Boolean).slice(0, 2)
        : [];
      
      const recommendation = `Only ${employeesAboveMarket} out of ${totalEmployees} employees (${employeesAboveMarketPercentage.toFixed(1)}%) have average revenue above market average ($${marketAvgRevenuePerEmployee.toFixed(2)}). ` +
        `Company average revenue per employee is $${companyAvgRevenuePerEmployee.toFixed(2)} vs market average of $${marketAvgRevenuePerEmployee.toFixed(2)}. ` +
        (topPerformerNames.length > 0
          ? `Top performers: ${topPerformerNames.join(', ')}. ` +
            `Analyze their techniques and share best practices with underperforming staff. ` +
            `Consider: 1) Training programs on sales techniques, 2) Performance-based incentives, 3) Regular coaching sessions, 4) Clear sales targets and KPIs, 5) Pair low performers with top performers for mentorship.`
          : `Consider: 1) Comprehensive sales training, 2) Performance incentives and bonuses, 3) Regular performance reviews, 4) Mentorship programs, 5) Clear sales targets and daily/weekly goals, 6) Identify and address barriers to performance.`);
      
      rootCauses.push({
        type: 'employee_performance',
        severity: isSignificantProblem ? 'high' : 'medium',
        description: `Only ${employeesAboveMarketPercentage.toFixed(1)}% of employees (${employeesAboveMarket}/${totalEmployees}) have average revenue above market average`,
        details: {
          employeesAboveMarket: employeesAboveMarket,
          totalEmployees: totalEmployees,
          employeesAboveMarketPercentage: employeesAboveMarketPercentage.toFixed(1) + '%',
          companyAvgRevenuePerEmployee: companyAvgRevenuePerEmployee,
          marketAvgRevenuePerEmployee: marketAvgRevenuePerEmployee,
          topPerformers: topPerformers.slice(0, 2).map(emp => ({
            ...emp,
            employeeName: cleanEmployeeName(emp.employeeName, emp._id)
          })),
          lowPerformers: lowPerformers.slice(0, 2).map(emp => ({
            ...emp,
            employeeName: cleanEmployeeName(emp.employeeName, emp._id)
          }))
        },
        recommendation: recommendation
      });
    }

    // Product Category Analysis - DISABLED (aggregations too slow)
    // Skip this analysis to improve performance
    const topMarketCategory = null;
    const companyTopCategory = null;
    const top3MarketCategories = [];
    const top3CompanyCategories = [];
    
    // Skip product category analysis (disabled for performance)
    if (false && topMarketCategory && companyTopCategory && companyTotalRevenue > 0 && marketTotalRevenue > 0) {
      // Calculate category percentage of total revenue
      const companyCategoryPercentage = (companyTopCategory.revenue / companyTotalRevenue) * 100;
      const marketCategoryPercentage = (topMarketCategory.revenue / marketTotalRevenue) * 100;
      
      // Compare percentages
      const categoryPercentageDiff = companyCategoryPercentage - marketCategoryPercentage;
      
      // Check if same category
      const isSameCategory = companyTopCategory._id === topMarketCategory._id;
      
      // Only flag as issue if:
      // 1. Different categories (company missing top market category) - MEDIUM PRIORITY
      // 2. Same category but category percentage is significantly lower (more than 20% absolute difference)
      //    This means the category is less important to the company than to the market
      //    Example: Company 10% vs Market 30% = -20% difference (significant)
      //    Example: Company 32% vs Market 31% = +1% difference (not significant, actually better!)
      const hasCategoryIssue = !isSameCategory || 
        (isSameCategory && Math.abs(categoryPercentageDiff) > 20 && categoryPercentageDiff < 0);
      
      if (hasCategoryIssue) {
        const missingCategories = top3MarketCategories.filter(c => !top3CompanyCategories.includes(c));
        const recommendation = !isSameCategory && missingCategories.length > 0
          ? `Your top category "${companyTopCategory._id}" is different from market leader "${topMarketCategory._id}". ` +
            `Consider expanding into popular market categories: ${missingCategories.slice(0, 2).join(', ')}. ` +
            `These categories represent ${marketCategoryPercentage.toFixed(1)}% of market revenue and show strong market demand.`
          : isSameCategory && Math.abs(categoryPercentageDiff) > 20 && categoryPercentageDiff < 0
          ? `Your top category "${companyTopCategory._id}" represents ${companyCategoryPercentage.toFixed(1)}% of your revenue vs ${marketCategoryPercentage.toFixed(1)}% in market. ` +
            `Review your "${companyTopCategory._id}" category strategy: ` +
            `1) Analyze which products in this category are underperforming, ` +
            `2) Compare your product mix with market leaders, ` +
            `3) Improve product placement and visibility, ` +
            `4) Consider promotional campaigns focused on this category to increase its contribution.`
          : `Your category mix is aligned with market trends. Continue monitoring category performance and adjust strategy as needed.`;
        
        // Determine severity and description based on the issue type
        let severity = 'medium';
        let description = '';
        
        if (!isSameCategory) {
          severity = 'medium';
          description = `Your top category "${companyTopCategory._id}" is different from market leader "${topMarketCategory._id}". Market leader "${topMarketCategory._id}" represents ${marketCategoryPercentage.toFixed(1)}% of market revenue, while your top category "${companyTopCategory._id}" represents ${companyCategoryPercentage.toFixed(1)}% of your revenue.`;
        } else {
          // Same category but percentage difference
          severity = categoryPercentageDiff < -25 ? 'high' : 'medium';
          description = `Your top category "${companyTopCategory._id}" represents ${companyCategoryPercentage.toFixed(1)}% of your revenue vs ${marketCategoryPercentage.toFixed(1)}% in market (${Math.abs(categoryPercentageDiff).toFixed(1)}% difference). This suggests the category is less important to your business than to the market.`;
        }
        
        rootCauses.push({
          type: 'product_category',
          severity: severity,
          description: description,
          details: {
            companyTopCategory: companyTopCategory._id,
            marketTopCategory: topMarketCategory._id,
            companyCategoryRevenue: companyTopCategory.revenue,
            marketCategoryRevenue: topMarketCategory.revenue,
            companyCategoryPercentage: companyCategoryPercentage.toFixed(1) + '%',
            marketCategoryPercentage: marketCategoryPercentage.toFixed(1) + '%',
            top3MarketCategories: top3MarketCategories,
            top3CompanyCategories: top3CompanyCategories,
            isSameCategory: isSameCategory
          },
          recommendation: recommendation
        });
      }
    }

    // Calculate percentages for brands data
    const companyBrandsWithPercentage = companyBrands && companyBrands.length > 0
      ? companyBrands.slice(0, 5).map(brand => ({
          ...brand,
          percentage: companyTotalRevenue > 0 ? (brand.revenue / companyTotalRevenue) * 100 : 0
        }))
      : [];
    
    const marketBrandsWithPercentage = marketBrands && marketBrands.length > 0
      ? marketBrands.slice(0, 5).map(brand => ({
          ...brand,
          percentage: marketTotalRevenue > 0 ? (brand.revenue / marketTotalRevenue) * 100 : 0
        }))
      : [];

    res.json({
      success: true,
      companyId: companyId,
      sector: sector,
      rootCauses: rootCauses,
      analysis: {
        brands: {
          company: companyBrandsWithPercentage,
          market: marketBrandsWithPercentage,
          companyTotalRevenue: companyTotalRevenue,
          marketTotalRevenue: marketTotalRevenue,
          marketAverageRevenue: market.companiesCount > 0 ? marketTotalRevenue / market.companiesCount : 0
        },
        products: {
          company: companyProducts.slice(0, 5).map(product => ({
            ...product,
            percentage: companyTotalRevenue > 0 ? (product.revenue / companyTotalRevenue) * 100 : 0
          })),
          market: marketProducts.slice(0, 5).map(product => ({
            ...product,
            percentage: marketTotalRevenue > 0 ? (product.revenue / marketTotalRevenue) * 100 : 0
          })),
          companyTotalRevenue: companyTotalRevenue,
          marketTotalRevenue: marketTotalRevenue
        },
        pricing: {
          company: {
            avgPrice: companyAvgPrice,
            minPrice: companyPrices[0]?.minPrice || 0,
            maxPrice: companyPrices[0]?.maxPrice || 0
          },
          market: {
            avgPrice: marketAvgPrice,
            minPrice: marketPrices[0]?.minPrice || 0,
            maxPrice: marketPrices[0]?.maxPrice || 0
          }
        },
        employees: {
          company: companyEmployees.slice(0, 5).map(emp => ({
            ...emp,
            employeeName: cleanEmployeeName(emp.employeeName, emp._id),
            percentage: companyTotalRevenue > 0 ? (emp.revenue / companyTotalRevenue) * 100 : 0
          })),
          marketAverage: {
            avgSalesPerEmployee: marketAvgSalesPerEmployee,
            avgRevenuePerEmployee: marketEmployees[0]?.avgRevenuePerEmployee || 0
          },
          companyTotalRevenue: companyTotalRevenue,
          marketTotalRevenue: marketTotalRevenue
        }
      },
      summary: {
        totalRootCauses: rootCauses.length,
        criticalIssues: rootCauses.filter(rc => rc.severity === 'high').length,
        recommendations: rootCauses.map(rc => rc.recommendation)
      }
    });
  } catch (error) {
    console.error('[Root Cause Analysis] Error:', error);
    console.error('[Root Cause Analysis] Stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

