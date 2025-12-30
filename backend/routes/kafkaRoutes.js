const express = require('express');
const router = express.Router();
const kafkaProducer = require('../services/kafkaProducer');
const kafkaConsumer = require('../services/kafkaConsumer');
const kafkaConfig = require('../config/kafka');

// Get Kafka Producer status and statistics
router.get('/producer/status', (req, res) => {
  try {
    const stats = kafkaProducer.getStats();
    res.json({
      status: 'connected',
      connected: kafkaConfig.isProducerConnected(),
      statistics: stats,
      totalMessages: Object.values(stats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) - stats.errors
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// Get Kafka Consumer status and statistics
router.get('/consumer/status', (req, res) => {
  try {
    const stats = kafkaConsumer.getStats();
    res.json({
      status: 'connected',
      connected: kafkaConfig.isConsumerConnected(),
      statistics: stats,
      totalMessages: Object.values(stats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) - stats.errors - stats.duplicates
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// Get both Producer and Consumer status
router.get('/status', (req, res) => {
  try {
    const producerStats = kafkaProducer.getStats();
    const consumerStats = kafkaConsumer.getStats();
    
    res.json({
      producer: {
        connected: kafkaConfig.isProducerConnected(),
        statistics: producerStats,
        totalSent: Object.values(producerStats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) - producerStats.errors
      },
      consumer: {
        connected: kafkaConfig.isConsumerConnected(),
        statistics: consumerStats,
        totalConsumed: Object.values(consumerStats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) - consumerStats.errors - consumerStats.duplicates
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

module.exports = router;

