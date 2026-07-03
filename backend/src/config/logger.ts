export type LogOutcome =
  | 'verified'
  | 'unauthorized'
  | 'error'
  | 'created'
  | 'reused'
  | 'success'
  | 'not_found'
  | 'rate_limited'
  | 'unavailable'
  | 'validation_error';

export interface LogEvent {
  route: string;
  outcome: LogOutcome;
  uid?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

function emit(level: 'info' | 'warn' | 'error', event: LogEvent): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...event,
  });

  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (event: LogEvent): void => emit('info', event),
  warn: (event: LogEvent): void => emit('warn', event),
  error: (event: LogEvent): void => emit('error', event),
};
