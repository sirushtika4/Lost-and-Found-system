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

test('claims use only temporary MongoDB port 27018', { skip: process.env.RUN_CLAIM_INTEGRATION !== '1' }, async t => {
  assert.equal(process.env.AUTH_TEST_MONGODB_URI, 'mongodb://host.docker.internal:27018/lost_found_db');
  const connection = await mongoose.createConnection(process.env.AUTH_TEST_MONGODB_URI, { autoCreate: false, autoIndex: false }).asPromise();
  t.after(() => connection.close());
  // Separate fixtures avoid the auth suite's fresh users counts and the item suite's queries.
  const User = connection.model('ClaimTestUser', createUserModel(connection).schema, 'claim_test_users');
  const Item = connection.model('ClaimTestItem', createItemModel(connection).schema, 'claim_test_items');
  const users = await User.create(['Reporter', 'Claimant', 'Other', 'Outsider'].map((name, i) => ({ name, email: `claim-${randomBytes(8).toString('hex')}-${i}@example.invalid`, password: 'unused-fixture-hash', role: i === 3 ? 'admin' : 'user' })));
  const [reporter, claimant, other, outsider] = users;
  const config = loadAuthConfig({ JWT_SECRET: randomBytes(32).toString('hex'), AUTH_MODE: 'local', CLIENT_URL: 'http://localhost:18080' });
  const server = createApp({ config, User, Item }).listen(0, '0.0.0.0');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', body, user = claimant, extra = {}) => fetch(base + path, { method,
    headers: { Origin: config.origin, 'Content-Type': 'application/json', 'X-CSRF-Protection': '1', ...(user ? { Cookie: `lf_session=${signSession(user._id, config)}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const newItem = (extra = {}) => Item.create({ title: 'Claim fixture', description: 'Unrelated claim fixture', type: 'found', category: 'Keys', location: 'Library', dateLostOrFound: '2026-01-01', userId: reporter._id, ...extra });
  const body = item => ({ itemId: String(item._id), explanation: 'A distinctive blue key tag identifies my keys.', evidence: 'Blue triangle on the back' });
  const submit = (item, user = claimant) => request('/claims', 'POST', body(item), user);
  const decide = (id, status, user = reporter) => request(`/claims/${id}/status`, 'PATCH', { status }, user);
  const item = await newItem();
  let claimId;
  await t.test('creation stores private evidence and session ownership; public items never expose it', async () => {
    const response = await submit(item); assert.equal(response.status, 201);
    const claim = (await response.json()).claim; claimId = claim._id;
    assert.equal(claim.claimantId, String(claimant._id)); assert.equal(claim.status, 'pending');
    assert.equal(claim.reviewedAt, null); assert.equal(claim.reviewerId, null);
    const normal = await Item.findById(item._id); assert.equal(normal.claims, undefined);
    for (const path of [`/items/${item._id}`, '/items']) {
      const text = await (await request(path, 'GET', undefined, null)).text();
      assert.ok(!text.includes('explanation')); assert.ok(!text.includes('Blue triangle')); assert.ok(!text.includes('claimantId'));
    }
  });
  await t.test('duplicate active submissions are atomic, including repeated concurrent clicks', async () => {
    assert.equal((await submit(item)).status, 409);
    const fresh = await newItem();
    const responses = await Promise.all([submit(fresh), submit(fresh)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
    assert.equal((await Item.findById(fresh._id).select('+claims')).claims.length, 1);
  });
  await t.test('requires authentication, eligible found item, and a different reporter', async () => {
    assert.equal((await submit(item, null)).status, 401);
    assert.equal((await submit(item, reporter)).status, 403);
    for (const extra of [{ type: 'lost' }, { status: 'resolved' }]) assert.equal((await submit(await newItem(extra))).status, 409);
    assert.equal((await request('/claims', 'POST', { ...body(item), itemId: String(new mongoose.Types.ObjectId()) })).status, 404);
  });
  await t.test('mine/received lists are private, paginated and filterable', async () => {
    const mine = await (await request('/claims/mine?limit=1&page=1&status=pending')).json();
    assert.equal(mine.claims.length, 1); assert.ok(mine.pagination.total >= 2);
    const received = await (await request('/claims/received', 'GET', undefined, reporter)).json();
    assert.ok(received.claims.some(claim => claim._id === claimId));
    for (const path of ['/claims/mine', '/claims/received']) {
      assert.equal((await request(path, 'GET', undefined, null)).status, 401);
      assert.equal((await (await request(path, 'GET', undefined, outsider)).json()).claims.length, 0);
    }
    assert.equal((await request(`/claims/${claimId}`)).status, 200);
    assert.equal((await request(`/claims/${claimId}`, 'GET', undefined, reporter)).status, 200);
    assert.equal((await request(`/claims/${claimId}`, 'GET', undefined, other)).status, 403);
    assert.equal((await request(`/claims/${claimId}`, 'GET', undefined, outsider)).status, 403);
  });
  await t.test('only reporter reviews; terminal decisions cannot be changed; rejected claimant may resubmit', async () => {
    for (const user of [claimant, other, outsider]) assert.equal((await decide(claimId, 'approved', user)).status, 403);
    assert.equal((await decide(claimId, 'pending')).status, 400);
    assert.equal((await decide(claimId, 'rejected')).status, 200);
    const rejected = (await (await request(`/claims/${claimId}`)).json()).claim;
    assert.equal(rejected.status, 'rejected'); assert.equal(rejected.reviewerId, String(reporter._id)); assert.ok(rejected.reviewedAt);
    assert.equal((await decide(claimId, 'approved')).status, 409);
    const response = await submit(item); assert.equal(response.status, 201); claimId = (await response.json()).claim._id;
  });
  await t.test('concurrent approvals produce exactly one winner, reject pending competitors and resolve item', async () => {
    const otherClaim = (await (await submit(item, other)).json()).claim;
    const results = await Promise.all([decide(claimId, 'approved'), decide(otherClaim._id, 'approved')]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const stored = await Item.findById(item._id).select('+claims +approvedClaimId');
    assert.equal(stored.status, 'resolved'); assert.equal(stored.claims.filter(c => c.status === 'approved').length, 1);
    assert.equal(stored.claims.filter(c => c.status === 'pending').length, 0);
    assert.equal(String(stored.approvedClaimId), String(stored.claims.find(c => c.status === 'approved')._id));
    assert.ok(stored.claims.every(c => c.reviewedAt && String(c.reviewerId) === String(reporter._id)));
    assert.equal((await submit(item)).status, 409);
    assert.equal((await request(`/items/${item._id}`, 'PATCH', { status: 'open' }, reporter)).status, 409);
    assert.equal((await request(`/items/${item._id}`, 'DELETE', {}, reporter)).status, 409);
    assert.equal((await request(`/items/${item._id}`, 'PATCH', { type: 'lost' }, reporter)).status, 409);
  });
  await t.test('pending claims protect item state, type and history while descriptions remain editable', async () => {
    const fresh = await newItem(); await submit(fresh);
    for (const patch of [{ status: 'resolved' }, { type: 'lost' }]) assert.equal((await request(`/items/${fresh._id}`, 'PATCH', patch, reporter)).status, 409);
    assert.equal((await request(`/items/${fresh._id}`, 'DELETE', {}, reporter)).status, 409);
    assert.equal((await request(`/items/${fresh._id}`, 'PATCH', { color: 'Blue' }, reporter)).status, 200);
    assert.equal((await request(`/items/${fresh._id}`, 'PATCH', { claims: [] }, reporter)).status, 400);
  });
  await t.test('concurrent delete, type change and resolve cannot orphan an accepted claim', async () => {
    for (const [method, patch] of [['DELETE', {}], ['PATCH', { type: 'lost' }], ['PATCH', { status: 'resolved' }]]) {
      const fresh = await newItem();
      const [created, changed] = await Promise.all([submit(fresh), request(`/items/${fresh._id}`, method, patch, reporter)]);
      if (created.status === 201) {
        assert.equal(changed.status, 409); const stored = await Item.findById(fresh._id).select('+claims'); assert.equal(stored.type, 'found'); assert.equal(stored.status, 'open'); assert.equal(stored.claims.length, 1);
      } else { assert.ok([404, 409].includes(created.status)); assert.ok([200, 204].includes(changed.status)); }
    }
  });
  await t.test('validates IDs, pagination, evidence lengths, input types and privileged field assignment', async () => {
    for (const extra of [{ itemId: 'bad-id' }, { explanation: 'short' }, { explanation: { $ne: '' } }, { evidence: 'x'.repeat(1001) }, { claimantId: String(other._id) }, { reviewerId: String(reporter._id) }, { status: 'approved' }, { submittedAt: '2026-01-01' }]) assert.equal((await request('/claims', 'POST', { ...body(item), ...extra })).status, 400);
    for (const query of ['page=0', 'limit=51', 'status=other', 'status[$ne]=pending', 'page=1&page=2', 'itemId=ignored']) assert.equal((await request('/claims/mine?' + query)).status, 400);
    assert.equal((await request('/claims/not-id')).status, 400);
    assert.equal((await request('/claims/' + new mongoose.Types.ObjectId())).status, 404);
    assert.equal((await request('/claims/not-id/status', 'PATCH', { status: 'approved' }, reporter)).status, 400);
  });
  await t.test('all claim mutations require exact Origin, JSON and CSRF header', async () => {
    for (const override of [{ Origin: '' }, { Origin: 'http://evil.invalid' }, { 'X-CSRF-Protection': '' }, { 'Content-Type': 'text/plain' }]) {
      assert.equal((await request('/claims', 'POST', body(item), claimant, override)).status, 403);
      assert.equal((await request(`/claims/${claimId}/status`, 'PATCH', { status: 'approved' }, reporter, override)).status, 403);
    }
  });
  await t.test('per-item history limit rejects additional claims without trimming history', async () => {
    const claims = Array.from({ length: 100 }, () => ({ claimantId: other._id, explanation: 'Historical rejected claim', status: 'rejected', submittedAt: new Date() }));
    const full = await newItem({ claims }); assert.equal((await submit(full)).status, 409);
    assert.equal((await Item.findById(full._id).select('+claims')).claims.length, 100);
  });
});

test('database network failures on claim operations return sanitized 503', async t => {
  const config = loadAuthConfig({ JWT_SECRET: randomBytes(32).toString('hex'), AUTH_MODE: 'local', CLIENT_URL: 'http://localhost:18080' });
  const user = { _id: new mongoose.Types.ObjectId(), role: 'user' };
  const failure = () => { throw new mongoose.mongo.MongoNetworkError('private connection details must not leak'); };
  const server = createApp({ config, User: { findById: async () => user }, Item: { findById: failure, findOne: failure, aggregate: failure } }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/claims`;
  const headers = { Origin: config.origin, 'Content-Type': 'application/json', 'X-CSRF-Protection': '1', Cookie: `lf_session=${signSession(user._id, config)}` };
  for (const [path, method, body] of [['/mine', 'GET'], ['/received', 'GET'], ['/' + new mongoose.Types.ObjectId(), 'GET'], ['', 'POST', { itemId: String(new mongoose.Types.ObjectId()), explanation: 'A valid explanation' }], ['/' + new mongoose.Types.ObjectId() + '/status', 'PATCH', { status: 'approved' }]]) {
    const response = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { message: 'Service temporarily unavailable. Please try again.' });
  }
});

test('disconnected claims database fails promptly before buffered user queries', async t => {
  const config = loadAuthConfig({ JWT_SECRET: randomBytes(32).toString('hex'), AUTH_MODE: 'local', CLIENT_URL: 'http://localhost:18080' });
  const server = createApp({ config, User: { findById: () => assert.fail('Must not buffer a user lookup') }, Item: { db: { readyState: 0 } } }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/claims/mine`);
  assert.equal(response.status, 503); assert.equal((await response.json()).message, 'Service temporarily unavailable. Please try again.');
});
