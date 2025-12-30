const express = require('express');
const router = express.Router();
const { cacheMiddleware, analysisCacheMiddleware } = require('../middleware/cache');
const { deduplicateRequest } = require('../middleware/requestDeduplication');
const analyticsController = require('../controllers/analyticsController');
const sectorAnalyticsController = require('../controllers/sectorAnalyticsController');
const companyAnalyticsController = require('../controllers/companyAnalyticsController');
const comparativeAnalyticsController = require('../controllers/comparativeAnalyticsController');
const problemDetectionController = require('../controllers/problemDetectionController');
const rootCauseAnalysisController = require('../controllers/rootCauseAnalysisController');

// Sales Analytics
router.get('/sales/summary', analyticsController.getSalesSummary);
router.get('/sales/by-region', analyticsController.getSalesByRegion);
router.get('/sales/by-company', analyticsController.getSalesByCompany);
router.get('/sales/trends', analyticsController.getSalesTrends);

// Product Analytics
router.get('/products/top-selling', analyticsController.getTopSellingProducts);
router.get('/products/by-brand', analyticsController.getProductsByBrand);
router.get('/products/by-category', analyticsController.getProductsByCategory);

// Employee Analytics
router.get('/employees/performance', analyticsController.getEmployeePerformance);

// Dashboard (All KPIs)
router.get('/dashboard', analyticsController.getDashboardData);

// Company Analytics (with caching for better performance)
router.get('/company/:companyId', cacheMiddleware, companyAnalyticsController.getCompanyAnalytics);
// Company Detailed Analytics (for Problem Analysis - includes Top Products and Employee Performance)
router.get('/company/:companyId/detailed', analysisCacheMiddleware, companyAnalyticsController.getCompanyDetailedAnalytics);

// Sector Analytics (Market Overview) - Cache first, then deduplication
// Cache check happens first, then deduplication prevents duplicate processing
router.get('/sector/:sector/market', 
  cacheMiddleware,
  deduplicateRequest(sectorAnalyticsController.getSectorAnalytics, 'sectorAnalytics')
);

// Real-time Analytics
const realtimeAnalyticsController = require('../controllers/realtimeAnalyticsController');
router.get('/realtime/summary', realtimeAnalyticsController.getRealtimeSummary);
router.get('/realtime/sales-rate', realtimeAnalyticsController.getSalesRate);
router.get('/realtime/top-products', realtimeAnalyticsController.getRealtimeTopProducts);
router.get('/realtime/activity-feed', realtimeAnalyticsController.getActivityFeed);

// Sector Analytics
router.get('/sector/:sector/overview', sectorAnalyticsController.getSectorOverview);
router.get('/sector/:sector/companies', sectorAnalyticsController.getSectorCompanies);
router.get('/sector/:sector/regions', sectorAnalyticsController.getSectorRegions);
router.get('/sector/:sector/company/:companyId', sectorAnalyticsController.getCompanyInSector);

// Comparative Analytics
router.get('/compare/company/:companyId/vs-market', comparativeAnalyticsController.compareCompanyVsMarket);
router.get('/compare/company/:companyId/vs-region', comparativeAnalyticsController.compareCompanyVsRegion);
router.get('/compare/company/:companyId/trend', comparativeAnalyticsController.compareCompanyTrend);

// Problem Detection - With deduplication to prevent duplicate processing
router.get('/problems/company/:companyId', 
  analysisCacheMiddleware,
  deduplicateRequest(problemDetectionController.detectCompanyProblems, 'problemDetection')
);
router.get('/problems/region/:region', analysisCacheMiddleware, problemDetectionController.detectRegionProblems);

// Root Cause Analysis - With deduplication to prevent duplicate processing
router.get('/root-cause/company/:companyId', 
  analysisCacheMiddleware,
  deduplicateRequest(rootCauseAnalysisController.analyzeCompanyRootCause, 'rootCause')
);

module.exports = router;

