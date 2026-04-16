import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware that restricts access to internal Docker-network callers only.
 * Checks that the client IP is a private/loopback address.
 * Used for service-to-service endpoints (e.g. qa-loop-executor fetching AI config).
 */
export function requireInternalNetwork(req: Request, res: Response, next: NextFunction) {
  const allowedPrefixes = ['172.', '10.', '192.168.', '127.0.0.1', '::1', '::ffff:172.', '::ffff:10.', '::ffff:192.168.', '::ffff:127.0.0.1'];
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const isInternal = allowedPrefixes.some(prefix => clientIp.startsWith(prefix));

  if (!isInternal) {
    return res.status(403).json({
      error: 'This endpoint is only accessible from internal network',
      code: 'INTERNAL_ONLY',
    });
  }
  next();
}
