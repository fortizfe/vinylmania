'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { parseArgs } = require('../run-with-timeout');

const SCRIPT = path.join(__dirname, '..', 'run-with-timeout.js');

function runCli(args, { timeoutMs } = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
  });
}

test('parseArgs: accepts a well-formed invocation', () => {
  const parsed = parseArgs(['5', '--', 'node', '-e', '1']);
  assert.deepEqual(parsed, { maxSeconds: 5, command: 'node', commandArgs: ['-e', '1'] });
});

test('parseArgs: rejects a missing "--" separator', () => {
  assert.equal(parseArgs(['5', 'node', '-e', '1']), null);
});

test('parseArgs: rejects a non-numeric duration', () => {
  assert.equal(parseArgs(['soon', '--', 'node', '-e', '1']), null);
});

test('parseArgs: rejects a missing wrapped command', () => {
  assert.equal(parseArgs(['5', '--']), null);
});

test('CLI: exits 0 and forwards output when the wrapped command finishes before the limit', () => {
  const result = runCli(['5', '--', 'node', '-e', 'process.stdout.write("hello"); process.exit(0)']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'hello');
});

test('CLI: exits non-zero and names the command + limit when the wrapped command times out', () => {
  const result = runCli(
    ['1', '--', 'node', '-e', 'setTimeout(() => {}, 60_000)'],
    { timeoutMs: 10_000 },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /timed out after 1s/i);
  assert.match(result.stderr, /node/);
});

test('CLI: escalates to SIGKILL when the wrapped command ignores SIGTERM', () => {
  const result = runCli(
    [
      '1',
      '--',
      'node',
      '-e',
      "process.on('SIGTERM', () => {}); setTimeout(() => {}, 60_000)",
    ],
    { timeoutMs: 10_000 },
  );
  // The child must actually be gone within the wrapper's grace period —
  // spawnSync's own `timeoutMs` here is just a test-safety backstop, not
  // the thing under test. A non-null `status`/`signal` and prompt return
  // (well under 10s) both indicate the group was force-killed rather than
  // left running.
  assert.equal(result.error, undefined, 'the wrapper itself should not hang past its own grace period');
  assert.notEqual(result.status, 0);
});

test('CLI: prints usage and exits 2 on malformed arguments', () => {
  const result = runCli(['not-a-number', '--', 'node', '-e', '1']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
