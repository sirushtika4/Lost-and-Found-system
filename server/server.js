const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const database = require('./config/db');

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

app.get('/api/health', async (req, res) => {
  const connected = await database.isDatabaseConnected();
  res.set('Cache-Control', 'no-store');
  res.status(connected ? 200 : 503).json({
    status: connected ? 'OK' : 'DEGRADED',
    service: 'Lost and Found API',
    database: connected ? 'connected' : 'disconnected',
  });
});

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
  await database.connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error(`Backend startup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
