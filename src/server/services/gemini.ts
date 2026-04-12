import { GoogleGenAI, Type, Content } from '@google/genai';
import { backendBridge } from './backendBridge.js';
import RedisLib from 'ioredis';
const Redis = RedisLib.default || RedisLib;

// ============================================================================
// Configuration & Startup Validation
// ============================================================================
const rawApiKey = process.env.GEMINI_API_KEY?.trim() || process.env['gemini-casa-api']?.trim() || process.env.GEMINI_CASA_API?.trim();

if (!rawApiKey) {
  console.warn('[WARNING] GEMINI_API_KEY or gemini-casa-api is missing or blank. Chat features will not work until configured.');
} else {
  console.log(`[STARTUP] Gemini API Key configured. Prefix: ${rawApiKey.substring(0, 4)}...`);
}

const ai = new GoogleGenAI({ apiKey: rawApiKey || 'UNCONFIGURED_KEY' });

// Redis Session Storage
const redisUrl = process.env.REDIS_URL;
const isLocalRedis = !redisUrl || redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1');

let redis: any = null;
if (!isLocalRedis) {
  const RedisClass = (Redis as any).default || Redis;
  redis = new RedisClass(redisUrl, {
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
// Error Handling Helper
// ============================================================================
function handleGeminiError(error: any, context: string, requestId?: string): never {
  const errMsg = error.message || '';
  
  if (errMsg === 'GEMINI_TIMEOUT') {
    console.error(`[Gemini Error] ${context} timed out. RequestID: ${requestId}`);
    throw new Error("The AI service took too long to respond. Please try again.");
  }
  
  if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('UNCONFIGURED_KEY')) {
    console.error(`[Gemini Error] Invalid API Key detected during ${context}. RequestID: ${requestId}`);
    throw new Error("AI Service configuration error: Missing or invalid GEMINI_API_KEY or gemini-casa-api. Please configure it in the Settings menu.");
  }

  console.error(`[Gemini Error] ${context} failed: ${errMsg} RequestID: ${requestId}`);
  throw new Error("An unexpected error occurred while communicating with the AI service.");
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
      model: 'gemini-3.1-pro-preview',
      history: history,
      config: {
        systemInstruction: `You are the CASA Operator Assistant. You help admins analyze governance policies, run dry-runs, and understand boundary stress analysis. 
        RULES:
        - NEVER hallucinate metrics. Use your tools to fetch real data.
        - If a tool fails, explicitly state the uncertainty.
        - Format responses clearly for an operator console.`,
        temperature: 0.2,
        tools: governanceTools,
        thinkingConfig: { thinkingLevel: 'HIGH' } as any,
      }
    });

    try {
      let response: any = await withTimeout(chat.sendMessage({ message }), 30000);

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
        response = await withTimeout(chat.sendMessage(functionResponses as any), 30000);
      }

      // Save updated history
      const updatedHistory = await chat.getHistory();
      await saveChatHistory(sessionId, updatedHistory);

      return response.text;
    } catch (error: any) {
      handleGeminiError(error, 'Chat Request', requestId);
    }
  },

  async explainData(context: string, data: any): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain the following data in the context of: ${context}\n\nData:\n${JSON.stringify(data, null, 2)}`,
        config: {
          systemInstruction: "You are a helpful assistant explaining system metrics and data to an operator. Keep your explanation concise, clear, and focused on the most important insights. Use markdown formatting.",
          temperature: 0.3
        }
      });
      return response.text || "No explanation generated.";
    } catch (error: any) {
      handleGeminiError(error, 'Explain Data');
    }
  },

  async analyzePolicy(policyId: string, dryRunResult: any): Promise<any> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Analyze the impact of adopting policy ${policyId} based on this dry-run result:\n\n${JSON.stringify(dryRunResult, null, 2)}`,
        config: {
          systemInstruction: "You are a senior governance analyst. Review the dry-run results and provide a structured impact analysis.",
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: 'HIGH' } as any,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "A short summary of the policy change and its simulated effect." },
              predictedReviewLoad: { type: Type.STRING, description: "Prediction on whether this will increase or decrease manual review load." },
              outcomeComparison: { type: Type.STRING, description: "Comparison between current state and proposed state." },
              approvalBrief: { type: Type.STRING, description: "A human-readable brief for an admin to review before approving." }
            },
            required: ["summary", "predictedReviewLoad", "outcomeComparison", "approvalBrief"]
          }
        }
      });
      
      try {
        return JSON.parse(response.text || "{}");
      } catch (e) {
        console.error("Failed to parse policy analysis JSON", e);
        throw new Error("Failed to generate structured policy analysis.");
      }
    } catch (error: any) {
      handleGeminiError(error, 'Analyze Policy');
    }
  }
};
