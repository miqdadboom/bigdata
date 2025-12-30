const { Kafka, Partitioners } = require('kafkajs');

// Kafka Configuration
const kafka = new Kafka({
  clientId: 'bigdata-backend',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

// Create Producer
const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000,
  createPartitioner: Partitioners.LegacyPartitioner // Fix KafkaJS v2.0 warning
});

// Create Consumer
const consumer = kafka.consumer({
  groupId: 'bigdata-backend-consumer',
  allowAutoTopicCreation: true
});

// Topics
const TOPICS = {
  SALES: 'sales',
  SALE_ITEMS: 'sale_items',
  PRODUCTS: 'products',
  CLIENTS: 'clients',
  EMPLOYEES: 'employees',
  PAYMENTS: 'payments',
  ANALYTICS: 'analytics'
};

// Initialize Kafka connections
let isProducerConnected = false;
let isConsumerConnected = false;

const connectProducer = async () => {
  if (!isProducerConnected) {
    try {
      await producer.connect();
      isProducerConnected = true;
      console.log('[KAFKA PRODUCER] ✅ Connected to Kafka broker');
      console.log('[KAFKA PRODUCER] 📤 Ready to send messages to topics');
    } catch (error) {
      console.error('[KAFKA PRODUCER] ❌ Connection error:', error.message);
      throw error;
    }
  }
};

const connectConsumer = async () => {
  if (!isConsumerConnected) {
    try {
      await consumer.connect();
      isConsumerConnected = true;
      console.log('[KAFKA CONSUMER] ✅ Connected to Kafka broker');
      console.log('[KAFKA CONSUMER] 📥 Ready to receive messages from topics');
    } catch (error) {
      console.error('[KAFKA CONSUMER] ❌ Connection error:', error.message);
      throw error;
    }
  }
};

const disconnectProducer = async () => {
  if (isProducerConnected) {
    try {
      await producer.disconnect();
      isProducerConnected = false;
      console.log('SUCCESS: Kafka Producer disconnected');
    } catch (error) {
      console.error('ERROR: Kafka Producer disconnect error:', error.message);
    }
  }
};

const disconnectConsumer = async () => {
  if (isConsumerConnected) {
    try {
      await consumer.disconnect();
      isConsumerConnected = false;
      console.log('SUCCESS: Kafka Consumer disconnected');
    } catch (error) {
      console.error('ERROR: Kafka Consumer disconnect error:', error.message);
    }
  }
};

// Send message to Kafka
const sendMessage = async (topic, messages) => {
  try {
    await connectProducer();
    await producer.send({
      topic,
      messages: Array.isArray(messages) ? messages : [messages]
    });
    return true;
  } catch (error) {
    console.error(`ERROR: Error sending message to topic ${topic}:`, error.message);
    return false;
  }
};

// Topic callbacks map (to route messages to correct handler)
const topicCallbacks = new Map();

// Subscribe to multiple topics at once
const subscribeToTopics = async (topics, callbacks) => {
  try {
    await connectConsumer();
    
    // Store callbacks for each topic
    topics.forEach((topic, index) => {
      topicCallbacks.set(topic, callbacks[index]);
    });
    
    // Subscribe to all topics at once
    await consumer.subscribe({ 
      topics: topics,
      fromBeginning: false 
    });
    
    // Start consumer.run() only once
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const callback = topicCallbacks.get(topic);
          if (callback) {
            const value = JSON.parse(message.value.toString());
            await callback(value, topic, partition);
          } else {
            console.error(`[KAFKA CONSUMER] ⚠️  No callback found for topic: ${topic}`);
          }
        } catch (error) {
          console.error(`[KAFKA CONSUMER] ❌ Error processing message from topic ${topic}, partition ${partition}:`, error.message);
          // Re-throw to let Kafka handle retry (if configured)
          throw error;
        }
      }
    });
    
    return true;
  } catch (error) {
    console.error(`[KAFKA CONSUMER] ❌ Error subscribing to topics:`, error.message);
    throw error;
  }
};

// Legacy subscribe function (for backward compatibility, but deprecated)
const subscribe = async (topic, callback) => {
  console.warn(`[KAFKA CONSUMER] ⚠️  Using deprecated subscribe() for single topic. Use subscribeToTopics() instead.`);
  return subscribeToTopics([topic], [callback]);
};

module.exports = {
  kafka,
  producer,
  consumer,
  TOPICS,
  connectProducer,
  connectConsumer,
  disconnectProducer,
  disconnectConsumer,
  sendMessage,
  subscribe,
  subscribeToTopics,
  isProducerConnected: () => isProducerConnected,
  isConsumerConnected: () => isConsumerConnected
};

