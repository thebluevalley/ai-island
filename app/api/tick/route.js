import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

// --- 初始化 4 个 AI 客户端 ---
const groqEnv = new OpenAI({ apiKey: process.env.GROQ_API_KEY_1, baseURL: "https://api.groq.com/openai/v1" });
const groqJudge = new OpenAI({ apiKey: process.env.GROQ_API_KEY_2, baseURL: "https://api.groq.com/openai/v1" });
const sfTeamA = new OpenAI({ apiKey: process.env.SF_API_KEY_1, baseURL: "https://api.siliconflow.cn/v1" });
const sfTeamB = new OpenAI({ apiKey: process.env.SF_API_KEY_2, baseURL: "https://api.siliconflow.cn/v1" });

export const maxDuration = 30; // 尝试申请 Vercel 的超时时间延长 (Pro版有效，免费版尽力而为)

export async function POST() {
  await connectDB();
  
  // 1. 获取或重置世界
  let world = await World.findOne();
  if (!world) {
    // 初始化创世纪
    world = await World.create({
      turn: 0,
      weather: "阳光明媚",
      logs: ["【系统】幸存者们在海滩上醒来，实验开始了。"],
      agents: [
        { id: 0, name: "铁头", personality: "暴躁，喜欢抢劫", inventory: ["木棍"] },
        { id: 1, name: "医生", personality: "善良，想救人", inventory: ["绷带"] },
        { id: 2, name: "骗子", personality: "狡猾，喜欢挑拨", inventory: ["硬币"] },
        { id: 3, name: "仓鼠", personality: "胆小，只囤食物", inventory: ["饼干"] }
      ]
    });
  }

  // --- STEP 1: Groq 环境生成 ---
  const envRes = await groqEnv.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [{ role: "user", content: `当前回合:${world.turn}，天气:${world.weather}。请生成本回合的随机天气变化和突发事件(简短)。返回JSON格式: {"weather": "string", "event": "string"}` }],
    response_format: { type: "json_object" }
  });
  const envData = JSON.parse(envRes.choices[0].message.content);

  // --- STEP 2: SiliconFlow 角色决策 (并行) ---
  const getPrompt = (agent) => `
    你是${agent.name}，性格:${agent.personality}。
    状态: HP ${agent.hp}, 饥饿 ${agent.hunger}。
    背包: ${agent.inventory.join(', ')}。
    环境: ${envData.weather}, 事件: ${envData.event}。
    请决定你的行动(Action)和一句话台词(Say)。简短！
  `;

  // 并行调用：Key A 负责 0,1; Key B 负责 2,3
  const [res0, res1, res2, res3] = await Promise.all([
    sfTeamA.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[0])}] }),
    sfTeamA.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[1])}] }),
    sfTeamB.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[2])}] }),
    sfTeamB.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[3])}] }),
  ]);

  const actions = [
    { name: world.agents[0].name, act: res0.choices[0].message.content },
    { name: world.agents[1].name, act: res1.choices[0].message.content },
    { name: world.agents[2].name, act: res2.choices[0].message.content },
    { name: world.agents[3].name, act: res3.choices[0].message.content },
  ];

  // --- STEP 3: Groq 裁判结算 ---
  const judgeRes = await groqJudge.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [{ 
      role: "user", 
      content: `
        环境: ${JSON.stringify(envData)}
        角色行动: ${JSON.stringify(actions)}
        请结算结果。
        规则：每回合所有人饥饿+10。如果战斗，扣除HP。
        必须返回JSON: 
        {
          "story": "一段精彩的第三人称小说式描述(中文)",
          "updates": [
            {"id": 0, "hp_change": -5, "hunger_change": 10, "item_change": "无"},
            ... (对应4个人)
          ]
        }
      ` 
    }],
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(judgeRes.choices[0].message.content);

  // --- 更新数据库 ---
  world.turn += 1;
  world.weather = envData.weather;
  world.logs.push(`[第${world.turn}回合] ${result.story}`);
  
  // 更新具体数值
  result.updates.forEach((u, index) => {
    world.agents[index].hp += u.hp_change;
    world.agents[index].hunger += u.hunger_change;
    // 简单的物品逻辑可以后续完善，防止 JSON 结构过于复杂导致 AI 犯错
  });

  // 只保留最近 50 条日志
  if (world.logs.length > 50) world.logs.shift();
  
  await world.save();

  return NextResponse.json({ success: true, log: result.story });
}