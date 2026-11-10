const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');
const { createUserModel } = require('../models/User');
const { loadAuthConfig } = require('../config/auth');
const { signSession } = require('../auth/session');

test('authentication APIs against an isolated temporary MongoDB only', { skip: process.env.RUN_AUTH_INTEGRATION !== '1' }, async t => {
  const uri = process.env.AUTH_TEST_MONGODB_URI;
  // No path to the Windows production server is permitted by this test harness.
  assert.equal(uri, 'mongodb://host.docker.internal:27018/lost_found_db');
  const connection = await mongoose.createConnection(uri, { autoCreate: false, autoIndex: false }).asPromise();
  t.after(() => connection.close());
  assert.equal(connection.host, 'host.docker.internal');
  const User = createUserModel(connection);
  await connection.db.createCollection('users');
  await connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
  const config = loadAuthConfig({ JWT_SECRET: randomBytes(32).toString('hex'), AUTH_MODE: 'local', CLIENT_URL: 'http://localhost:18080' });
  const app = createApp({ config, User, authLimits: { register: 100, login: 100 } });
  const server = app.listen(0, '0.0.0.0');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const headers = { Origin: config.origin, 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' };
  const password = 'A sufficiently long test password';
  const post = (route, body, extra = {}) => fetch(`${base}/${route}`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  let cookie, userId;

  await t.test('register normalizes email, forces user role, hashes password and sets private cookie', async () => {
    const response = await post('register', { name: 'Test Member', email: ' Member@Example.invalid ', password });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.user.email, 'member@example.invalid');
    assert.equal(body.user.role, 'user');
    assert.equal(body.token, undefined);
    assert.equal(body.user.password, undefined);
    cookie = response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(response.headers.get('set-cookie'), /SameSite=Strict/);
    assert.match(response.headers.get('set-cookie'), /Path=\/api/);
    assert.match(response.headers.get('set-cookie'), /Max-Age=900/);
    userId = body.user._id;
    const stored = await User.findById(userId).select('+password');
    assert.notEqual(stored.password, password);
    assert.equal(await bcrypt.compare(password, stored.password), true);
    assert.equal((await User.findById(userId)).password, undefined);
  });
  await t.test('duplicate email safely returns 409 without changing user', async () => {
    assert.equal((await post('register', { name: 'Duplicate', email: 'MEMBER@example.invalid', password })).status, 409);
    assert.equal(await User.countDocuments(), 1);
  });
  await t.test('rejects role injection, invalid types, short passwords and bcrypt byte overflow', async () => {
    for (const input of [
      { name: 'Role', email: 'role@example.invalid', password, role: 'admin' },
      { name: {}, email: 'type@example.invalid', password },
      { name: 'Short', email: 'short@example.invalid', password: 'short' },
      { name: 'Long', email: 'long@example.invalid', password: 'x'.repeat(73) },
      { name: 'Unicode', email: 'unicode@example.invalid', password: '😀'.repeat(19) },
    ]) assert.equal((await post('register', input)).status, 400);
    assert.equal(await User.countDocuments(), 1);
  });
  await t.test('unique index handles concurrent duplicate registration', async () => {
    const results = await Promise.all([1, 2].map(() => post('register', { name: 'Concurrent', email: 'race@example.invalid', password })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  });
  await t.test('current user requires cookie and returns an explicit password-free allowlist', async () => {
    assert.equal((await fetch(`${base}/me`)).status, 401);
    const response = await fetch(`${base}/me`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body.user).sort(), ['_id', 'email', 'joinedAt', 'name', 'phone', 'phoneNumber', 'profileImage', 'role'].sort());
    assert.equal(body.user._id, userId);
  });
  await t.test('login accepts existing cost-10 bcrypt hashes and preserves the full record', async () => {
    const legacyPassword = 'legacy-password';
    const legacyHash = await bcrypt.hash(legacyPassword, 10);
    const id = new mongoose.Types.ObjectId();
    await connection.db.collection('users').insertOne({ _id: id, name: 'Legacy Test', email: 'legacy@example.invalid', password: legacyHash, role: 'admin', phoneNumber: '', profileImage: '', createdAt: new Date(), updatedAt: new Date() });
    const before = await connection.db.collection('users').findOne({ _id: id });
    const response = await post('login', { email: 'LEGACY@example.invalid', password: legacyPassword });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.role, 'admin');
    assert.deepEqual(await connection.db.collection('users').findOne({ _id: id }), before);
  });
  await t.test('invalid credentials have the same generic response for known and unknown users', async () => {
    const wrong = await post('login', { email: 'member@example.invalid', password: 'incorrect' });
    const absent = await post('login', { email: 'absent@example.invalid', password: 'incorrect' });
    assert.equal(wrong.status, 401);
    assert.equal(absent.status, 401);
    assert.deepEqual(await wrong.json(), await absent.json());
  });
  await t.test('valid login establishes a session', async () => {
    const response = await post('login', { email: 'member@example.invalid', password });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /^lf_session=/);
  });
  await t.test('rejects invalid, expired, wrong-algorithm and deleted-user sessions', async () => {
    const expired = jwt.sign({}, config.secret, { algorithm: 'HS256', subject: userId, issuer: config.issuer, audience: config.audience, expiresIn: -1 });
    const wrongAlgorithm = jwt.sign({}, config.secret, { algorithm: 'HS384', subject: userId, issuer: config.issuer, audience: config.audience, expiresIn: 60 });
    for (const token of ['invalid', expired, wrongAlgorithm, signSession(new mongoose.Types.ObjectId(), config)]) {
      const response = await fetch(`${base}/me`, { headers: { Cookie: `lf_session=${token}` } });
      assert.equal(response.status, 401);
      assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    }
  });
  await t.test('rejects forged CSRF requests before database writes, including logout', async () => {
    const count = await User.countDocuments();
    for (const extra of [{ Origin: 'http://evil.invalid' }, { Origin: 'null' }, { 'X-CSRF-Protection': '' }, { 'Content-Type': 'text/plain' }]) {
      assert.equal((await post('register', { name: 'Forgery', email: 'forged@example.invalid', password }, extra)).status, 403);
      assert.equal((await post('logout', {}, { Cookie: cookie, ...extra })).status, 403);
    }
    const missingOrigin = await fetch(`${base}/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' }, body: '{}' });
    assert.equal(missingOrigin.status, 403);
    assert.equal(await User.countDocuments(), count);
  });
  await t.test('logout clears cookie with matching options; stateless copies remain valid until expiry', async () => {
    const response = await post('logout', {}, { Cookie: cookie });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(response.headers.get('set-cookie'), /SameSite=Strict/);
    assert.match(response.headers.get('set-cookie'), /Path=\/api/);
    assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    assert.equal((await fetch(`${base}/me`)).status, 401);
    assert.equal((await fetch(`${base}/me`, { headers: { Cookie: cookie } })).status, 200);
  });
  await t.test('profile PATCH updates only the caller name/phone and preserves hashes, identity and other users', async () => {
    const collection = connection.db.collection('users');
    const before = await collection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    const otherUsers = await collection.find({ _id: { $ne: before._id } }).sort({ _id: 1 }).toArray();
    const patch = (body, extra = {}) => fetch(`${base}/me`, { method: 'PATCH', headers: { ...headers, Cookie: cookie, ...extra }, body: JSON.stringify(body) });
    const response = await patch({ name: ' Updated Member ', phoneNumber: ' 123456789 ' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), null);
    const result = (await response.json()).user;
    assert.equal(result.name, 'Updated Member'); assert.equal(result.phoneNumber, '123456789'); assert.equal(result.password, undefined);
    const after = await collection.findOne({ _id: before._id });
    for (const key of Object.keys(before).filter(key => !['name', 'phoneNumber', 'updatedAt'].includes(key))) assert.deepEqual(after[key], before[key]);
    assert.deepEqual(await collection.find({ _id: { $ne: before._id } }).sort({ _id: 1 }).toArray(), otherUsers);
    assert.equal((await (await fetch(`${base}/me`, { headers: { Cookie: cookie } })).json()).user.name, 'Updated Member');
    assert.equal((await patch({ phoneNumber: '' })).status, 200);
    assert.equal((await patch({ name: 'Final Member' })).status, 200);
    assert.equal((await collection.findOne({ _id: before._id })).phoneNumber, '');
    const saved = await collection.findOne({ _id: before._id });
    for (const body of [{}, { name: '' }, { name: 'x'.repeat(101) }, { phoneNumber: null }, { phoneNumber: 'x'.repeat(31) }, { name: { $ne: '' } },
      { role: 'admin' }, { password: 'new secret' }, { email: 'new@example.invalid' }, { _id: String(otherUsers[0]._id) }, { userId: String(otherUsers[0]._id) }, { profileImage: 'https://example.invalid/image.jpg' }, { updatedAt: '2000-01-01' }]) assert.equal((await patch(body)).status, 400);
    assert.deepEqual(await collection.findOne({ _id: before._id }), saved);
    for (const extra of [{ Cookie: '' }, { Cookie: 'lf_session=invalid' }]) assert.equal((await patch({ name: 'Unauthorized' }, extra)).status, 401);
    for (const extra of [{ Origin: '' }, { Origin: 'http://evil.invalid' }, { 'X-CSRF-Protection': '' }, { 'Content-Type': 'text/plain' }]) assert.equal((await patch({ name: 'Forged' }, extra)).status, 403);
    assert.deepEqual(await collection.findOne({ _id: before._id }), saved);
    assert.deepEqual(await collection.find({ _id: { $ne: before._id } }).sort({ _id: 1 }).toArray(), otherUsers);
  });
  await t.test('login and registration rate limits return 429', async () => {
    const limited = createApp({ config, User, authLimits: { login: 2, register: 1 } }).listen(0, '127.0.0.1');
    await once(limited, 'listening');
    try {
      const url = `http://127.0.0.1:${limited.address().port}/api/auth`;
      for (let n = 0; n < 2; n++) assert.equal((await fetch(`${url}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'absent@example.invalid', password }) })).status, 401);
      const response = await fetch(`${url}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'absent@example.invalid', password }) });
      assert.equal(response.status, 429);
      assert.ok(response.headers.get('retry-after'));
      assert.equal((await fetch(`${url}/register`, { method: 'POST', headers, body: '{}' })).status, 400);
      assert.equal((await fetch(`${url}/register`, { method: 'POST', headers, body: '{}' })).status, 429);
    } finally { limited.closeAllConnections(); await new Promise(resolve => limited.close(resolve)); }
  });
});
