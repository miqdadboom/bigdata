const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const Product = require('../models/CRUD/Product');
const Employee = require('../models/CRUD/Employee');

/**
 * Comparative Analytics Controller
 * Comparative Analytics
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
 * Compare Company vs Market (Sector)
 * مقارنة شركة مع السوق الفلسطيني للقطاع
 * GET /api/analytics/compare/company/:companyId/vs-market
 */
exports.compareCompanyVsMarket = async (req, res) => {
  try {
    const { companyId } = req.params;
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
      ...dateQuery
    };

    // Company Data
    const companyData = await Sale.aggregate([
      { $match: { ...baseMatch, companyId: companyId }},
      { $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        salesCount: { $sum: 1 },
        avgSaleAmount: { $avg: '$totalAmount' }
      }}
    ]);

    // Market Data (All companies in sector)
    const marketData = await Sale.aggregate([
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

    const company = companyData[0] || { revenue: 0, salesCount: 0, avgSaleAmount: 0 };
    const market = marketData[0] || { revenue: 0, salesCount: 0, avgSaleAmount: 0, companiesCount: 0 };

    // Calculate percentages
    const marketShare = market.revenue > 0 
      ? (company.revenue / market.revenue) * 100 
      : 0;
    
    const revenueVsMarket = market.revenue > 0
      ? ((company.revenue - (market.revenue / market.companiesCount)) / (market.revenue / market.companiesCount)) * 100
      : 0;

    const avgSaleVsMarket = market.avgSaleAmount > 0
      ? ((company.avgSaleAmount - market.avgSaleAmount) / market.avgSaleAmount) * 100
      : 0;

    res.json({
      success: true,
      company: {
        companyId: companyId,
        revenue: company.revenue,
        salesCount: company.salesCount,
        avgSaleAmount: company.avgSaleAmount
      },
      market: {
        sector: sector,
        totalRevenue: market.revenue,
        totalSales: market.salesCount,
        avgSaleAmount: market.avgSaleAmount,
        companiesCount: market.companiesCount
      },
      comparison: {
        marketShare: parseFloat(marketShare.toFixed(2)),
        revenueVsMarketAvg: parseFloat(revenueVsMarket.toFixed(2)),
        avgSaleVsMarket: parseFloat(avgSaleVsMarket.toFixed(2)),
        performance: revenueVsMarket > 10 ? 'above_average' : revenueVsMarket < -10 ? 'below_average' : 'average'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Compare Company vs Region
 * مقارنة شركة مع المنطقة
 * GET /api/analytics/compare/company/:companyId/vs-region
 */
exports.compareCompanyVsRegion = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { sector, region, startDate, endDate } = req.query;

    if (!sector || !region) {
      return res.status(400).json({
        success: false,
        error: 'sector and region parameters are required'
      });
    }

    const dateQuery = buildDateQuery(startDate, endDate);
    const baseMatch = {
      saleStatus: 'completed',
      sector: sector,
      region: region,
      ...dateQuery
    };

    // Company Data in Region
    const companyData = await Sale.aggregate([
      { $match: { ...baseMatch, companyId: companyId }},
      { $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        salesCount: { $sum: 1 },
        avgSaleAmount: { $avg: '$totalAmount' }
      }}
    ]);

    // Region Data (All companies in region)
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
    
    const company = companyData[0] || { revenue: 0, salesCount: 0, avgSaleAmount: 0 };
    // استخدام اسم مختلف عن متغير query `region` لتجنب التعارض
    const regionStats = regionData[0] || { revenue: 0, salesCount: 0, avgSaleAmount: 0, companiesCount: 0 };
    
    // Calculate percentages
    const regionShare = regionStats.revenue > 0 
      ? (company.revenue / regionStats.revenue) * 100 
      : 0;
    
    const revenueVsRegion = regionStats.revenue > 0
      ? ((company.revenue - (regionStats.revenue / regionStats.companiesCount)) / (regionStats.revenue / regionStats.companiesCount)) * 100
      : 0;
    
    const avgSaleVsRegion = regionStats.avgSaleAmount > 0
      ? ((company.avgSaleAmount - regionStats.avgSaleAmount) / regionStats.avgSaleAmount) * 100
      : 0;
    
    res.json({
      success: true,
      company: {
        companyId: companyId,
        revenue: company.revenue,
        salesCount: company.salesCount,
        avgSaleAmount: company.avgSaleAmount
      },
      region: {
        sector: sector,
        region: region,
        totalRevenue: regionStats.revenue,
        totalSales: regionStats.salesCount,
        avgSaleAmount: regionStats.avgSaleAmount,
        companiesCount: regionStats.companiesCount
      },
      comparison: {
        regionShare: parseFloat(regionShare.toFixed(2)),
        revenueVsRegionAvg: parseFloat(revenueVsRegion.toFixed(2)),
        avgSaleVsRegion: parseFloat(avgSaleVsRegion.toFixed(2)),
        performance: revenueVsRegion > 10 ? 'above_average' : revenueVsRegion < -10 ? 'below_average' : 'average'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Compare Company Performance Over Time
 * مقارنة أداء الشركة عبر الزمن
 * GET /api/analytics/compare/company/:companyId/trend
 */
exports.compareCompanyTrend = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { sector, startDate, endDate, period = 'daily' } = req.query;

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
      ...dateQuery
    };

    let dateFormat = '%Y-%m-%d'; // daily
    if (period === 'weekly') dateFormat = '%Y-W%V';
    if (period === 'monthly') dateFormat = '%Y-%m';

    // Company Trend
    const companyTrend = await Sale.aggregate([
      { $match: { ...baseMatch, companyId: companyId }},
      { $group: {
        _id: { $dateToString: { format: dateFormat, date: '$saleTime' }},
        revenue: { $sum: '$totalAmount' },
        salesCount: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Market Trend
    const marketTrend = await Sale.aggregate([
      { $match: baseMatch },
      { $group: {
        _id: { $dateToString: { format: dateFormat, date: '$saleTime' }},
        revenue: { $sum: '$totalAmount' },
        salesCount: { $sum: 1 },
        companiesCount: { $addToSet: '$companyId' }
      }},
      { $project: {
        _id: 1,
        revenue: 1,
        salesCount: 1,
        avgRevenue: { $divide: ['$revenue', { $size: '$companiesCount' }] },
        _id: 0
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      companyId: companyId,
      sector: sector,
      period: period,
      companyTrend: companyTrend,
      marketTrend: marketTrend
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

