const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');

// Real-time Sales Summary (Last N minutes)
exports.getRealtimeSummary = async (req, res) => {
  try {
    const { minutes = 5, companyId, branchId, region } = req.query;
    
    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
    const matchQuery = {
      saleTime: { $gte: timeThreshold }
    };
    
    if (companyId) matchQuery.companyId = companyId;
    if (branchId) matchQuery.branchId = branchId;
    if (region) matchQuery.region = region;

    const [summary, salesByType, recentSales] = await Promise.all([
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
      // Sales by type
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$saleType',
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]),
      // Recent sales (last 10)
      Sale.find(matchQuery)
        .sort({ saleTime: -1 })
        .limit(10)
        .select('saleTime totalAmount saleType companyId branchId')
    ]);

    res.json({
      period: `${minutes} minutes`,
      summary: summary[0] || {
        totalRevenue: 0,
        totalSales: 0,
        avgSaleAmount: 0
      },
      byType: salesByType,
      recentSales,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Real-time Sales Rate (Sales per minute)
exports.getSalesRate = async (req, res) => {
  try {
    const { minutes = 10, companyId, region } = req.query;
    
    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
    const matchQuery = {
      saleTime: { $gte: timeThreshold }
    };
    
    if (companyId) matchQuery.companyId = companyId;
    if (region) matchQuery.region = region;

    const salesByMinute = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:%M',
              date: '$saleTime'
            }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalSales = salesByMinute.reduce((sum, item) => sum + item.count, 0);
    const salesPerMinute = totalSales / minutes;

    res.json({
      period: `${minutes} minutes`,
      salesPerMinute: salesPerMinute.toFixed(2),
      totalSales,
      byMinute: salesByMinute,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Real-time Top Products (Last N minutes)
exports.getRealtimeTopProducts = async (req, res) => {
  try {
    const { minutes = 5, limit = 10, companyId } = req.query;
    
    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
    const matchQuery = {
      'sale.saleTime': { $gte: timeThreshold }
    };
    if (companyId) matchQuery['sale.companyId'] = companyId;

    const topProducts = await SaleItem.aggregate([
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
          totalRevenue: { $sum: '$subtotal' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      period: `${minutes} minutes`,
      products: topProducts,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Real-time Activity Feed
exports.getActivityFeed = async (req, res) => {
  try {
    const { limit = 50, companyId, branchId } = req.query;
    
    const matchQuery = {};
    if (companyId) matchQuery.companyId = companyId;
    if (branchId) matchQuery.branchId = branchId;

    const activities = await Sale.find(matchQuery)
      .sort({ saleTime: -1 })
      .limit(parseInt(limit))
      .populate('clientId', 'clientName')
      .populate('employeeId', 'employeeName')
      .select('saleTime totalAmount saleType saleStatus companyId branchId region');

    res.json({
      activities,
      count: activities.length,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

