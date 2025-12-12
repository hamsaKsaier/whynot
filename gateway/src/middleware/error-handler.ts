import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    statusCode: (err as AppError).statusCode
  });

  // Determine status code
  const statusCode = (err as AppError).statusCode || 500;
  
  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Add details in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
    if ((err as AppError).details) {
      errorResponse.details = (err as AppError).details;
    }
  }

  // Handle specific error types
  if ((err as AppError).code === 'ECONNREFUSED') {
    errorResponse.error = 'Service unavailable';
    errorResponse.suggestion = 'The requested service is not available. Please try again later.';
  } else if ((err as AppError).code === 'ETIMEDOUT') {
    errorResponse.error = 'Request timeout';
    errorResponse.suggestion = 'The request took too long to complete. Please try again or check if the service is overloaded.';
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a custom error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}














