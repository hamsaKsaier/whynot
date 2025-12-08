/**
 * Structured logging utility
 * Uses console for simplicity, can be replaced with Winston/Pino in production
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  [key: string]: any;
}

class Logger {
  private serviceName: string;
  private logLevel: LogLevel;
  private requestId?: string;

  constructor(serviceName: string, logLevel: LogLevel = LogLevel.INFO) {
    this.serviceName = serviceName;
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || logLevel;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry: any = {
      timestamp,
      level: level.toUpperCase(),
      service: this.serviceName,
      message
    };

    if (this.requestId) {
      logEntry.requestId = this.requestId;
    }

    if (context) {
      Object.assign(logEntry, context);
    }

    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = {
        ...context,
        error: {
          message: error?.message || error,
          stack: error?.stack,
          name: error?.name,
          code: error?.code
        }
      };
      console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
    }
  }

  // Metrics logging
  metric(name: string, value: number, unit: string = 'ms', context?: LogContext): void {
    this.info(`METRIC: ${name}`, {
      ...context,
      metric: name,
      value,
      unit
    });
  }
}

// Create logger instances for each service
export function createLogger(serviceName: string, logLevel?: LogLevel): Logger {
  return new Logger(serviceName, logLevel);
}

// Request ID generator
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}









