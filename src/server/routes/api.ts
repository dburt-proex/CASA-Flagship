import { Router } from 'express';
import { SignJWT } from 'jose';
import { backendBridge } from '../services/backendBridge';
import { geminiService } from '../services/gemini';
import { requireAdminConfirmation } from '../middleware/audit';
import { authenticate } from '../middleware/auth';
import { 
  ChatRequestSchema, 
  PolicyDryRunRequestSchema, 
  AdminApplyPolicySchema 
} from '../schemas/contracts';

export const apiRouter = Router();

// ============================================================================
// Dev Auth Endpoint (Local Development Only)
// ============================================================================
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-do-not-use-in-prod');

apiRouter.post('/auth/dev-login', async (req, res) => {
  const { role = 'operator', email = 'dev@casa.local' } = req.body;
  
  try {
    const token = await new SignJWT({ role, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .setSubject(email)
      .sign(JWT_SECRET);
      
    res.json({ token, user: { role, email } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate dev token' });
  }
});

// ============================================================================
// Read-Only Governance Endpoints
// ============================================================================

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

// ============================================================================
// Simulation & AI Endpoints
// ============================================================================

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
    console.error("Chat error:", error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// ============================================================================
// Protected Admin Write Endpoints
// ============================================================================

apiRouter.post('/admin/policy/apply', requireAdminConfirmation, async (req, res) => {
  try {
    const { policyId, reason } = AdminApplyPolicySchema.parse(req.body);
    const result = await backendBridge.applyPolicy(policyId, reason, req.headers['x-request-id'] as string);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'Invalid request schema', details: error });
  }
});
