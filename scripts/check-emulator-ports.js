#!/usr/bin/env node
'use strict';

// Preflight check run before `firebase emulators:exec` in both backend/ and
// e2e/ (spec 042, FR-006): backend and e2e default to the same fixed
// emulator ports (backend/firebase.json), so a concurrent run of the other
// package on the same machine previously failed with whatever generic
// message Firebase CLI happened to produce, if any. This fails fast with an
// explicit, identifying message instead.

const net = require('node:net');
const path = require('node:path');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(err.code !== 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findPortConflicts(ports) {
  const conflicts = [];
  for (const { name, port } of ports) {
    // eslint-disable-next-line no-await-in-loop -- ports checked sequentially; there are only two.
    const available = await isPortAvailable(port);
    if (!available) {
      conflicts.push({ name, port });
    }
  }
  return conflicts;
}

async function main() {
  const firebaseConfigPath = path.join(__dirname, '..', 'backend', 'firebase.json');
  // eslint-disable-next-line global-require, import/no-dynamic-require -- fixed, repo-local path.
  const firebaseConfig = require(firebaseConfigPath);

  const ports = [
    { name: 'auth', port: firebaseConfig.emulators.auth.port },
    { name: 'firestore', port: firebaseConfig.emulators.firestore.port },
  ];

  const conflicts = await findPortConflicts(ports);

  if (conflicts.length > 0) {
    const details = conflicts.map(({ name, port }) => `${name} emulator port ${port}`).join(', ');
    process.stderr.write(
      `check-emulator-ports: ${details} already in use.\n` +
        'Another Firebase-emulator-backed test run (backend or e2e `npm test`) is ' +
        'likely still active on this machine. Stop it before retrying, or wait for ' +
        'it to finish — backend and e2e share the same fixed emulator ports ' +
        '(backend/firebase.json).\n',
    );
    process.exitCode = 1;
    return;
  }
}

module.exports = { isPortAvailable, findPortConflicts };

if (require.main === module) {
  main();
}
