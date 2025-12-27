// app/api/agent-brain/route.ts
import { NextResponse } from 'next/server';

// --- 1. THE NEURAL MATRIX (11 API NODES) ---
type TaskType = 'CHAT' | 'DECISION' | 'REFLECTION';

interface WorkerNode {
  id: string;
  provider: 'GROQ' | 'SILICONFLOW';
  keyName: string;
  model: string;
  roles: TaskType[];
}

const AI_WORKERS: WorkerNode[] = [
  // --- GROQ CLUSTER (Fast / Low Latency) ---
  // 用于高频决策：去哪？说什么？
  { id: 'G1', provider: 'GROQ', keyName: 'GROQ_API_KEY_1', model: 'llama3-8b-8192', roles: ['CHAT', 'DECISION'] },
  { id: 'G2', provider: 'GROQ', keyName: 'GROQ_API_KEY_2', model: 'llama3-8b-8192', roles: ['CHAT', 'DECISION'] },
  { id: 'G3', provider: 'GROQ', keyName: 'GROQ_API_KEY_3', model: 'mixtral-8x7b-32768', roles: ['DECISION'] },
  { id: 'G4', provider: 'GROQ', keyName: 'GROQ_API_KEY_4', model: 'mixtral-8x7b-32768', roles: ['DECISION'] },
  { id: 'G5', provider: 'GROQ', keyName: 'GROQ_API_KEY_5', model: 'llama3-70b-8192', roles: ['CHAT', 'DECISION'] },

  // --- SILICONFLOW CLUSTER (Deep / Reasoning) ---
  // 用于复杂逻辑（虽然本Demo主要用Groq跑得快，但SF作为备用和深思）
  { id: 'S1', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_1', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['DECISION'] },
  { id: 'S2', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_2', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['DECISION'] },
  { id: 'S3', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_3', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 'S4', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_4', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 'S5', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_5', model: 'Qwen/Qwen2.5-72B-Instruct', roles: ['REFLECTION'] },
  { id: 'S6', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_6', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['DECISION'] },
];

function getWorkerForTask(task: TaskType): WorkerNode {
  // Filter eligible workers
  const candidates = AI_WORKERS.filter(w => w.roles.includes(task));
  // Round-Robin or Random Load Balancing
  return candidates[Math.floor(Math.random() * candidates.length)] || AI_WORKERS[0];
}

function getBaseUrl(provider: 'GROQ' | 'SILICONFLOW') {
  if (provider === 'GROQ') return 'https://api.groq.com/openai/v1';
  if (provider === 'SILICONFLOW') return 'https://api.siliconflow.cn/v1';
  return '';
}

// --- 2. API HANDLER ---
export async function POST(request: Request) {
  try {
    const { agent, context, taskType, poiList } = await request.json();
    const worker = getWorkerForTask(taskType as TaskType);
    const apiKey = process.env[worker.keyName];

    // Safety Check: If no key, return mock to keep game running
    if (!apiKey) {
      console.warn(`[Brain] Missing Key: ${worker.keyName}. Using Mock Fallback.`);
      return NextResponse.json({ 
          success: true, 
          result: taskType === 'DECISION' ? { action: "WAIT", reason: "Brain offline" } : { content: "..." }, 
          workerId: "MOCK" 
      });
    }

    // --- PROMPT ENGINEERING ---
    let systemPrompt = `You are an AI agent in a simulated town.
    Name: ${agent.name}. Job: ${agent.job}.
    Personality: ${agent.mood}.
    Current Status: Energy ${Math.floor(agent.energy)}/100.
    Output STRICT JSON only.`;

    let userPrompt = "";

    if (taskType === 'DECISION') {
        // Provide the map knowledge
        const places = poiList.map((p:any) => `${p.id}:${p.type}`).join(', ');
        
        userPrompt = `Current Situation: ${context}.
        Available Places (ID:Type): [${places}].
        
        TASK: Decide your next move based on your Job and the Time.
        - If Energy < 30, you MUST go HOME or get food.
        - If it is work hours (9-17) and you are not at work, GO TO WORK.
        - Otherwise, socialize or rest.
        
        Return JSON format:
        {
            "action": "MOVE" or "WAIT",
            "targetId": <ID of the destination POI>,
            "reason": "<Short reason, max 10 words>"
        }`;
    } 
    else if (taskType === 'CHAT') {
        userPrompt = `Context: ${context}.
        Generate a short thought or sentence (max 15 words) reflecting your current action.
        Return JSON format: { "content": "<your text>" }`;
    }

    // --- CALL LLM ---
    const response = await fetch(`${getBaseUrl(worker.provider)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: worker.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6, // Slightly creative but focused
        max_tokens: 100,
        response_format: { type: "json_object" } 
      })
    });

    const data = await response.json();
    let result = {};
    
    if (data.choices && data.choices[0].message.content) {
        try {
            result = JSON.parse(data.choices[0].message.content);
        } catch (e) {
            console.error("JSON Parse Error", data.choices[0].message.content);
            // Fallback parsing
            result = { action: "WAIT", reason: "Confusion", content: "..." };
        }
    }

    return NextResponse.json({ success: true, result, workerId: worker.id });

  } catch (error) {
    console.error("Brain Error:", error);
    return NextResponse.json({ error: "Brain malfunction" }, { status: 500 });
  }
}