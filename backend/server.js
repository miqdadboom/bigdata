const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { connectProducer } = require('./config/kafka');
const { startConsumers } = require('./services/kafkaConsumer');
require('dotenv').config();

// Import routes
const categoryRoutes = require('./routes/CRUD/categoryRoutes');
const clientRoutes = require('./routes/CRUD/clientRoutes');
const employeeRoutes = require('./routes/CRUD/employeeRoutes');
const productRoutes = require('./routes/CRUD/productRoutes');
const saleRoutes = require('./routes/CRUD/saleRoutes');
const saleItemRoutes = require('./routes/CRUD/saleItemRoutes');
const paymentRoutes = require('./routes/CRUD/paymentRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const ingestionRoutes = require('./routes/ingestionRoutes');
const authRoutes = require('./routes/CRUD/authRoutes');
const kafkaRoutes = require('./routes/kafkaRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Big Data Backend API is running',
    database: 'MongoDB',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/sale-items', saleItemRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ingestion', ingestionRoutes);
app.use('/api/kafka', kafkaRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Connect to MongoDB and start server
connectDB().then(async () => {
  console.log('='.repeat(60));
  console.log('🚀 Starting Big Data Backend Services...');
  console.log('='.repeat(60));
  
  // Connect to Kafka Producer 
  try {
    await connectProducer();
    console.log('[BACKEND]  Kafka Producer connected and ready');
  } catch (error) {
    console.warn('[BACKEND]   Kafka Producer not available, continuing without Kafka:', error.message);
  }

  // Start Kafka Consumer 
  try {
    await startConsumers();
    console.log('[BACKEND]  Kafka Consumer started and ready');
  } catch (error) {
    console.warn('[BACKEND]  Kafka Consumer not available, continuing without Consumer:', error.message);
  }

  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`✅ Backend Server running at http://localhost:${PORT}`);
    console.log(`✅ MongoDB Database: bigdata`);
    console.log(`✅ API Base URL: http://localhost:${PORT}/api`);
    console.log('='.repeat(60));
    console.log('📊 Pipeline Status:');
    console.log('   📤 Producer: Ready to send messages to Kafka');
    console.log('   📥 Consumer: Ready to receive messages from Kafka');
    console.log('   🔄 Flow: API → Producer → Kafka → Consumer → Processing');
    console.log('='.repeat(60));
  });
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

module.exports = app;

