const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const { createApp } = require('../app');
const { createUserModel } = require('../models/User');
const { createItemModel } = require('../models/Item');
const { loadAuthConfig } = require('../config/auth');
const { signSession } = require('../auth/session');

test('item APIs write only to the isolated MongoDB on port 27018', { skip: process.env.RUN_ITEM_INTEGRATION !== '1' }, async t => {
  assert.equal(process.env.AUTH_TEST_MONGODB_URI, 'mongodb://host.docker.internal:27018/lost_found_db');
  const connection = await mongoose.createConnection(process.env.AUTH_TEST_MONGODB_URI, { autoCreate: false, autoIndex: false }).asPromise();
  t.after(() => connection.close());
  // Auth regression tests assert their users collection count. Keep our fixtures separate.
  const User = connection.model('ItemTestUser', createUserModel(connection).schema, 'item_test_users');
  const Item = createItemModel(connection);
  const suffix = randomBytes(8).toString('hex');
  const users = await User.create(['user', 'user', 'admin'].map((role, i) => ({ name: `Item fixture ${i}`, email: `items-${suffix}-${i}@example.invalid`, password: 'not-a-login-fixture', role })));
  const config = loadAuthConfig({ JWT_SECRET: randomBytes(32).toString('hex'), AUTH_MODE: 'local', CLIENT_URL: 'http://localhost:18080' });
  const server = createApp({ config, User, Item }).listen(0, '0.0.0.0');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/items`;
  const request = (path = '', method = 'GET', body, user = users[0], overrides = {}) => fetch(base + path, {
    method, headers: { Origin: config.origin, 'Content-Type': 'application/json', 'X-CSRF-Protection': '1', ...(user ? { Cookie: `lf_session=${signSession(user._id, config)}` } : {}), ...overrides },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = { title: `Lost phone ${suffix}`, type: 'lost', category: 'Electronics', description: 'Distinctive blue case', location: 'Engineering Library', dateLostOrFound: '2026-01-01', color: 'Blue', brand: 'Example', image: '' };
  let id, foundId;
  await t.test('creates lost and found reports with server ownership and safe fields', async () => {
    for (const type of ['lost', 'found']) {
      const response = await request('', 'POST', { ...payload, type });
      assert.equal(response.status, 201);
      const { item } = await response.json();
      assert.equal(item.userId, String(users[0]._id)); assert.equal(item.status, 'open');
      assert.equal(item.password, undefined); assert.equal(item.__v, undefined);
      if (type === 'lost') id = item._id; else foundId = item._id;
    }
  });
  await t.test('public browsing, combined filters, literal search, stable pagination and empty results', async () => {
    const result = await (await request(`?search=${suffix}&type=lost&category=Electronics&location=library&status=open&limit=1&page=1&sort=oldest`, 'GET', undefined, null)).json();
    assert.equal(result.items.length, 1); assert.equal(result.items[0]._id, id); assert.equal(result.pagination.total, 1);
    const second = await (await request(`?search=${suffix}&limit=1&page=2`)).json(); assert.equal(second.items.length, 1); assert.equal(second.pagination.pages, 2);
    const empty = await (await request('?search=%2E%2A')).json(); assert.equal(empty.items.length, 0);
  });
  await t.test('mine is authenticated and uses the current user, never a supplied owner', async () => {
    assert.equal((await request('/mine', 'GET', undefined, null)).status, 401);
    assert.equal((await (await request(`/mine?search=${suffix}`)).json()).items.length, 2);
    assert.equal((await (await request(`/mine?search=${suffix}`, 'GET', undefined, users[1])).json()).items.length, 0);
    assert.equal((await request(`/mine?userId=${users[0]._id}`)).status, 400);
  });
  await t.test('public details return exactly the requested record', async () => {
    const result = await request(`/${id}`, 'GET', undefined, null); assert.equal(result.status, 200); assert.equal((await result.json()).item._id, id);
  });
  await t.test('owner edits fields and resolves/reopens without changing owner', async () => {
    for (const status of ['resolved', 'open']) {
      const response = await request(`/${id}`, 'PATCH', { title: `Updated ${suffix}`, status });
      assert.equal(response.status, 200); const { item } = await response.json(); assert.equal(item.status, status); assert.equal(item.userId, String(users[0]._id));
    }
  });
  await t.test('another user cannot edit or delete; exact database admin role can edit', async () => {
    const before = await Item.findById(id).lean();
    assert.equal((await request(`/${id}`, 'PATCH', { title: 'Stolen' }, users[1])).status, 403);
    assert.equal((await request(`/${id}`, 'DELETE', {}, users[1])).status, 403);
    assert.deepEqual(await Item.findById(id).lean(), before);
    assert.equal((await request(`/${id}`, 'PATCH', { brand: 'Admin correction' }, users[2])).status, 200);
  });
  await t.test('rejects unauthenticated writes', async () => {
    for (const [path, method, body] of [['', 'POST', payload], [`/${id}`, 'PATCH', { title: 'No' }], [`/${id}`, 'DELETE', {}]]) assert.equal((await request(path, method, body, null)).status, 401);
  });
  await t.test('CSRF header, exact origin and JSON required on all writes', async () => {
    for (const override of [{ 'X-CSRF-Protection': '' }, { Origin: 'http://evil.invalid' }, { Origin: '' }, { 'Content-Type': 'text/plain' }]) {
      for (const [path, method, body] of [['', 'POST', payload], [`/${id}`, 'PATCH', { title: 'No' }], [`/${id}`, 'DELETE', {}]]) assert.equal((await request(path, method, body, users[0], override)).status, 403);
    }
  });
  await t.test('rejects mass assignment, malformed fields, bad dates and unsafe images', async () => {
    for (const extra of [{ userId: String(users[1]._id) }, { status: 'resolved' }, { role: 'admin' }, { title: { $ne: '' } }, { title: 'x'.repeat(151) }, { dateLostOrFound: '2026-02-30' }, { dateLostOrFound: '2999-01-01' }, { image: 'javascript:alert(1)' }, { image: 'blob:http://localhost/preview' }, { category: 'Unknown' }]) assert.equal((await request('', 'POST', { ...payload, ...extra })).status, 400);
    for (const extra of [{}, { userId: String(users[1]._id) }, { createdAt: '2020-01-01' }, { $set: { title: 'Injected' } }, { status: 'claimed' }]) assert.equal((await request(`/${id}`, 'PATCH', extra)).status, 400);
  });
  await t.test('bounds queries and rejects operators, arrays and unknown parameters', async () => {
    for (const query of ['limit=51', 'page=0', 'page=1001', 'page=1.5', 'limit=1e2', 'sort=other', 'status=claimed', 'search[$ne]=x', 'search=a&search=b', `search=${'x'.repeat(101)}`, 'type[$ne]=lost']) assert.equal((await request('?' + query)).status, 400);
  });
  await t.test('invalid and missing IDs return 400/404 for detail/edit/delete', async () => {
    for (const [value, expected] of [['bad-id', 400], [String(new mongoose.Types.ObjectId()), 404]]) for (const method of ['GET', 'PATCH', 'DELETE']) assert.equal((await request(`/${value}`, method, method === 'GET' ? undefined : { title: 'Missing' })).status, expected);
  });
  await t.test('owner and admin can delete, and deleted records no longer appear', async () => {
    assert.equal((await request(`/${id}`, 'DELETE', {})).status, 204);
    assert.equal((await request(`/${id}`)).status, 404);
    assert.equal((await request(`/${foundId}`, 'DELETE', {}, users[2])).status, 204);
    assert.equal((await (await request(`?search=${suffix}`)).json()).pagination.total, 0);
  });
});
