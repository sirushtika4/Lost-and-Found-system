const mongoose = require('mongoose');

const DATABASE_NAME = 'lost_found_db';

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required and must select lost_found_db.');

  // Validate the target without opening a connection or printing credentials.
  let selectedDatabase;
  try {
    selectedDatabase = new mongoose.mongo.MongoClient(uri).options.dbName;
  } catch {
    throw new Error('MONGODB_URI is invalid. Check the private connection configuration.');
  }
  if (selectedDatabase !== DATABASE_NAME) {
    throw new Error('MONGODB_URI must explicitly select lost_found_db; refusing another database.');
  }

  try {
    await mongoose.connect(uri, {
      dbName: DATABASE_NAME,
      serverSelectionTimeoutMS: 5000,
      autoCreate: false,
      autoIndex: false,
    });
    console.log(`MongoDB connected: ${DATABASE_NAME}`);
    return mongoose.connection;
  } catch {
    throw new Error('MongoDB connection failed. Check host access, authentication and MONGODB_URI.');
  }
}

async function isDatabaseConnected(connection = mongoose.connection) {
  if (connection.readyState !== 1 || !connection.db) return false;
  try {
    await connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
    return connection.readyState === 1;
  } catch {
    return false;
  }
}

module.exports = { connectDB, isDatabaseConnected };
