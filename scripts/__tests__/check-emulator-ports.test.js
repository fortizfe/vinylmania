'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { isPortAvailable, findPortConflicts } = require('../check-emulator-ports');

function listenOnEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('isPortAvailable: resolves true for a free port', async () => {
  const server = await listenOnEphemeralPort();
  const { port } = server.address();
  await closeServer(server);

  assert.equal(await isPortAvailable(port), true);
});

test('isPortAvailable: resolves false for a port already bound', async () => {
  const server = await listenOnEphemeralPort();
  const { port } = server.address();

  try {
    assert.equal(await isPortAvailable(port), false);
  } finally {
    await closeServer(server);
  }
});

test('findPortConflicts: reports the specific name and port of each bound port, leaves free ports out', async () => {
  const bound = await listenOnEphemeralPort();
  const boundPort = bound.address().port;
  const free = await listenOnEphemeralPort();
  const freePort = free.address().port;
  await closeServer(free);

  try {
    const conflicts = await findPortConflicts([
      { name: 'auth', port: boundPort },
      { name: 'firestore', port: freePort },
    ]);

    assert.deepEqual(conflicts, [{ name: 'auth', port: boundPort }]);
  } finally {
    await closeServer(bound);
  }
});

test('findPortConflicts: returns an empty list when every port is free', async () => {
  const free = await listenOnEphemeralPort();
  const freePort = free.address().port;
  await closeServer(free);

  const conflicts = await findPortConflicts([{ name: 'auth', port: freePort }]);

  assert.deepEqual(conflicts, []);
});
