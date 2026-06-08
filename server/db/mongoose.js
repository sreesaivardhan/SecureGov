'use strict';

const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas via Mongoose.
 * Throws on failure so the server process exits immediately with a clear message.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined. Check your server/.env file.');
  }

  try {
    await mongoose.connect(uri, {
      // Mongoose 8 no longer needs useNewUrlParser / useUnifiedTopology
    });

    const host = mongoose.connection.host;
    console.log(`✅  MongoDB connected  →  ${host}`);

    // Log connection events after initial connect
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️   MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅  MongoDB reconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB error:', err.message);
    });

  } catch (err) {
    // Re-throw so start() in server.js can exit the process
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
}

module.exports = { connectDB };
