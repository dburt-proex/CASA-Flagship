import { Router } from 'express';
import { SignJWT } from 'jose';
import { backendBridge } from '../services/backendBridge.js';
import { geminiService } from '../services/gemini.js';
import { requireAdminConfirmation } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';
import { 
  ChatRequestSchema, 
  PolicyDryRunRequestSchema, 
  AdminApplyPolicySchema,
  ExplainRequestSchema,
  PolicyAnalyzeRequestSchema
} from '../schemas/contracts.js';
import { opsMetrics } from '../services/opsMetrics.js';
import { JWT_ENCODED_SECRET } from '../lib/jwtSecret.js';
import rateLimit from 'express-rate-limit';

export const apiRouter = Router();

// ============================================================================
// Rate Limiting & Metrics
// ============================================================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  validate: false
});

// Stricter limiter for the dev-login endpoint to prevent brute-force JWT generation.
const devLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." },
  validate: false
});

apiRouter.use(apiLimiter);

// Middleware to track route metrics
apiRouter.use((req, res, next) => {
  const route = req.path;
  opsMetrics.recordRouteRequest(route);
  
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      opsMetrics.recordRouteError(route);
    }
  });
  
  next();
});

// ============================================================================
// Ops Metrics Route — protected: admin only
// ============================================================================
apiRouter.get("/ops/metrics", authenticate, (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin role required' });
  }
  res.json(opsMetrics.getMetrics());
});

// ============================================================================
// Dev Auth Endpoint (Local Development Only)
// ============================================================================
apiRouter.post('/auth/dev-login', devLoginLimiter, async (req, res) => {
  const { role = 'operator', email = 'dev@casa.local' } = req.body;
  
  try {
    const token = await new SignJWT({ role, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .setSubject(email)
      .sign(JWT_ENCODED_SECRET);
      
    res.json({ token, user: { role, email } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate dev token' });
  }
});

// ============================================================================
// Read-Only Governance Endpoints
// ============================================================================

apiRouter.get('/dashboard', async (req, res, next) => {
  try {
    const data = await backendBridge.getDashboard(req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/stress', async (req, res, next) => {
  try {
    const data = await backendBridge.getBoundaryStress(req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/replay/:id', async (req, res, next) => {
  try {
    const data = await backendBridge.replayDecision(req.params.id, req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Simulation & AI Endpoints
// ============================================================================

apiRouter.post('/policy/dryrun', async (req, res, next) => {
  try {
    const payload = PolicyDryRunRequestSchema.parse(req.body);
    const data = await backendBridge.runDryRun(payload, req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request schema', details: error.issues });
    }
    next(error);
  }
});

apiRouter.post('/chat', authenticate, async (req, res, next) => {
  try {
    const { message, sessionId = 'default-session' } = ChatRequestSchema.parse(req.body);
    // Scope session to the authenticated user to prevent cross-user session leakage.
    if (!req.user?.sub) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User subject missing from token' });
    }
    const userScopedSessionId = `${req.user.sub}:${sessionId}`;
    const reply = await geminiService.handleChat(userScopedSessionId, message, req.headers['x-request-id'] as string);
    res.json({ reply });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request schema', details: error.issues });
    }
    next(error);
  }
});

apiRouter.post('/explain', authenticate, async (req, res, next) => {
  try {
    const { context, data } = ExplainRequestSchema.parse(req.body);
    const explanation = await geminiService.explainData(context, data);
    res.json({ explanation });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request schema', details: error.issues });
    }
    next(error);
  }
});

apiRouter.post('/policy/analyze', authenticate, async (req, res, next) => {
  try {
    const { policyId, dryRunResult } = PolicyAnalyzeRequestSchema.parse(req.body);
    const analysis = await geminiService.analyzePolicy(policyId, dryRunResult);
    res.json(analysis);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request schema', details: error.issues });
    }
    next(error);
  }
});

// ============================================================================
// Decision Store — singleton Map for process-lifetime persistence
// ============================================================================

interface Decision {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  status: string;
  liabilityGrade: string;
  riskScore: number;
  reason: string;
}

const decisionStore = new Map<string, Decision>([
  ['DEC-123', { id: 'DEC-123', timestamp: '2026-04-10T14:30:00Z', agent: 'support_agent', action: 'write_database', status: 'REVIEW', liabilityGrade: 'HIGH', riskScore: 85, reason: 'Policy threshold changed after boundary stress increase.' }],
  ['DEC-124', { id: 'DEC-124', timestamp: '2026-04-11T09:15:00Z', agent: 'billing_agent', action: 'issue_refund', status: 'REVIEW', liabilityGrade: 'CRITICAL', riskScore: 92, reason: 'Refund amount exceeds standard autonomous limit.' }],
  ['DEC-120', { id: 'DEC-120', timestamp: '2026-04-09T11:20:00Z', agent: 'support_agent', action: 'read_user_profile', status: 'ALLOW', liabilityGrade: 'LOW', riskScore: 12, reason: 'Standard read operation within bounds.' }],
  ['DEC-121', { id: 'DEC-121', timestamp: '2026-04-09T16:45:00Z', agent: 'marketing_agent', action: 'send_mass_email', status: 'HALT', liabilityGrade: 'CRITICAL', riskScore: 98, reason: 'Detected potential spam pattern. Halted by POL-089.' }],
]);

apiRouter.get('/decisions/flagged', authenticate, (req, res) => {
  const flagged = Array.from(decisionStore.values()).filter(d => d.status === 'REVIEW');
  res.json(flagged);
});

apiRouter.get('/decisions/history', authenticate, (req, res) => {
  const history = Array.from(decisionStore.values()).filter(d => d.status !== 'REVIEW');
  res.json(history);
});

apiRouter.post('/decisions/:id/review', authenticate, (req, res) => {
  const { action } = req.body; // 'APPROVE' or 'HALT'
  if (action !== 'APPROVE' && action !== 'HALT') {
    return res.status(400).json({ error: 'Invalid action. Must be APPROVE or HALT.' });
  }
  
  const decision = decisionStore.get(req.params.id);
  if (!decision) {
    return res.status(404).json({ error: 'Decision not found' });
  }

  decision.status = action === 'APPROVE' ? 'ALLOW' : 'HALT';
  res.json({ success: true, decision });
});

// ============================================================================
// Protected Admin Write Endpoints
// ============================================================================

apiRouter.post('/admin/policy/apply', requireAdminConfirmation, async (req, res, next) => {
  try {
    const { policyId, reason } = AdminApplyPolicySchema.parse(req.body);
    const result = await backendBridge.applyPolicy(policyId, reason, req.headers['x-request-id'] as string);
    res.json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request schema', details: error.issues });
    }
    // applyPolicy stub explicitly signals not-implemented via a well-known sentinel message
    if (error.message?.startsWith('NOT_IMPLEMENTED:')) {
      return res.status(501).json({ error: 'Not Implemented', message: error.message.slice('NOT_IMPLEMENTED:'.length).trim() });
    }
    next(error);
  }
});
