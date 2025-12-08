/**
 * Structured logging utility
 * Uses console for simplicity, can be replaced with Winston/Pino in production
 */
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export interface LogContext {
    [key: string]: any;
}
declare class Logger {
    private serviceName;
    private logLevel;
    private requestId?;
    constructor(serviceName: string, logLevel?: LogLevel);
    setRequestId(requestId: string): void;
    private shouldLog;
    private formatMessage;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error | any, context?: LogContext): void;
    metric(name: string, value: number, unit?: string, context?: LogContext): void;
}
export declare function createLogger(serviceName: string, logLevel?: LogLevel): Logger;
export declare function generateRequestId(): string;
export {};
//# sourceMappingURL=logger.d.ts.map