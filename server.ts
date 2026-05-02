import './src/server/env.js';
import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import helmet from "helmet";
import { apiRouter } from "./src/server/routes/api.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"],
      }
    }
  }));

  app.use(express.json({ limit: '1mb' }));

  // Request Correlation ID Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.headers['x-request-id'] as string);
    next();
  });

  // Structured request logging (method, path, status, latency, X-Request-ID)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const latency = Date.now() - start;
      console.log(JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        latencyMs: latency,
        requestId: req.headers['x-request-id'],
      }));
    });
    next();
  });

  // Mount the modular API router
  app.use("/api", apiRouter);

  // Health check
  app.get("/health", (req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      service: "casa-control-plane-node",
      config: {
        geminiConfigured: !!process.env.GEMINI_API_KEY?.trim(),
      }
    });
  });

  // ============================================================================
  // Vite Middleware (Development) / Static Serving (Production)
  // ============================================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // ============================================================================
  // Centralized Error Handler (must be last)
  // ============================================================================
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.headers['x-request-id'];
    console.error(JSON.stringify({
      level: 'error',
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId,
    }));
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', requestId });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CASA Control Plane Server running on http://localhost:${PORT}`);
  });
}

startServer();
