// app/lib/llm-config.ts

// 定义任务类型
export type TaskType = 'CHAT' | 'REACTION' | 'PLANNING' | 'REFLECTION' | 'NARRATOR';

interface WorkerNode {
  id: string;
  provider: 'GROQ' | 'SILICONFLOW';
  keyName: string;
  model: string;
  roles: TaskType[];
}

// 11个API的职能分配矩阵
export const AI_WORKERS: WorkerNode[] = [
  // --- ⚡ GROQ 集群 (速度快，负责说话和反应) ---
  { id: 'g1', provider: 'GROQ', keyName: 'GROQ_API_KEY_1', model: 'llama3-8b-8192', roles: ['CHAT'] },
  { id: 'g2', provider: 'GROQ', keyName: 'GROQ_API_KEY_2', model: 'llama3-8b-8192', roles: ['CHAT'] },
  { id: 'g3', provider: 'GROQ', keyName: 'GROQ_API_KEY_3', model: 'mixtral-8x7b-32768', roles: ['REACTION'] },
  { id: 'g4', provider: 'GROQ', keyName: 'GROQ_API_KEY_4', model: 'mixtral-8x7b-32768', roles: ['REACTION'] },
  { id: 'g5', provider: 'GROQ', keyName: 'GROQ_API_KEY_5', model: 'llama3-70b-8192', roles: ['CHAT', 'REACTION'] }, // 备用

  // --- 🧠 SILICONFLOW 集群 (智商高，负责规划和反思) ---
  { id: 's1', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_1', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING'] },
  { id: 's2', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_2', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING'] },
  { id: 's3', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_3', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 's4', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_4', model: 'deepseek-ai/DeepSeek-V2-Chat', roles: ['REFLECTION'] },
  { id: 's5', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_5', model: 'Qwen/Qwen2.5-72B-Instruct', roles: ['NARRATOR'] }, // 世界导演
  { id: 's6', provider: 'SILICONFLOW', keyName: 'SF_API_KEY_6', model: 'Qwen/Qwen2.5-7B-Instruct', roles: ['PLANNING', 'REFLECTION'] }, // 备用
];

// 简单的负载均衡调度器
export function getWorkerForTask(task: TaskType): WorkerNode {
  const candidates = AI_WORKERS.filter(w => w.roles.includes(task));
  // 随机选择一个由该任务分配的 Worker，分散压力
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getBaseUrl(provider: 'GROQ' | 'SILICONFLOW') {
  if (provider === 'GROQ') return 'https://api.groq.com/openai/v1';
  if (provider === 'SILICONFLOW') return 'https://api.siliconflow.cn/v1';
  return '';
}