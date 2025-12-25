import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

export const maxDuration = 60;

// --- 静态数据 ---
const MAP_NAMES = { "0,0":"礁石","0,1":"浅滩","0,2":"沉船","1,0":"椰林","1,1":"广场","1,2":"溪流","2,0":"密林","2,1":"矿山","2,2":"高塔" };
const BUILDING_COSTS = {
  "House": { wood: 50, stone: 0, time: 20, name: "居住屋" },
  "Warehouse": { wood: 80, stone: 20, time: 30, name: "大仓库" },
  "Clinic": { wood: 100, stone: 50, time: 50, name: "诊所" },
  "Kitchen": { wood: 60, stone: 30, time: 40, name: "野战厨房" },
  "Tower": { wood: 120, stone: 80, time: 60, name: "瞭望塔" }
};

const cleanJson = (str) => str.replace(/```json|```/g, '').trim();

export async function POST() {
  await connectDB();
  
  // 初始化客户端 (8 Key)
  const sfEnv = new OpenAI({ apiKey: process.env.SF_API_KEY_1 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  const sfStory = new OpenAI({ apiKey: process.env.SF_API_KEY_4 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  const groq1 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_1 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq2 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_2 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq3 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_3 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq4 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_4 || "dummy", baseURL: "https://api.groq.com/openai/v1" }); // 议会

  let world = await World.findOne();
  if (!world) return NextResponse.json({error: "No world"});

  // 1. NPC 逻辑
  let npcLogs = [];
  world.npcs.forEach(npc => {
    const activeBlueprint = world.buildings.find(b => b.status === "blueprint");
    if (activeBlueprint && npc.role === "worker") {
      activeBlueprint.progress = Math.min(activeBlueprint.maxProgress, activeBlueprint.progress + 5);
      if (activeBlueprint.progress >= activeBlueprint.maxProgress) {
        activeBlueprint.status = "active";
        npcLogs.push(`工人建成${activeBlueprint.name}`);
      }
      npc.currentTask = `建设 ${activeBlueprint.name}`;
    } else {
      if (Math.random() > 0.5) { world.globalResources.wood += 2; npc.currentTask = "伐木"; }
      else { world.globalResources.food += 2; npc.currentTask = "采集"; }
    }
  });

  // 2. 议会逻辑
  let councilLog = "";
  if (!world.buildings.find(b => b.status === "blueprint") && world.globalResources.wood > 150 && Math.random() < 0.3) {
     try {
       const res = await groq4.chat.completions.create({
         model: "llama-3.3-70b-versatile",
         messages: [{ role: "user", content: `资源充足。现有建筑:${world.buildings.map(b=>b.name).join(",")}. 决定下一个建筑(House/Warehouse/Clinic/Kitchen/Tower). JSON:{"decision":"...","reason":"..."}` }],
         response_format: { type: "json_object" }
       });
       const council = JSON.parse(res.choices[0].message.content);
       const cost = BUILDING_COSTS[council.decision] || BUILDING_COSTS["House"];
       world.globalResources.wood -= cost.wood;
       world.buildings.push({ type: council.decision, name: cost.name, x: 1, y: 1, status: "blueprint", progress: 0, maxProgress: cost.time });
       councilLog = `议会批准建造${cost.name}`;
     } catch(e) { councilLog = `议会休会: ${e.message}`; }
  }

  // 3. AI 决策
  const getPrompt = (agent) => `你叫${agent.name},职业${agent.job}. HP${agent.hp}. JSON:{"action":"WORK/REST", "say":"..."}`;
  const callAI = (client, list) => Promise.all(list.map(a => client.chat.completions.create({
      model: "llama-3.1-8b-instant", messages: [{role:"user", content: getPrompt(a)}], response_format: { type: "json_object" }
    }).then(r => JSON.parse(r.choices[0].message.content)).catch(e=>({action:"ERR", say: e.message}))
  ));
  
  const [res1, res2, res3] = await Promise.all([
    callAI(groq1, world.agents.slice(0, 3)),
    callAI(groq2, world.agents.slice(3, 6)),
    callAI(groq3, world.agents.slice(6, 10))
  ]);
  const allActions = [...res1, ...res2, ...res3];
  
  allActions.forEach((act, i) => {
    const agent = world.agents[i];
    agent.actionLog = act.say;
    if (act.action === "WORK") agent.hunger += 2;
  });

  // 4. 叙事生成 (直接透传错误)
  const timeNow = ["晨","午","昏","夜"][(world.turn - 1) % 4];
  let envData = { weather: world.weather, desc: world.envDescription };
  let story = "";

  try {
    // 环境
    const r1 = await sfEnv.chat.completions.create({
      model: "Qwen/Qwen2.5-7B-Instruct",
      messages: [{role:"user", content: `Day${world.turn} ${timeNow}. 生成环境(30字). JSON:{"weather":"...","desc":"..."}`}],
      response_format: { type: "json_object" }
    });
    envData = JSON.parse(cleanJson(r1.choices[0].message.content));

    // 故事
    const r2 = await sfStory.chat.completions.create({
       model: "Qwen/Qwen2.5-7B-Instruct",
       messages: [{role:"user", content: `写300字小说. 环境:${envData.desc}. 事件:${councilLog},${npcLogs.join(",")}. JSON:{"story":"..."}`}],
       response_format: { type: "json_object" }
     });
     story = JSON.parse(cleanJson(r2.choices[0].message.content)).story;
  } catch(e) {
     // --- 关键修改：直接显示错误信息 ---
     console.error("AI Error:", e);
     story = `[SYSTEM ERROR] AI 响应超时或 Key 配额不足。\n调试信息: ${e.message}`;
  }

  // 保存
  world.turn += 1;
  world.weather = envData.weather;
  world.envDescription = envData.desc;
  world.socialNews = councilLog || "无重大决议";
  world.logs.push(story);
  if(world.logs.length > 50) world.logs.shift();
  
  world.markModified('buildings');
  world.markModified('agents');
  world.markModified('npcs');
  world.markModified('globalResources');
  
  await world.save();
  return NextResponse.json({ success: true, world });
}
