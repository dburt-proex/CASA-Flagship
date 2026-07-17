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
import { ZodError } from 'zod';
import { opsMetrics } from '../services/opsMetrics.js';
import rateLimit from 'express-rate-limit';
import { getJwtSecret, DEV_LOGIN_ENABLED, DEBUG_ROUTES_ENABLED } from '../config/security.js';
import { PolicyApplyNotImplementedError } from '../services/backendBridge.js';

export const apiRouter = Router();
const JWT_SECRET = getJwtSecret();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  validate: false
});

apiRouter.use(apiLimiter);

apiRouter.use((req, res, next) => {
  const route = req.path;
  opsMetrics.recordRouteRequest(route);
  res.on('finish', () => {
    if (res.statusCode >= 400) opsMetrics.recordRouteError(route);
  });
  next();
});

apiRouter.get("/ops/metrics", (req, res) => {
  res.json(opsMetrics.getMetrics());
});

apiRouter.get('/debug-env', authenticate, (req, res) => {
  if (!DEBUG_ROUTES_ENABLED) return res.status(404).json({ error: 'Not found' });
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin authentication required' });
  }
  const keyCount = Object.keys(process.env).length;
  const sensitiveKeyCount = Object.keys(process.env).filter((key) => /key|secret|token|password/i.test(key)).length;
  res.json({
    nodeEnv: process.env.NODE_ENV,
    keyCount,
    sensitiveKeyCount,
    hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
    hasCasaGeminiApiKey: Boolean(process.env['gemini-casa-api']?.trim() || process.env.GEMINI_CASA_API?.trim())
  });
});

apiRouter.post('/auth/dev-login', async (req, res) => {
  if (!DEV_LOGIN_ENABLED) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { role = 'operator', email = 'dev@casa.local' } = req.body;
  try {
    const token = await new SignJWT({ role, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .setSubject(email)
      .sign(JWT_SECRET);
    res.json({ token, user: { role, email } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate dev token' });
  }
});

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

apiRouter.get('/replay/:id', async (req, res) => {
  try {
    const data = await backendBridge.replayDecision(req.params.id, req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/policy/dryrun', async (req, res) => {
  try {
    const payload = PolicyDryRunRequestSchema.parse(req.body);
    const data = await backendBridge.runDryRun(payload, req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: 'Invalid request schema', details: error });
  }
});

apiRouter.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, sessionId = 'default-session' } = ChatRequestSchema.parse(req.body);
    const reply = await geminiService.handleChat(sessionId, message, req.headers['x-request-id'] as string);
    res.json({ reply });
  } catch (error: any) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: 'Failed to generate response', details: error.message });
  }
});

apiRouter.post('/explain', authenticate, async (req, res) => {
  try {
    const { context, data } = req.body;
    if (!context || !data) return res.status(400).json({ error: 'Missing context or data' });
    const explanation = await geminiService.explainData(context, data);
    res.json({ explanation });
  } catch (error: any) {
    console.error('[API] Explain error:', error.message);
    res.status(500).json({ error: 'Failed to generate explanation', details: error.message });
  }
});

apiRouter.post('/policy/analyze', authenticate, async (req, res) => {
  try {
    const { policyId, dryRunResult } = req.body;
    if (!policyId || !dryRunResult) return res.status(400).json({ error: 'Missing policyId or dryRunResult' });
    const analysis = await geminiService.analyzePolicy(policyId, dryRunResult);
    res.json(analysis);
  } catch (error: any) {
    console.error('[API] Policy analysis error:', error.message);
    res.status(500).json({ error: 'Failed to analyze policy' });
  }
});

const MOCK_DECISIONS = [
  { id: 'DEC-123', timestamp: '2026-04-10T14:30:00Z', agent: 'support_agent', action: 'write_database', status: 'REVIEW', liabilityGrade: 'HIGH', riskScore: 85, reason: 'Policy threshold changed after boundary stress increase.' },
  { id: 'DEC-124', timestamp: '2026-04-11T09:15:00Z', agent: 'billing_agent', action: 'issue_refund', status: 'REVIEW', liabilityGrade: 'CRITICAL', riskScore: 92, reason: 'Refund amount exceeds standard autonomous limit.' },
  { id: 'DEC-120', timestamp: '2026-04-09T11:20:00Z', agent: 'support_agent', action: 'read_user_profile', status: 'ALLOW', liabilityGrade: 'LOW', riskScore: 12, reason: 'Standard read operation within bounds.' },
  { id: 'DEC-121', timestamp: '2026-04-09T16:45:00Z', agent: 'marketing_agent', action: 'send_mass_email', status: 'HALT', liabilityGrade: 'CRITICAL', riskScore: 98, reason: 'Detected potential spam pattern. Halted by POL-089.' }
];

apiRouter.get('/decisions/flagged', authenticate, (req, res) => {
  res.json(MOCK_DECISIONS.filter(d => d.status === 'REVIEW'));
});

apiRouter.get('/decisions/history', authenticate, (req, res) => {
  res.json(MOCK_DECISIONS.filter(d => d.status !== 'REVIEW'));
});

apiRouter.post('/decisions/:id/review', authenticate, (req, res) => {
  const { action } = req.body;
  if (action !== 'APPROVE' && action !== 'HALT') return res.status(400).json({ error: 'Invalid action. Must be APPROVE or HALT.' });
  const decision = MOCK_DECISIONS.find(d => d.id === req.params.id);
  if (!decision) return res.status(404).json({ error: 'Decision not found' });
  decision.status = action === 'APPROVE' ? 'ALLOW' : 'HALT';
  res.json({ success: true, decision });
});

apiRouter.post('/admin/policy/apply', requireAdminConfirmation, async (req, res) => {
  try {
    const { policyId, reason } = AdminApplyPolicySchema.parse(req.body);
    const result = await backendBridge.applyPolicy(policyId, reason, req.headers['x-request-id'] as string);
    res.json(result);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid request schema', details: error.flatten() });
    }
    if (error instanceof PolicyApplyNotImplementedError) {
      return res.status(501).json({ error: 'Not Implemented', message: error.message });
    }
    return res.status(500).json({ error: 'Failed to apply policy', message: error?.message || 'Unknown error' });
  }
});
