const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const { createAuthRouter } = require('./auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Lost and Found API',
    database: app.locals.users ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', createAuthRouter(() => app.locals.users));

app.get('/', (req, res) => {
  res.send('Lost & Found Community API is running.');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server',
  });
});

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }

  const mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await mongoClient.connect();
  const database = mongoClient.db(process.env.MONGODB_DATABASE || 'lost_found');
  app.locals.users = database.collection('users');
  await app.locals.users.createIndex({ email: 1 }, { unique: true });

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await mongoClient.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Unable to start server:', error.message);
  process.exitCode = 1;
});

module.exports = app;
