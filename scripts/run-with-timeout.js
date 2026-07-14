#!/usr/bin/env node
'use strict';

// Cross-platform replacement for the POSIX `timeout` coreutil: bounds a
// wrapped command's wall-clock time and escalates SIGTERM -> SIGKILL on its
// full process group if it doesn't exit in time. Chosen over `timeout` /
// `gtimeout` because GNU coreutils isn't installed by default on macOS
// (this project's confirmed local dev platform) — see
// specs/042-firebase-emulator-reliability/research.md §3.
//
// The same SIGTERM -> SIGKILL escalation also fires when *this* wrapper
// receives an external interrupt (Ctrl+C during a stuck local run), which
// is what bounds `firebase-tools`' own flaky graceful-shutdown path (the
// `write EPIPE` loop from research.md §9) to a short, fixed grace period
// instead of letting it run indefinitely.

const { spawn } = require('node:child_process');

const GRACE_PERIOD_MS = 5000;
const TIMEOUT_EXIT_CODE = 124; // matches the POSIX `timeout` convention

function printUsageAndExit() {
  process.stderr.write('Usage: node run-with-timeout.js <maxSeconds> -- <command> [args...]\n');
  process.exit(2);
}

function parseArgs(argv) {
  const [maxSecondsArg, separator, ...commandParts] = argv;
  const maxSeconds = Number(maxSecondsArg);

  if (
    !maxSecondsArg ||
    !Number.isFinite(maxSeconds) ||
    maxSeconds <= 0 ||
    separator !== '--' ||
    commandParts.length === 0
  ) {
    return null;
  }

  const [command, ...commandArgs] = commandParts;
  return { maxSeconds, command, commandArgs };
}

function killGroup(pid, signal) {
  try {
    // Negative pid targets the whole process group `spawn(..., { detached:
    // true })` creates, so the emulator's JVM child process gets reaped
    // too, not just the immediate `firebase`/`playwright` process.
    process.kill(-pid, signal);
  } catch {
    // Group is already gone — nothing left to signal.
  }
}

function runWithTimeout({ maxSeconds, command, commandArgs }) {
  const commandLabel = [command, ...commandArgs].join(' ');
  const child = spawn(command, commandArgs, { stdio: 'inherit', detached: true });

  let settled = false;
  let timedOut = false;
  let timeoutId;
  let graceTimeoutId;
  const signalHandlers = [];

  const cleanup = () => {
    clearTimeout(timeoutId);
    clearTimeout(graceTimeoutId);
    for (const { signal, handler } of signalHandlers) {
      process.removeListener(signal, handler);
    }
  };

  const finish = (code) => {
    if (settled) return;
    settled = true;
    cleanup();
    process.exitCode = code;
  };

  const escalate = (signal) => {
    if (settled) return;
    killGroup(child.pid, signal);
    if (signal === 'SIGTERM') {
      graceTimeoutId = setTimeout(() => escalate('SIGKILL'), GRACE_PERIOD_MS);
    }
  };

  timeoutId = setTimeout(() => {
    timedOut = true;
    process.stderr.write(`run-with-timeout: timed out after ${maxSeconds}s waiting for: ${commandLabel}\n`);
    escalate('SIGTERM');
  }, maxSeconds * 1000);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => escalate('SIGTERM');
    process.on(signal, handler);
    signalHandlers.push({ signal, handler });
  }

  child.on('exit', (code, signal) => {
    if (timedOut) {
      finish(TIMEOUT_EXIT_CODE);
      return;
    }
    finish(code !== null ? code : 1);
  });

  child.on('error', (err) => {
    process.stderr.write(`run-with-timeout: failed to start command: ${err.message}\n`);
    finish(1);
  });
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    printUsageAndExit();
    return;
  }

  runWithTimeout(parsed);
}

module.exports = { parseArgs };

if (require.main === module) {
  main();
}
