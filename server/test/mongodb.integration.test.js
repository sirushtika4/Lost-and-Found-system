const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { createApp } = require('../app');
const { loadAuthConfig } = require('../config/auth');
const app = createApp({ config: loadAuthConfig({ JWT_SECRET: require('node:crypto').randomBytes(32).toString('hex'), AUTH_MODE: 'local', CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173' }) });

test('real connection gives 200 and closing only that connection gives 503', {
  skip: process.env.RUN_MONGODB_INTEGRATION !== '1',
}, async t => {
  t.after(() => mongoose.disconnect());
  const connection = await connectDB();
  assert.equal(connection.name, 'lost_found_db');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/api/health`;
  let response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).database, 'connected');
  // Only close this test process's connection. Do not stop or modify MongoDB.
  await mongoose.disconnect();
  response = await fetch(url);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).database, 'disconnected');
});
