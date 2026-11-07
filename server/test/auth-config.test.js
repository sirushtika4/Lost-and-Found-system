const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { loadAuthConfig, cookieOptions } = require('../config/auth');
const { signSession, verifySession } = require('../auth/session');
const secret = randomBytes(32).toString('hex');
const local = { JWT_SECRET: secret, AUTH_MODE: 'local', CLIENT_URL: 'http://localhost:8080' };

test('session config requires a strong private key', () => {
  assert.throws(() => loadAuthConfig({ ...local, JWT_SECRET: '' }), /JWT_SECRET/);
  assert.throws(() => loadAuthConfig({ ...local, JWT_SECRET: 'short' }), /JWT_SECRET/);
});
test('production requires HTTPS and secure HttpOnly cookies', () => {
  assert.throws(() => loadAuthConfig({ ...local, AUTH_MODE: 'production' }), /HTTPS/);
  const config = loadAuthConfig({ ...local, AUTH_MODE: 'production', CLIENT_URL: 'https://campus.example' });
  assert.deepEqual(cookieOptions(config), { httpOnly: true, secure: true, sameSite: 'strict', path: '/api' });
});
test('local mode cannot enable insecure cookies on external origins', () => {
  assert.throws(() => loadAuthConfig({ ...local, CLIENT_URL: 'http://campus.example' }), /loopback/);
  assert.equal(cookieOptions(loadAuthConfig(local)).secure, false);
});
test('production rejects HTTP and trusts TLS forwarding only from an explicitly configured proxy IP', async t => {
  const { once } = require('node:events');
  const { createApp } = require('../app');
  const config = loadAuthConfig({ ...local, AUTH_MODE: 'production', CLIENT_URL: 'https://campus.example' });
  assert.throws(() => loadAuthConfig({ ...local, TRUSTED_PROXY_IP: 'true' }), /TRUSTED_PROXY_IP/);
  assert.throws(() => loadAuthConfig({ ...local, TRUSTED_PROXY_IP: '0.0.0.0' }), /TRUSTED_PROXY_IP/);
  for (const trusted of [false, true]) {
    const server = createApp({ config: { ...config, proxyIp: trusted ? '127.0.0.1' : undefined } }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const url = `http://127.0.0.1:${server.address().port}/api/auth/logout`;
    const response = await fetch(url, { method: 'POST', headers: { Origin: config.origin,
      'Content-Type': 'application/json', 'X-CSRF-Protection': '1', 'X-Forwarded-Proto': 'https' }, body: '{}' });
    assert.equal(response.status, trusted ? 204 : 426);
    if (trusted) assert.match(response.headers.get('set-cookie'), /Secure/);
  }
});
test('session JWT verifies subject, issuer, audience, algorithm, lifetime and signature', () => {
  const config = loadAuthConfig(local);
  const id = '507f1f77bcf86cd799439011';
  const token = signSession(id, config);
  assert.equal(verifySession(token, config), id);
  assert.throws(() => verifySession(token, { ...config, secret: randomBytes(32).toString('hex') }));
  for (const overrides of [{ issuer: 'wrong' }, { audience: 'wrong' }, { algorithm: 'HS384' }, { expiresIn: -1 }, { subject: 'not-an-id' }, { expiresIn: 3600 }]) {
    const forged = jwt.sign({}, secret, { algorithm: 'HS256', issuer: config.issuer, audience: config.audience, subject: id, expiresIn: config.ttl, ...overrides });
    assert.throws(() => verifySession(forged, config));
  }
  const noExpiry = jwt.sign({}, secret, { issuer: config.issuer, audience: config.audience, subject: id });
  assert.throws(() => verifySession(noExpiry, config));
});
