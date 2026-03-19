"use strict";
/**
 * Structured logging utility
 * Uses console for simplicity, can be replaced with Winston/Pino in production
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.createLogger = createLogger;
exports.generateRequestId = generateRequestId;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(serviceName, logLevel = LogLevel.INFO) {
        this.serviceName = serviceName;
        this.logLevel = process.env.LOG_LEVEL || logLevel;
    }
    setRequestId(requestId) {
        this.requestId = requestId;
    }
    shouldLog(level) {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const logEntry = {
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
    debug(message, context) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
        }
    }
    info(message, context) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.log(this.formatMessage(LogLevel.INFO, message, context));
        }
    }
    warn(message, context) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage(LogLevel.WARN, message, context));
        }
    }
    error(message, error, context) {
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
    metric(name, value, unit = 'ms', context) {
        this.info(`METRIC: ${name}`, {
            ...context,
            metric: name,
            value,
            unit
        });
    }
}
// Create logger instances for each service
function createLogger(serviceName, logLevel) {
    return new Logger(serviceName, logLevel);
}
// Request ID generator
function generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=logger.js.map