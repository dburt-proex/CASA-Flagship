import './src/server/env.js';
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import { apiRouter } from "./src/server/routes/api.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // ============================================================================
  // Production JWT Secret Validation
  // ============================================================================
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'default-secret-do-not-use-in-prod' || secret === 'your-256-bit-secret') {
      console.error('[FATAL] JWT_SECRET is not configured for production. Exiting.');
      process.exit(1);
    }
  }

  // ============================================================================
  // Security Middleware
  // ============================================================================
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 100,             // 100 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 20,                    // 20 auth attempts per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' },
  });

  app.use(express.json({ limit: '1mb' }));

  // Request Correlation ID Middleware
  app.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.headers['x-request-id']);
    next();
  });

  // Apply rate limiters
  app.use("/api/auth", authLimiter);
  app.use("/api", apiLimiter);

  // Mount the modular API router
  app.use("/api", apiRouter);

  // Health check
  app.get("/health", (req, res) => {
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CASA Control Plane Server running on http://localhost:${PORT}`);
  });
}

startServer();
