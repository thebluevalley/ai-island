// app/api/agent-brain/route.ts
import { NextResponse } from 'next/server';

// --- INLINED CONFIG (To fix build path issues) ---
type TaskType = 'CHAT' | 'REACTION' | 'PLANNING' | 'REFLECTION' | 'NARRATOR';

interface WorkerNode {
  id: string;
  provider: 'GROQ' | 'SILICONFLOW';
  keyName: string;
  model: string;
  roles: TaskType[];
}

const AI_WORKERS: WorkerNode[] = [
  // GROQ (Fast)
  { id: 'g1', provider: 'GROQ', keyName: 'GROQ_API_KEY_1', model: 'llama3-8b-8192', roles: ['CHAT'] },
  { id: 'g2', provider: 'GROQ', keyName: 'GROQ_API_KEY_2', model: 'llama3-8b-8192', roles: ['CHAT'] },
  { id: 'g3', provider: 'GROQ', keyName: 'GROQ_API_KEY_3', model: 'mixtral-8x7b-32768', roles: ['REACTION'] },
  { id: 'g4', provider: 'GROQ', keyName: 'GROQ_API_KEY_4', model: 'mixtral-8x7b-32768', roles: ['REACTION'] },
  { id: 'g5', provider: 'GROQ', keyName: 'GROQ_API_KEY_5', model: 'llama3-70b-8192', roles: ['CHAT', 'REACTION'] },
  // SILICONFLOW (Smart)
  { id: 's1', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_1', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING'] },
  { id: 's2', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_2', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING'] },
  { id: 's3', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_3', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 's4', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_4', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 's5', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_5', model: 'Qwen/Qwen2.5-72B-Instruct', roles: ['NARRATOR'] },
  { id: 's6', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_6', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING', 'REFLECTION'] },
];

function getWorkerForTask(task: TaskType): WorkerNode {
  const candidates = AI_WORKERS.filter(w => w.roles.includes(task));
  return candidates[Math.floor(Math.random() * candidates.length)] || AI_WORKERS[0];
}

function getBaseUrl(provider: 'GROQ' | 'SILICONFLOW') {
  if (provider === 'GROQ') return 'https://api.groq.com/openai/v1';
  if (provider === 'SILICONFLOW') return 'https://api.siliconflow.cn/v1';
  return '';
}
// --- END INLINED CONFIG ---

export async function POST(request: Request) {
  try {
    const { agent, context, taskType } = await request.json();
    const worker = getWorkerForTask(taskType as TaskType);
    const apiKey = process.env[worker.keyName];

    if (!apiKey) {
      // Return mock response if no key to prevent crash
      console.warn(`Missing Key: ${worker.keyName}. Returning mock.`);
      return NextResponse.json({ 
          success: true, 
          result: { content: "I'm thinking..." }, 
          workerId: "mock" 
      });
    }

    let systemPrompt = `Roleplay: You are ${agent.name}, a ${agent.job}. Mood: ${agent.mood}. Energy: ${Math.floor(agent.energy)}. Output strict JSON.`;
    let userPrompt = "";

    if (taskType === 'CHAT') {
        userPrompt = `Context: ${context}. Say something short (max 10 words). JSON: {"content": "..."}`;
    } else if (taskType === 'REACTION') {
        userPrompt = `Context: ${context}. Pick state (IDLE, MOVING, WORKING). JSON: {"state": "..."}`;
    }

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
        temperature: 0.7,
        max_tokens: 60,
        response_format: { type: "json_object" } 
      })
    });

    const data = await response.json();
    let result = { content: "..." };
    
    if (data.choices && data.choices[0].message.content) {
        try {
            result = JSON.parse(data.choices[0].message.content);
        } catch (e) {
            result = { content: data.choices[0].message.content };
        }
    }

    return NextResponse.json({ success: true, result, workerId: worker.id });

  } catch (error) {
    console.error("Brain Error:", error);
    return NextResponse.json({ error: "Brain malfunction" }, { status: 500 });
  }
}