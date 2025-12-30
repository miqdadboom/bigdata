const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bigdata';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`SUCCESS: MongoDB Connected: ${MONGODB_URI}`);
    console.log(` Database: bigdata`);
  } catch (error) {
    console.error('ERROR: MongoDB connection error:', error.message);
    console.error(' Make sure MongoDB is running on localhost:27017');
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('WARNING:  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('ERROR: MongoDB error:', err);
});

module.exports = connectDB;

