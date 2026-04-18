import { Router } from 'express';
import { SignJWT } from 'jose';
import fs from 'node:fs';
import path from 'node:path';
import { backendBridge } from '../services/backendBridge.js';
import { geminiService } from '../services/gemini.js';
import { requireAdminConfirmation } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';
import { JWT_ENCODED_SECRET } from '../lib/jwtSecret.js';
import {
  ChatRequestSchema,
  PolicyDryRunRequestSchema,
  AdminApplyPolicySchema,
  ContractErrorLogSchema,
} from '../schemas/contracts.js';

export const apiRouter = Router();

const ALLOWED_ROLES = ['operator', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

type ContractLogEntry = {
  endpoint: string;
  issues: string[];
  timestamp: string;
  requestId?: string;
};

const LOG_DIR = path.join(process.cwd(), 'data');
const CONTRACT_LOG_PATH = path.join(LOG_DIR, 'contract-error-log.json');

function ensureLogStore() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  if (!fs.existsSync(CONTRACT_LOG_PATH)) {
    fs.writeFileSync(CONTRACT_LOG_PATH, '[]', 'utf-8');
  }
}

function readContractLogs(): ContractLogEntry[] {
  ensureLogStore();

  try {
    const raw = fs.readFileSync(CONTRACT_LOG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ContractLogEntry[] : [];
  } catch {
    return [];
  }
}

function writeContractLogs(entries: ContractLogEntry[]) {
  ensureLogStore();
  fs.writeFileSync(CONTRACT_LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

apiRouter.post('/auth/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { role = 'operator', email = 'dev@casa.local' } = req.body;

  if (!(ALLOWED_ROLES as ReadonlyArray<string>).includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const token = await new SignJWT({ role: role as AllowedRole, email })
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

apiRouter.post('/logs/contract-error', async (req, res) => {
  try {
    const payload = ContractErrorLogSchema.parse(req.body);

    const entry: ContractLogEntry = {
      endpoint: payload.endpoint,
      issues: payload.issues,
      requestId: req.headers['x-request-id'] as string | undefined,
      timestamp: new Date().toISOString(),
    };

    const existing = readContractLogs();
    const next = [...existing, entry].slice(-1000);
    writeContractLogs(next);

    console.warn('[CASA CONTRACT LOG]', entry);

    res.json({ status: 'logged' });
  } catch (error: any) {
    res.status(400).json({ error: 'Invalid log schema', details: error });
  }
});

apiRouter.get('/logs/contract-error', async (req, res) => {
  try {
    const logs = readContractLogs();
    const recent = logs.slice(-50).reverse();

    res.json({
      total: logs.length,
      recent,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to read contract logs' });
  }
});

apiRouter.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, sessionId = 'default-session' } = ChatRequestSchema.parse(req.body);
    const reply = await geminiService.handleChat(sessionId, message, req.headers['x-request-id'] as string);
    res.json({ reply });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

apiRouter.post('/explain', authenticate, async (req, res) => {
  try {
    const { context, data } = req.body;
    if (!context || !data) {
      return res.status(400).json({ error: 'Missing context or data' });
    }
    const explanation = await geminiService.explainData(context, data);
    res.json({ explanation });
  } catch (error: any) {
    console.error('[API] Explain error:', error.message);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

apiRouter.post('/policy/analyze', authenticate, async (req, res) => {
  try {
    const { policyId, dryRunResult } = req.body;
    if (!policyId || !dryRunResult) {
      return res.status(400).json({ error: 'Missing policyId or dryRunResult' });
    }
    const analysis = await geminiService.analyzePolicy(policyId, dryRunResult);
    res.json(analysis);
  } catch (error: any) {
    console.error('[API] Policy analysis error:', error.message);
    res.status(500).json({ error: 'Failed to analyze policy' });
  }
});

apiRouter.post('/admin/policy/apply', requireAdminConfirmation, async (req, res) => {
  try {
    const { policyId, reason } = AdminApplyPolicySchema.parse(req.body);
    const result = await backendBridge.applyPolicy(policyId, reason, req.headers['x-request-id'] as string);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'Invalid request schema', details: error });
  }
});
