import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  messageKey?: string;
  messageParams?: Record<string, any>;
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    statusCode: (err as AppError).statusCode
  });

  const statusCode = (err as AppError).statusCode || 500;
  const t = (req as any).t ?? ((key: string) => key);

  const appErr = err as AppError;
  let message = err.message || t('errors:server.internal');
  if (appErr.messageKey) {
    message = t(appErr.messageKey, appErr.messageParams || {});
  }

  const errorResponse: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  if (env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
    if ((err as AppError).details) {
      errorResponse.details = (err as AppError).details;
    }
  }

  if ((err as AppError).code === 'ECONNREFUSED') {
    errorResponse.error = t('errors:service.unavailable');
    errorResponse.suggestion = t('errors:server.serviceUnavailableSuggestion');
  } else if ((err as AppError).code === 'ETIMEDOUT') {
    errorResponse.error = t('errors:service.timeout');
    errorResponse.suggestion = t('errors:server.timeoutSuggestion');
  }

  res.status(statusCode).json(errorResponse);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any,
  messageKey?: string,
  messageParams?: Record<string, any>
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  error.messageKey = messageKey;
  error.messageParams = messageParams;
  return error;
}
