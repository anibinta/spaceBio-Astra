import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createApiRouter } from './routes/api';
import { ApiValidationError } from './validators';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Attach requestId and measure server response time
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqWithId = req as Request & { requestId?: string };
    reqWithId.requestId = randomUUID().slice(0, 8);
    const start = performance.now();
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const elapsed = (performance.now() - start).toFixed(2);
      if (!res.headersSent) {
        res.setHeader('X-Response-Time-Ms', elapsed);
        res.setHeader('X-Request-Id', reqWithId.requestId!);
      }
      return originalJson(body);
    };
    next();
  });

  app.use('/api/v1', createApiRouter());

  // 404 handler for unknown /api routes
  app.use('/api', (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId ?? 'unknown';
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route API introuvable : ${req.method} ${req.originalUrl}`,
        requestId,
      },
    });
  });

  // Structured error handler
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = (req as Request & { requestId?: string }).requestId ?? 'unknown';

    if (err instanceof ApiValidationError) {
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId,
        },
      });
    }

    const message =
      err instanceof Error ? err.message : 'Erreur interne inattendue du serveur';
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
        requestId,
      },
    });
  });

  return app;
}
