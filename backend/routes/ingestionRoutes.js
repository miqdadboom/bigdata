const express = require('express');
const router = express.Router();
const ingestionController = require('../controllers/CRUD/ingestionController');

// Real-time ingestion endpoints
router.post('/sales', ingestionController.ingestSale);
router.post('/sales/batch', ingestionController.ingestBatchSales);
router.post('/products', ingestionController.ingestProduct);
router.post('/clients', ingestionController.ingestClient);
router.post('/employees', ingestionController.ingestEmployee);
router.post('/payments', ingestionController.ingestPayment);

// Health check
router.get('/health', ingestionController.ingestionHealth);

module.exports = router;

