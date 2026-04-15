import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, generateRequestId, LogLevel } from '../logger/logger';

describe('Logger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    delete process.env.LOG_LEVEL;
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log level filtering', () => {
    it('logs info and above at default INFO level', () => {
      const logger = createLogger('test');
      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg', new Error('e'));

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('logs all levels at DEBUG', () => {
      const logger = createLogger('test', LogLevel.DEBUG);
      logger.debug('debug');
      logger.info('info');
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it('logs only errors at ERROR level', () => {
      const logger = createLogger('test', LogLevel.ERROR);
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e', new Error('err'));
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('logs warn and above at WARN level', () => {
      const logger = createLogger('test', LogLevel.WARN);
      logger.info('i');
      logger.warn('w');
      logger.error('e', new Error('err'));
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('respects LOG_LEVEL env var over constructor param', () => {
      process.env.LOG_LEVEL = 'error';
      const logger = createLogger('test', LogLevel.DEBUG);
      logger.debug('d');
      logger.info('i');
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('JSON output format', () => {
    it('includes required fields', () => {
      const logger = createLogger('my-service', LogLevel.DEBUG);
      logger.info('hello');
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.level).toBe('INFO');
      expect(output.service).toBe('my-service');
      expect(output.message).toBe('hello');
      expect(output.timestamp).toBeDefined();
    });

    it('includes context when provided', () => {
      const logger = createLogger('svc', LogLevel.DEBUG);
      logger.info('msg', { userId: '123' });
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.userId).toBe('123');
    });

    it('includes requestId when set', () => {
      const logger = createLogger('svc', LogLevel.DEBUG);
      logger.setRequestId('req-abc');
      logger.info('msg');
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.requestId).toBe('req-abc');
    });

    it('omits requestId when not set', () => {
      const logger = createLogger('svc', LogLevel.DEBUG);
      logger.info('msg');
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.requestId).toBeUndefined();
    });
  });

  describe('error logging', () => {
    it('captures error details', () => {
      const logger = createLogger('svc', LogLevel.DEBUG);
      const err = new Error('test error');
      (err as any).code = 'ERR_TEST';
      logger.error('something failed', err);
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(output.error.message).toBe('test error');
      expect(output.error.name).toBe('Error');
      expect(output.error.code).toBe('ERR_TEST');
      expect(output.error.stack).toBeDefined();
    });

    it('handles non-Error objects', () => {
      const logger = createLogger('svc', LogLevel.DEBUG);
      logger.error('failed', 'string error');
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(output.error.message).toBe('string error');
    });

    it('includes additional context alongside error', () => {
      const logger = createLogger('svc', LogLevel.DEBUG);
      logger.error('failed', new Error('e'), { route: '/api' });
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(output.route).toBe('/api');
      expect(output.error).toBeDefined();
    });
  });

  describe('metric logging', () => {
    it('logs metric with default unit', () => {
      const logger = createLogger('svc');
      logger.metric('response_time', 42);
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.message).toBe('METRIC: response_time');
      expect(output.metric).toBe('response_time');
      expect(output.value).toBe(42);
      expect(output.unit).toBe('ms');
    });

    it('logs metric with custom unit', () => {
      const logger = createLogger('svc');
      logger.metric('memory', 512, 'MB');
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.unit).toBe('MB');
    });

    it('includes context in metric log', () => {
      const logger = createLogger('svc');
      logger.metric('cpu', 80, '%', { host: 'web-1' });
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.host).toBe('web-1');
    });
  });
});

describe('LogLevel enum', () => {
  it('has correct values', () => {
    expect(LogLevel.DEBUG).toBe('debug');
    expect(LogLevel.INFO).toBe('info');
    expect(LogLevel.WARN).toBe('warn');
    expect(LogLevel.ERROR).toBe('error');
  });
});

describe('generateRequestId', () => {
  it('starts with "req-"', () => {
    expect(generateRequestId()).toMatch(/^req-/);
  });

  it('includes timestamp and random string', () => {
    const id = generateRequestId();
    const parts = id.split('-');
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(Number(parts[1])).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);
  });
});
