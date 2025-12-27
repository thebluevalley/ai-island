// app/lib/llm-config.ts

export type TaskType = 'CHAT' | 'REACTION' | 'PLANNING' | 'REFLECTION' | 'NARRATOR';

interface WorkerNode {
  id: string;
  provider: 'GROQ' | 'SILICONFLOW';
  keyName: string;
  model: string;
  roles: TaskType[];
}

export const AI_WORKERS: WorkerNode[] = [
  // --- GROQ Workers (Fast) ---
  { id: 'g1', provider: 'GROQ', keyName: 'GROQ_API_KEY_1', model: 'llama3-8b-8192', roles: ['CHAT'] },
  { id: 'g2', provider: 'GROQ', keyName: 'GROQ_API_KEY_2', model: 'llama3-8b-8192', roles: ['CHAT'] },
  { id: 'g3', provider: 'GROQ', keyName: 'GROQ_API_KEY_3', model: 'mixtral-8x7b-32768', roles: ['REACTION'] },
  { id: 'g4', provider: 'GROQ', keyName: 'GROQ_API_KEY_4', model: 'mixtral-8x7b-32768', roles: ['REACTION'] },
  { id: 'g5', provider: 'GROQ', keyName: 'GROQ_API_KEY_5', model: 'llama3-70b-8192', roles: ['CHAT', 'REACTION'] },

  // --- SILICONFLOW Workers (Smart) ---
  { id: 's1', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_1', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING'] },
  { id: 's2', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_2', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING'] },
  { id: 's3', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_3', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 's4', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_4', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 's5', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_5', model: 'Qwen/Qwen2.5-72B-Instruct', roles: ['NARRATOR'] },
  { id: 's6', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_6', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING', 'REFLECTION'] },
];

export function getWorkerForTask(task: TaskType): WorkerNode {
  const candidates = AI_WORKERS.filter(w => w.roles.includes(task));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getBaseUrl(provider: 'GROQ' | 'SILICONFLOW') {
  if (provider === 'GROQ') return 'https://api.groq.com/openai/v1';
  if (provider === 'SILICONFLOW') return 'https://api.siliconflow.cn/v1';
  return '';
}