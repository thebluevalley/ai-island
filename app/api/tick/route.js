import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

export const maxDuration = 60; // 允许函数运行 60秒

// --- 静态配置 ---
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

  // ==========================================
  // 1. 初始化 API 资源池 (The Resource Pool)
  // ==========================================
  
  // --- Groq 集群 (4节点: 3个工蜂 + 1个主脑) ---
  const groqCluster = [
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_1, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_2, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_3, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_4, baseURL: "https://api.groq.com/openai/v1" }), // The Matrix (主脑)
  ];

  // --- SiliconFlow 集群 (6节点: 文案池) ---
  const sfKeys = [
    process.env.SF_API_KEY_1, process.env.SF_API_KEY_2, process.env.SF_API_KEY_3,
    process.env.SF_API_KEY_4, process.env.SF_API_KEY_5, process.env.SF_API_KEY_6
  ].filter(key => key); // 过滤掉未配置的空 Key

  // 辅助函数：随机负载均衡
  const getRandomSF = () => {
    const randomKey = sfKeys[Math.floor(Math.random() * sfKeys.length)] || "dummy";
    return new OpenAI({ apiKey: randomKey, baseURL: "https://api.siliconflow.cn/v1" });
  };

  let world = await World.findOne();
  if (!world) return NextResponse.json({error: "No world"});

  // ==========================================
  // Step 1: 议会自治 (Groq 4 兼职处理)
  // ==========================================
  let councilLog = "";
  // 触发条件：无在建工程 且 资源富裕 (木头>100)
  if (!world.buildings.find(b => b.status === "blueprint") && world.globalResources.wood > 100 && Math.random() < 0.4) {
     try {
       const res = await groqCluster[3].chat.completions.create({
         model: "llama-3.3-70b-versatile",
         messages: [{ role: "user", content: `资源:${JSON.stringify(world.globalResources)}. 现有建筑:${world.buildings.map(b=>b.name).join(",")}. 决定下个建筑(House/Warehouse/Clinic/Kitchen/Tower). JSON:{"decision":"...","reason":"..."}` }],
         response_format: { type: "json_object" }
       });
       const council = JSON.parse(res.choices[0].message.content);
       const cost = BUILDING_COSTS[council.decision] || BUILDING_COSTS["House"];
       
       // 扣除资源并添加蓝图
       world.globalResources.wood -= cost.wood;
       if(cost.stone) world.globalResources.stone -= cost.stone;
       world.buildings.push({ type: council.decision, name: cost.name, x: 1, y: 1, status: "blueprint", progress: 0, maxProgress: cost.time, desc: council.reason });
       councilLog = `议会批准建造${cost.name}`;
     } catch(e) { console.error("Council Error", e); }
  }

  // ==========================================
  // Step 2: 个体意图生成 (Groq 1-3 并行处理 10 人)
  // ==========================================
  const getPrompt = (agent) => {
    return `你叫${agent.name},职业${agent.job}. HP${agent.hp}. 
    当前蓝图:${world.buildings.find(b=>b.status==='blueprint')?.name || "无"}.
    你可以: 1.自己干活(WORK) 2.指挥NPC(COMMAND) 3.休息(REST).
    若你是领袖/建筑师且有蓝图，优先COMMAND.
    JSON:{"intent":"WORK/COMMAND/REST", "target":"NPC/BLUEPRINT", "say":"..."}`;
  };
  
  const callAI = (client, list) => Promise.all(list.map(a => 
    client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{role:"user", content: getPrompt(a)}],
      response_format: { type: "json_object" }
    }).then(r => JSON.parse(r.choices[0].message.content)).catch(e=>({intent:"REST", say:"..."}))
  ));

  const [intents1, intents2, intents3] = await Promise.all([
    callAI(groqCluster[0], world.agents.slice(0, 4)), // Key 1: 负责 4 人
    callAI(groqCluster[1], world.agents.slice(4, 7)), // Key 2: 负责 3 人
    callAI(groqCluster[2], world.agents.slice(7, 10)) // Key 3: 负责 3 人
  ]);
  const allIntents = [...intents1, ...intents2, ...intents3];

  // ==========================================
  // Step 3: 主脑仲裁与调度 (The Matrix - Groq 4)
  // ==========================================
  let matrixReport = "";
  try {
    const npcStates = world.npcs.map(n => ({id:n.id, role:n.role, task:n.currentTask}));
    const agentRequests = world.agents.map((a, i) => ({ name: a.name, job: a.job, intent: allIntents[i].intent, say: allIntents[i].say }));

    const matrixRes = await groqCluster[3].chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: `
        作为系统主脑，协调任务。
        当前蓝图: ${world.buildings.find(b=>b.status==='blueprint')?.name || "无"}.
        NPC状态: ${JSON.stringify(npcStates)}.
        AI请求: ${JSON.stringify(agentRequests)}.
        
        规则:
        1. 若AI intent='COMMAND'且有蓝图，指派空闲 NPC 去 '建设'.
        2. 若AI intent='WORK'，该AI贡献度+1.
        3. 闲置 NPC 自动采集(随机木/食).
        
        返回 JSON: {
          "npc_updates": [{"id":"n1", "task":"建设..."}],
          "world_events": ["张伟指挥苦工...", "鲁班亲自...", "NPC们正在..."]
        }
      `}],
      response_format: { type: "json_object" }
    });
    
    const matrixDecision = JSON.parse(matrixRes.choices[0].message.content);
    matrixReport = matrixDecision.world_events?.join(" ") || "系统运转正常";

    // --- 应用判决 ---
    
    // 1. 更新 NPC 任务
    const updates = matrixDecision.npc_updates || [];
    world.npcs.forEach(npc => {
      const update = updates.find(u => u.id === npc.id);
      if (update) {
        npc.currentTask = update.task;
      } else {
        // 兜底：闲置 NPC 随机干活
        if(!npc.currentTask.includes("建设")) {
            npc.currentTask = Math.random()>0.5 ? "采集食物" : "伐木";
            if (npc.currentTask === "采集食物") world.globalResources.food += 2;
            if (npc.currentTask === "伐木") world.globalResources.wood += 2;
        }
      }
      
      // 建设进度逻辑
      if (npc.currentTask.includes("建设")) {
         const bp = world.buildings.find(b => b.status === "blueprint");
         if (bp) {
           bp.progress = Math.min(bp.maxProgress, bp.progress + 5);
           if (bp.progress >= bp.maxProgress) bp.status = "active";
         }
      }
    });

  } catch (e) {
    console.error("Matrix Error:", e);
    matrixReport = "主脑逻辑重置中...";
  }

  // 更新 AI 状态
  allIntents.forEach((intent, i) => {
    const agent = world.agents[i];
    agent.actionLog = intent.say;
    agent.hunger += 1;
    // 专家亲自干活加成
    if (intent.intent === "WORK" && (agent.job === "建筑师" || agent.job === "工匠")) {
        const bp = world.buildings.find(b => b.status === "blueprint");
        if (bp) bp.progress += 10;
    }
  });

  // ==========================================
  // Step 4: 叙事生成 (SiliconFlow 6节点轮询)
  // ==========================================
  const timeNow = ["晨","午","昏","夜"][(world.turn - 1) % 4];
  let envData = { weather: world.weather, desc: world.envDescription };
  let story = "";

  try {
    // 随机 Key 1: 生成环境
    const r1 = await getRandomSF().chat.completions.create({
      model: "Qwen/Qwen2.5-7B-Instruct",
      messages: [{role:"user", content: `Day${world.turn} ${timeNow}. 生成环境(30字). JSON:{"weather":"...","desc":"..."}`}],
      response_format: { type: "json_object" }
    });
    envData = JSON.parse(cleanJson(r1.choices[0].message.content));

    // 随机 Key 2: 生成小说
    const r2 = await getRandomSF().chat.completions.create({
       model: "Qwen/Qwen2.5-7B-Instruct",
       messages: [{role:"user", content: `写300字小说. 
         环境:${envData.desc}. 
         议会:${councilLog}. 
         系统:${matrixReport}. 
         角色:${allIntents.slice(0,5).map(a=>a.say).join("|")}. 
         JSON:{"story":"..."}`}],
       response_format: { type: "json_object" }
     });
     story = JSON.parse(cleanJson(r2.choices[0].message.content)).story;
  } catch(e) {
     console.error("Story Error", e);
     // 错误保底信息
     story = `[通讯中断] 卫星信号受阻。\n当前状态：${matrixReport}\n错误信息：${e.message}`;
  }

  // ==========================================
  // 保存与返回
  // ==========================================
  world.turn += 1;
  world.weather = envData.weather;
  world.envDescription = envData.desc;
  world.socialNews = councilLog || "无";
  world.logs.push(story);
  if(world.logs.length > 50) world.logs.shift();
  
  world.markModified('buildings');
  world.markModified('agents');
  world.markModified('npcs');
  world.markModified('globalResources');
  
  await world.save();
  return NextResponse.json({ success: true, world });
}