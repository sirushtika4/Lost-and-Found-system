const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const database = require('./config/db');
const { loadAuthConfig } = require('./config/auth');
const { createUserModel } = require('./models/User');
const { createAuthRouter } = require('./routes/auth');
const { createItemModel } = require('./models/Item');
const { createItemRouter } = require('./routes/items');
const { createClaimRouter } = require('./routes/claims');
function createApp({ config = loadAuthConfig(), User = createUserModel(), Item = createItemModel(), authLimits } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.proxyIp) app.set('trust proxy', config.proxyIp);
  app.use(helmet({ strictTransportSecurity: config.secure ? undefined : false }));
  app.use((req, res, next) => {
    if (config.secure && !req.secure) return res.status(426).set('Cache-Control', 'no-store').json({ message: 'HTTPS is required.' });
    return next();
  });
  app.use(cors({ origin: config.origin, credentials: true, allowedHeaders: ['Content-Type', 'X-CSRF-Protection'] }));
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.get('/api/health', async (req, res) => {
    const connected = await database.isDatabaseConnected();
    res.set('Cache-Control', 'no-store');
    res.status(connected ? 200 : 503).json({ status: connected ? 'OK' : 'DEGRADED', service: 'Lost and Found API', database: connected ? 'connected' : 'disconnected' });
  });
  app.get('/', (req, res) => res.send('Lost & Found Community API is running.'));
  app.use('/api/auth', createAuthRouter({ config, User, limits: authLimits }));
  app.use('/api/items', createItemRouter({ config, User, Item }));
  app.use('/api/claims', createClaimRouter({ config, User, Item }));
  app.use((req, res) => res.status(404).json({ message: 'API route not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
    const unavailable = error.name?.startsWith('Mongo') || error.name === 'MongooseServerSelectionError';
    console.error(`API request failed (${unavailable ? 'database unavailable' : 'internal error'}).`);
    return res.status(unavailable ? 503 : 500).json({ message: unavailable ? 'Service temporarily unavailable. Please try again.' : 'Unable to complete the request.' });
  });
  return app;
}
module.exports = { createApp };
