import { GoogleGenAI, Type, Content } from '@google/genai';
import { backendBridge } from './backendBridge';
import Redis from 'ioredis';

// ============================================================================
// Configuration & Startup Validation
// ============================================================================
const rawApiKey = process.env.GEMINI_API_KEY?.trim();

if (!rawApiKey) {
  console.warn('[WARNING] GEMINI_API_KEY is missing or blank. Chat features will not work until configured.');
} else {
  console.log(`[STARTUP] Gemini API Key configured. Prefix: ${rawApiKey.substring(0, 4)}...`);
}

const ai = new GoogleGenAI({ apiKey: rawApiKey || 'UNCONFIGURED_KEY' });

// Redis Session Storage
const redisUrl = process.env.REDIS_URL;
const isLocalRedis = !redisUrl || redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1');

let redis: Redis | null = null;
if (!isLocalRedis) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null // Do not retry if connection fails
  });
  redis.on('error', (err) => {
    console.warn('[Redis] Connection error:', err.message);
  });
} else {
  console.log('[STARTUP] Using in-memory session storage (Redis not configured or local)');
}

const memoryStore = new Map<string, string>();
const SESSION_TTL_SEC = 60 * 60; // 1 hour

async function getChatHistory(sessionId: string): Promise<Content[]> {
  try {
    if (redis) {
      const data = await redis.get(`chat:${sessionId}`);
      return data ? JSON.parse(data) : [];
    }
  } catch (err) {
    console.warn('[Redis] Failed to get chat history, falling back to memory');
  }
  
  const data = memoryStore.get(`chat:${sessionId}`);
  return data ? JSON.parse(data) : [];
}

async function saveChatHistory(sessionId: string, history: Content[]) {
  const data = JSON.stringify(history);
  try {
    if (redis) {
      await redis.setex(`chat:${sessionId}`, SESSION_TTL_SEC, data);
      return;
    }
  } catch (err) {
    console.warn('[Redis] Failed to save chat history, falling back to memory');
  }
  
  memoryStore.set(`chat:${sessionId}`, data);
}

// ============================================================================
// Timeout Helper
// ============================================================================
async function withTimeout<T>(promise: Promise<T>, ms: number = 15000): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

// ============================================================================
// Tool Declarations
// ============================================================================
const governanceTools = [{
  functionDeclarations: [
    {
      name: 'fetchDashboard',
      description: 'Fetches the current CASA system dashboard metrics including active policies and alerts.',
    },
    {
      name: 'fetchBoundaryStress',
      description: 'Fetches the current boundary stress analysis and critical boundary alerts.',
    },
    {
      name: 'runPolicyDryRun',
      description: 'Simulates a policy execution without affecting production.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          policyId: { type: Type.STRING, description: 'The ID of the policy to simulate (e.g., POL-102)' },
          environment: { type: Type.STRING, description: 'staging or production' }
        },
        required: ['policyId']
      }
    },
    {
      name: 'replayDecision',
      description: 'Fetches historical context for a specific decision ID.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          decisionId: { type: Type.STRING }
        },
        required: ['decisionId']
      }
    }
  ]
}];

// ============================================================================
// Tool Execution Router
// ============================================================================
async function executeTool(call: any, requestId?: string) {
  const { name, args } = call;
  console.log(`[Gemini Tool Call] Executing ${name} with args:`, args);

  try {
    switch (name) {
      case 'fetchDashboard':
        return await backendBridge.getDashboard(requestId);
      case 'fetchBoundaryStress':
        return await backendBridge.getBoundaryStress(requestId);
      case 'runPolicyDryRun':
        return await backendBridge.runDryRun({ 
          policyId: args.policyId, 
          parameters: {}, 
          environment: args.environment || 'staging' 
        }, requestId);
      case 'replayDecision':
        return await backendBridge.replayDecision(args.decisionId, requestId);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    // Normalize Zod errors for LLM consumption
    if (error.issues) {
      return { error: "Validation failed", details: error.issues };
    }
    return { error: error.message || "Unknown tool execution error" };
  }
}

// ============================================================================
// Gemini Service
// ============================================================================
export const geminiService = {
  async handleChat(sessionId: string, message: string, requestId?: string) {
    const history = await getChatHistory(sessionId);
    
    const chat = ai.chats.create({
      model: 'gemini-2.5-pro',
      history: history,
      config: {
        systemInstruction: `You are the CASA Operator Assistant. You help admins analyze governance policies, run dry-runs, and understand boundary stress analysis. 
        RULES:
        - NEVER hallucinate metrics. Use your tools to fetch real data.
        - If a tool fails, explicitly state the uncertainty.
        - Format responses clearly for an operator console.`,
        temperature: 0.2,
        tools: governanceTools,
      }
    });

    try {
      let response: any = await withTimeout(chat.sendMessage({ message }));

      // Handle Function Calling Loop
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        
        for (const call of response.functionCalls) {
          const result = await executeTool(call, requestId);
          functionResponses.push({
            name: call.name,
            response: result
          });
        }

        // Send the tool results back to the model
        response = await withTimeout(chat.sendMessage(functionResponses as any));
      }

      // Save updated history
      const updatedHistory = await chat.getHistory();
      await saveChatHistory(sessionId, updatedHistory);

      return response.text;
    } catch (error: any) {
      const errMsg = error.message || '';
      
      if (errMsg === 'GEMINI_TIMEOUT') {
        console.error(`[Gemini Error] Request timed out after 15s. RequestID: ${requestId}`);
        throw new Error("The AI service took too long to respond. Please try again.");
      }
      
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
        console.error(`[Gemini Error] Invalid API Key detected at runtime. RequestID: ${requestId}`);
        throw new Error("AI Service configuration error: Invalid credentials.");
      }

      console.error(`[Gemini Error] Unknown failure: ${errMsg} RequestID: ${requestId}`);
      throw new Error("An unexpected error occurred while communicating with the AI service.");
    }
  }
};
