import { Router } from 'express';
import { pythonBridge } from '../services/pythonBridge';
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
// Read-Only Governance Endpoints
// ============================================================================

apiRouter.get('/dashboard', async (req, res) => {
  try {
    const data = await pythonBridge.getDashboard(req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/stress', async (req, res) => {
  try {
    const data = await pythonBridge.getBoundaryStress(req.headers['x-request-id'] as string);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/replay/:id', async (req, res) => {
  try {
    const data = await pythonBridge.replayDecision(req.params.id, req.headers['x-request-id'] as string);
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
    const data = await pythonBridge.runDryRun(payload, req.headers['x-request-id'] as string);
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
    const result = await pythonBridge.applyPolicy(policyId, reason, req.headers['x-request-id'] as string);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'Invalid request schema', details: error });
  }
});
