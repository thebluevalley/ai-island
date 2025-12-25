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

export async function POST() {
  await connectDB();
  
  // --- A. 算力初始化 (8 Key) ---
  const sfEnv = new OpenAI({ apiKey: process.env.SF_API_KEY_1 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  const sfNews = new OpenAI({ apiKey: process.env.SF_API_KEY_2 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  const sfQuest = new OpenAI({ apiKey: process.env.SF_API_KEY_3 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  const sfStory = new OpenAI({ apiKey: process.env.SF_API_KEY_4 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });

  const groq1 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_1 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq2 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_2 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq3 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_3 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq4 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_4 || "dummy", baseURL: "https://api.groq.com/openai/v1" }); // 裁判/议会

  let world = await World.findOne();
  if (!world) return NextResponse.json({error: "No world"});

  // --- B. 逻辑处理阶段 ---
  
  // 1. NPC 自动化工作 (算法驱动)
  let npcLogs = [];
  world.npcs.forEach(npc => {
    // 简单逻辑：如果有在建建筑，工人去建造；否则去采集
    const activeBlueprint = world.buildings.find(b => b.status === "blueprint");
    
    if (activeBlueprint && npc.role === "worker") {
      activeBlueprint.progress = Math.min(activeBlueprint.maxProgress, activeBlueprint.progress + 5);
      if (activeBlueprint.progress >= activeBlueprint.maxProgress) {
        activeBlueprint.status = "active";
        npcLogs.push(`工人完成了【${activeBlueprint.name}】的建设！`);
      }
      npc.currentTask = `建设 ${activeBlueprint.name}`;
      npc.state = "working";
    } else {
      // 采集逻辑
      if (Math.random() > 0.5) {
        world.globalResources.wood += 2;
        npc.currentTask = "伐木";
      } else {
        world.globalResources.food += 2;
        npc.currentTask = "采集浆果";
      }
      npc.state = "gathering";
    }
  });

  // 2. AI 议会自治 (触发条件：资源充足且无建设)
  let councilLog = "";
  const canBuild = !world.buildings.find(b => b.status === "blueprint");
  const isRich = world.globalResources.wood > 150 && world.globalResources.stone > 50;
  
  if (canBuild && isRich && Math.random() < 0.3) {
     // 触发议会：Groq 4 扮演
     try {
       const res = await groq4.chat.completions.create({
         model: "llama-3.3-70b-versatile",
         messages: [{ role: "user", content: `
           你是岛屿议会。资源充足(木150+)。
           现有建筑: ${world.buildings.map(b=>b.name).join(",") || "无"}。
           请决定下一个建造什么：House(增加人口), Clinic(治疗), Kitchen(做饭), Tower(防御)。
           返回JSON: {"decision": "Clinic", "reason": "张伟提议：为了大家的健康..."}
         `}],
         response_format: { type: "json_object" }
       });
       const council = JSON.parse(res.choices[0].message.content);
       const bType = council.decision;
       const cost = BUILDING_COSTS[bType] || BUILDING_COSTS["House"];
       
       // 自动扣费并立项
       world.globalResources.wood -= cost.wood;
       world.globalResources.stone -= cost.stone;
       world.buildings.push({
         type: bType, name: cost.name, x: 1, y: 1, 
         status: "blueprint", progress: 0, maxProgress: cost.time, desc: "议会决议项目"
       });
       councilLog = `【议会决议】${council.reason}，开始建造${cost.name}。`;
     } catch(e) {}
  }

  // --- C. AI 角色扮演 (Groq 并发) ---
  const getPrompt = (agent) => {
    const loc = MAP_NAMES[`${agent.x},${agent.y}`] || "荒野";
    return `
      你叫${agent.name}，职业${agent.job}。HP${agent.hp} 心情${agent.sanity}。
      当前位置:${loc}。
      全局资源: 木${world.globalResources.wood} 食${world.globalResources.food}。
      当前工程: ${world.buildings.find(b=>b.status==='blueprint')?.name || "无"}。
      
      请决定行动 JSON: {"action":"WORK/REST/TALK", "say":"..."}
      如果职业是建筑师且有工程，优先WORK。
    `;
  };
  
  const callAI = (client, list) => Promise.all(list.map(a => 
    client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{role:"user", content: getPrompt(a)}],
      response_format: { type: "json_object" }
    }).then(r => JSON.parse(r.choices[0].message.content)).catch(()=>({action:"TALK", say:"..."}))
  ));

  const [res1, res2, res3] = await Promise.all([
    callAI(groq1, world.agents.slice(0, 3)),
    callAI(groq2, world.agents.slice(3, 6)),
    callAI(groq3, world.agents.slice(6, 10))
  ]);
  const allActions = [...res1, ...res2, ...res3];

  // 更新 AI 状态
  allActions.forEach((act, i) => {
    const agent = world.agents[i];
    agent.actionLog = act.say;
    if (act.action === "WORK") {
      agent.hunger = Math.min(100, agent.hunger + 5);
      // 如果是建筑师，加速建造
      if (agent.job === "建筑师") {
        const bp = world.buildings.find(b => b.status === "blueprint");
        if(bp) bp.progress += 10; 
      }
    }
    // 自然代谢
    agent.hunger += 1;
    if (agent.hunger > 80) agent.hp -= 2;
  });

  // --- D. 叙事生成 (SiliconFlow) ---
  const timeSlots = ["清晨", "上午", "正午", "下午", "黄昏", "深夜"];
  const timeNow = timeSlots[(world.turn - 1) % 6];
  
  // 环境
  let envData = { weather: world.weather, desc: world.envDescription };
  try {
    const r = await sfEnv.chat.completions.create({
      model: "Qwen/Qwen2.5-7B-Instruct",
      messages: [{role:"user", content: `Day${world.turn}, ${timeNow}. 生成环境描写(30字)。JSON:{"weather":"晴","desc":"..."}`}],
      response_format: { type: "json_object" }
    });
    envData = JSON.parse(r.choices[0].message.content);
  } catch(e){}

  // 故事
  let story = "...";
  try {
     const r = await sfStory.chat.completions.create({
       model: "Qwen/Qwen2.5-7B-Instruct",
       messages: [{role:"user", content: `写一段300字微小说。
         议会: ${councilLog}
         NPC动态: ${npcLogs.join(",")}
         AI行动: ${allActions.map((a,i)=>world.agents[i].name+":"+a.action).join(",")}
         JSON: {"story":"..."}
       `}],
       response_format: { type: "json_object" }
     });
     story = JSON.parse(r.choices[0].message.content).story;
  } catch(e){}

  // --- E. 保存 ---
  world.turn += 1;
  world.weather = envData.weather;
  world.envDescription = envData.desc;
  world.socialNews = councilLog || "社会平稳运行中...";
  world.logs.push(story);
  if(world.logs.length > 50) world.logs.shift();
  
  // 必须显式标记数组修改
  world.markModified('buildings');
  world.markModified('agents');
  world.markModified('npcs');
  world.markModified('globalResources');
  
  await world.save();
  return NextResponse.json({ success: true, world });
}
