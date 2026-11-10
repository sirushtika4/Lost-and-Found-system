const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const database = require('../config/db');
const { createApp } = require('../app');
const { loadAuthConfig } = require('../config/auth');
const app = createApp({ config: loadAuthConfig({ JWT_SECRET: require('node:crypto').randomBytes(32).toString('hex'), AUTH_MODE: 'local', CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173' }) });

async function serve(t) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

for (const connected of [true, false]) {
  test(`health returns ${connected ? '200 connected' : '503 disconnected'} without caching`, async t => {
    t.mock.method(database, 'isDatabaseConnected', async () => connected);
    const url = await serve(t);
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, connected ? 200 : 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      status: connected ? 'OK' : 'DEGRADED', service: 'Lost and Found API', database: connected ? 'connected' : 'disconnected',
    });
  });
}

test('preserves the root route and configured CORS origin', async t => {
  const url = await serve(t);
  const origin = process.env.CLIENT_URL || 'http://localhost:5173';
  const response = await fetch(url, { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'Lost & Found Community API is running.');
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
});
