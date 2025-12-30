const { subscribe, TOPICS } = require('../config/kafka');
const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const Product = require('../models/CRUD/Product');
const Client = require('../models/CRUD/Client');
const Employee = require('../models/CRUD/Employee');
const Payment = require('../models/CRUD/Payment');

/**
 * Kafka Consumer Service
 * Receives and processes messages from Kafka Topics
 * 
 * Note: Data is already saved in MongoDB by ingestionController
 * This consumer is for additional processing (analytics, notifications, cache, etc.)
 */

// Track processed messages to prevent duplicates (simple in-memory cache)
// For production, consider using Redis or MongoDB for distributed systems
const processedMessages = new Set();
const MAX_CACHE_SIZE = 10000;

// Consumer statistics
let consumerStats = {
  sales: 0,
  products: 0,
  clients: 0,
  employees: 0,
  payments: 0,
  analytics: 0,
  duplicates: 0,
  errors: 0
};

exports.getStats = () => ({ ...consumerStats });

const addToCache = (messageId) => {
  if (processedMessages.size >= MAX_CACHE_SIZE) {
    const firstKey = processedMessages.values().next().value;
    processedMessages.delete(firstKey);
  }
  processedMessages.add(messageId);
};

const isProcessed = (messageId) => {
  return processedMessages.has(messageId);
};

// Process Sale from Kafka
const processSale = async (data, topic, partition) => {
  const messageId = `${topic}-${partition}-${data._id || data.saleId}`;
  
  // Idempotency check: Skip if already processed
  if (isProcessed(messageId)) {
    consumerStats.duplicates++;
    console.log(`[KAFKA CONSUMER] ⚠️  Sale already processed, skipping: ${data._id || data.saleId} (Duplicates: ${consumerStats.duplicates})`);
    return;
  }

  try {
    // Sale already saved in ingestionController
    // This is for additional processing (analytics, notifications, etc.)
    consumerStats.sales++;
    console.log(`[KAFKA CONSUMER] ✅ Consumed sale from topic '${topic}': ${data._id || data.saleId || 'N/A'} (Total sales consumed: ${consumerStats.sales})`);
    
    // Add your custom processing logic here:
    // - Real-time analytics updates
    // - Notifications (email, SMS, push)
    // - Cache updates (Redis, etc.)
    // - WebSocket notifications to frontend
    // - etc.
    
    // Mark as processed
    addToCache(messageId);
  } catch (error) {
    consumerStats.errors++;
    console.error(`[KAFKA CONSUMER] ❌ Error processing sale from Kafka (${data._id || data.saleId}):`, error.message);
    // Don't mark as processed on error - allows retry
    throw error; // Re-throw to let Kafka handle retry
  }
};

// Process Product from Kafka
const processProduct = async (data, topic, partition) => {
  const messageId = `${topic}-${partition}-${data._id || data.productId}`;
  
  if (isProcessed(messageId)) {
    consumerStats.duplicates++;
    console.log(`[KAFKA CONSUMER] ⚠️  Product already processed, skipping: ${data._id || data.productId}`);
    return;
  }

  try {
    consumerStats.products++;
    console.log(`[KAFKA CONSUMER] ✅ Consumed product from topic '${topic}': ${data._id || data.productId || 'N/A'} (Total products consumed: ${consumerStats.products})`);
    // Add your custom processing logic here
    addToCache(messageId);
  } catch (error) {
    consumerStats.errors++;
    console.error(`[KAFKA CONSUMER] ❌ Error processing product from Kafka (${data._id || data.productId}):`, error.message);
    throw error;
  }
};

// Process Client from Kafka
const processClient = async (data, topic, partition) => {
  const messageId = `${topic}-${partition}-${data._id || data.clientId}`;
  
  if (isProcessed(messageId)) {
    consumerStats.duplicates++;
    console.log(`[KAFKA CONSUMER] ⚠️  Client already processed, skipping: ${data._id || data.clientId}`);
    return;
  }

  try {
    consumerStats.clients++;
    console.log(`[KAFKA CONSUMER] ✅ Consumed client from topic '${topic}': ${data._id || data.clientId || 'N/A'} (Total clients consumed: ${consumerStats.clients})`);
    // Add your custom processing logic here
    addToCache(messageId);
  } catch (error) {
    consumerStats.errors++;
    console.error(`[KAFKA CONSUMER] ❌ Error processing client from Kafka (${data._id || data.clientId}):`, error.message);
    throw error;
  }
};

// Process Employee from Kafka
const processEmployee = async (data, topic, partition) => {
  const messageId = `${topic}-${partition}-${data._id || data.employeeId}`;
  
  if (isProcessed(messageId)) {
    consumerStats.duplicates++;
    console.log(`[KAFKA CONSUMER] ⚠️  Employee already processed, skipping: ${data._id || data.employeeId}`);
    return;
  }

  try {
    consumerStats.employees++;
    console.log(`[KAFKA CONSUMER] ✅ Consumed employee from topic '${topic}': ${data._id || data.employeeId || 'N/A'} (Total employees consumed: ${consumerStats.employees})`);
    // Add your custom processing logic here
    addToCache(messageId);
  } catch (error) {
    consumerStats.errors++;
    console.error(`[KAFKA CONSUMER] ❌ Error processing employee from Kafka (${data._id || data.employeeId}):`, error.message);
    throw error;
  }
};

// Process Payment from Kafka
const processPayment = async (data, topic, partition) => {
  const messageId = `${topic}-${partition}-${data._id || data.paymentId}`;
  
  if (isProcessed(messageId)) {
    consumerStats.duplicates++;
    console.log(`[KAFKA CONSUMER] ⚠️  Payment already processed, skipping: ${data._id || data.paymentId}`);
    return;
  }

  try {
    consumerStats.payments++;
    console.log(`[KAFKA CONSUMER] ✅ Consumed payment from topic '${topic}': ${data._id || data.paymentId || 'N/A'} (Total payments consumed: ${consumerStats.payments})`);
    // Add your custom processing logic here
    addToCache(messageId);
  } catch (error) {
    consumerStats.errors++;
    console.error(`[KAFKA CONSUMER] ❌ Error processing payment from Kafka (${data._id || data.paymentId}):`, error.message);
    throw error;
  }
};

// Process Analytics from Kafka
const processAnalytics = async (data, topic, partition) => {
  const messageId = `${topic}-${partition}-${JSON.stringify(data).substring(0, 100)}`;
  
  if (isProcessed(messageId)) {
    consumerStats.duplicates++;
    console.log(`[KAFKA CONSUMER] ⚠️  Analytics already processed, skipping`);
    return;
  }

  try {
    consumerStats.analytics++;
    console.log(`[KAFKA CONSUMER] ✅ Consumed analytics from topic '${topic}' (Total analytics consumed: ${consumerStats.analytics})`);
    // Add your custom processing logic here
    addToCache(messageId);
  } catch (error) {
    consumerStats.errors++;
    console.error('[KAFKA CONSUMER] ❌ Error processing analytics from Kafka:', error.message);
    throw error;
  }
};

// Start all consumers
const startConsumers = async () => {
  try {
    console.log('[KAFKA CONSUMER] 🚀 Starting Kafka Consumers...');
    
    const { subscribeToTopics } = require('../config/kafka');
    
    // Subscribe to all topics at once (before starting consumer.run())
    const topics = [
      TOPICS.SALES,
      TOPICS.PRODUCTS,
      TOPICS.CLIENTS,
      TOPICS.EMPLOYEES,
      TOPICS.PAYMENTS,
      TOPICS.ANALYTICS
    ];
    
    const callbacks = [
      processSale,
      processProduct,
      processClient,
      processEmployee,
      processPayment,
      processAnalytics
    ];
    
    await subscribeToTopics(topics, callbacks);
    
    // Log all subscribed topics
    topics.forEach(topic => {
      console.log(`[KAFKA CONSUMER] ✅ Subscribed to topic: ${topic}`);
    });
    
    console.log('[KAFKA CONSUMER] ✅ All Kafka Consumers started and ready to receive messages');
    console.log('[KAFKA CONSUMER] 📊 Consumer Statistics:', consumerStats);
  } catch (error) {
    console.error('[KAFKA CONSUMER] ❌ Error starting Kafka Consumers:', error.message);
    throw error;
  }
};

module.exports = {
  startConsumers,
  processSale,
  processProduct,
  processClient,
  processEmployee,
  processPayment,
  processAnalytics
};

