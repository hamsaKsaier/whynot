import { Request, Response, NextFunction } from 'express';
import { createLogger, generateRequestId } from '../../shared/logger/logger';

const logger = createLogger('gateway');

/**
 * Request logging middleware with request ID tracking
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = generateRequestId();
  logger.setRequestId(requestId);
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Store request ID in request object for use in handlers
  (req as any).requestId = requestId;
  
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel]('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration
    });
    
    // Log metrics
    logger.metric('request_duration', duration, 'ms', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode
    });
  });
  
  next();
}

