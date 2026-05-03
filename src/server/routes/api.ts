import { Router } from 'express';
import { SignJWT } from 'jose';
import { backendBridge } from '../services/backendBridge.js';
import { geminiService } from '../services/gemini.js';
import { requireAdminConfirmation } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';
import { 
  ChatRequestSchema, 
  PolicyDryRunRequestSchema, 
  AdminApplyPolicySchema 
} from '../schemas/contracts.js';
import { opsMetrics } from '../services/opsMetrics.js';
import rateLimit from 'express-rate-limit';

export const apiRouter = Router();

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests" }, validate: false });
apiRouter.use(apiLimiter);

apiRouter.post('/evaluate', async (req, res) => {
  try {
    const result = await backendBridge.evaluateAction(req.body, req.headers['x-request-id'] as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/dashboard', async (req, res) => {
  try {
    const data = await backendBridge.getDashboard(req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/stress', async (req, res) => {
  try {
    const data = await backendBridge.getBoundaryStress(req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
