require('dotenv').config();
const connectDB = require('../config/database');
const { startConsumers } = require('./kafkaConsumer');

/**
 * Kafka Consumer Service
 * Run this as a separate service: node services/kafkaConsumerService.js
 */

async function startKafkaConsumerService() {
  try {
    console.log('='.repeat(60));
    console.log('[KAFKA CONSUMER SERVICE] 🚀 Starting Kafka Consumer Service...');
    console.log('='.repeat(60));
    
    // Connect to MongoDB (required for processing messages)
    await connectDB();
    console.log('[KAFKA CONSUMER SERVICE] ✅ MongoDB connected');
    
    // Start all Kafka consumers
    await startConsumers();
    
    console.log('='.repeat(60));
    console.log('[KAFKA CONSUMER SERVICE] ✅ Kafka Consumer Service is running and ready!');
    console.log('[KAFKA CONSUMER SERVICE] 📊 Waiting for messages from Kafka topics...');
    console.log('[KAFKA CONSUMER SERVICE] Press Ctrl+C to stop');
    console.log('='.repeat(60));
    
    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n[KAFKA CONSUMER SERVICE] ⏹️  Stopping Kafka Consumer Service...');
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.log('\n[KAFKA CONSUMER SERVICE] ⏹️  Stopping Kafka Consumer Service...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('[KAFKA CONSUMER SERVICE] ❌ Failed to start Kafka Consumer Service:', error.message);
    process.exit(1);
  }
}

startKafkaConsumerService();

