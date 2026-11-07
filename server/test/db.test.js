const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, isDatabaseConnected } = require('../config/db');

function setUri(t, value) {
  const previous = process.env.MONGODB_URI;
  if (value === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = value;
  t.after(() => {
    if (previous === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previous;
  });
}

test('requires a connection URI before connecting', async t => {
  setUri(t, undefined);
  const connect = t.mock.method(mongoose, 'connect', async () => {});
  await assert.rejects(connectDB(), /MONGODB_URI is required/);
  assert.equal(connect.mock.callCount(), 0);
});

for (const uri of ['mongodb://localhost:27017/another_database', 'mongodb://localhost:27017']) {
  test(`refuses an unintended database: ${uri}`, async t => {
    setUri(t, uri);
    const connect = t.mock.method(mongoose, 'connect', async () => {});
    await assert.rejects(connectDB(), /must explicitly select lost_found_db/);
    assert.equal(connect.mock.callCount(), 0);
  });
}

test('invalid URI errors do not echo connection secrets', async t => {
  setUri(t, 'invalid://private-credential-value');
  await assert.rejects(connectDB(), error => /MONGODB_URI is invalid/.test(error.message) && !error.message.includes('private-credential-value'));
});

test('selects lost_found_db with collection creation and indexing disabled', async t => {
  const uri = 'mongodb://localhost:27017/lost_found_db';
  setUri(t, uri);
  const connect = t.mock.method(mongoose, 'connect', async () => {});
  t.mock.method(console, 'log', () => {});
  await connectDB();
  assert.equal(connect.mock.calls[0].arguments[0], uri);
  assert.deepEqual(connect.mock.calls[0].arguments[1], {
    dbName: 'lost_found_db', serverSelectionTimeoutMS: 5000, autoCreate: false, autoIndex: false,
  });
});

test('connection failures hide private driver details', async t => {
  setUri(t, 'mongodb://localhost:27017/lost_found_db');
  t.mock.method(mongoose, 'connect', async () => { throw new Error('private-credential-value'); });
  await assert.rejects(connectDB(), error => /MongoDB connection failed/.test(error.message) && !error.message.includes('private-credential-value'));
});

test('disconnected state is unhealthy without issuing a command', async () => {
  assert.equal(await isDatabaseConnected({ readyState: 0 }), false);
});

test('healthy status requires a live read-only ping', async () => {
  const connection = { readyState: 1, db: { command: async (command, options) => {
    assert.deepEqual(command, { ping: 1 });
    assert.equal(options.timeoutMS, 2000);
  } } };
  assert.equal(await isDatabaseConnected(connection), true);
});

test('failed ping is unhealthy even if cached state is connected', async () => {
  const connection = { readyState: 1, db: { command: async () => { throw new Error('network unavailable'); } } };
  assert.equal(await isDatabaseConnected(connection), false);
});
