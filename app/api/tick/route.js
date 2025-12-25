import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

export const maxDuration = 60;

// --- 静态配置 ---
const MAP_NAMES = { "0,0":"礁石","0,1":"浅滩","0,2":"沉船","1,0":"椰林","1,1":"广场","1,2":"溪流","2,0":"密林","2,1":"矿山","2,2":"高塔" };
const LOCATIONS = Object.keys(MAP_NAMES); // 用于移动逻辑

const cleanJson = (str) => str.replace(/```json|```/g, '').trim();

export async function POST() {
  await connectDB();

  // --- 11 Key Cluster ---
  const groqCluster = [
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_1, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_2, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_3, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_4, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_5, baseURL: "https://api.groq.com/openai/v1" }), // World Simulator
  ];

  const sfKeys = [
    process.env.SF_API_KEY_1, process.env.SF_API_KEY_2, process.env.SF_API_KEY_3,
    process.env.SF_API_KEY_4, process.env.SF_API_KEY_5, process.env.SF_API_KEY_6
  ].filter(k=>k);
  const getRandomSF = () => new OpenAI({ apiKey: sfKeys[Math.floor(Math.random()*sfKeys.length)]||"dummy", baseURL: "https://api.siliconflow.cn/v1" });

  let world = await World.findOne();
  if (!world) return NextResponse.json({error: "No world"});

  // ======================================================
  // Phase 1: World Simulation (感知与物理层) - Groq 5
  // ======================================================
  // 计算环境事件，谁在哪，谁看见了谁
  // ======================================================
  
  // 简单的物理模拟：如果资源不足，环境会恶化
  const isCrisis = world.globalResources.food < 20;
  
  // ======================================================
  // Phase 2: Agent Thought (认知层) - Groq 1-4
  // Smallville Core: Retrieval & Planning
  // ======================================================
  
  const getAgentPrompt = (agent) => {
    // 1. 提取上下文
    const loc = `${agent.x},${agent.y}`;
    const locName = MAP_NAMES[loc] || "荒野";
    
    // 2. 检索记忆 (简单的 Recent 3)
    const recentMemories = agent.memories.slice(-3).join("; ");
    
    // 3. 检索关系 (Social Graph)
    // 简单的序列化： "张伟(50), 阿彪(-10)"
    let socialContext = "关系正常";
    if (agent.relationships && agent.relationships.size > 0) {
        socialContext = Array.from(agent.relationships.entries())
            .map(([k,v]) => `${k}(${v})`).join(", ");
    }

    // 4. 感知周围 (谁在同一格)
    const neighbors = world.agents
        .filter(a => a.id !== agent.id && a.x === agent.x && a.y === agent.y)
        .map(a => a.name).join(",");

    return `
      你扮演${agent.name}(${agent.job}). 
      [状态] HP:${agent.hp} 饥饿:${agent.hunger} 位置:${locName}.
      [记忆] ${recentMemories || "刚醒来"}.
      [关系] ${socialContext}.
      [周围] ${neighbors || "独自一人"}.
      [全岛资源] 木:${world.globalResources.wood} 食:${world.globalResources.food}.
      
      请决策下一步行动。
      规则:
      1. 假如饥饿>50, 必须找食物(MOVE或GATHER).
      2. 假如周围有人, 可以TALK(八卦/交易/合作).
      3. 假如周围没人, 可以MOVE到其他坐标.
      4. 假如是建筑师且资源够, BUILD.
      
      返回JSON: {
        "action": "MOVE / GATHER / BUILD / TALK / REST",
        "target": "坐标(如'1,2') / 物品 / 人名",
        "thought": "你的内心独白(反思)",
        "say": "对他人的对话(无则空)"
      }
    `;
  };

  const callAI = (client, list) => Promise.all(list.map(a => 
    client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{role:"user", content: getAgentPrompt(a)}],
      response_format: { type: "json_object" }
    }).then(r => JSON.parse(r.choices[0].message.content)).catch(e=>({action:"REST", thought:"发呆", say:""}))
  ));

  const [res1, res2, res3, res4] = await Promise.all([
    callAI(groqCluster[0], world.agents.slice(0, 3)),
    callAI(groqCluster[1], world.agents.slice(3, 6)),
    callAI(groqCluster[2], world.agents.slice(6, 8)),
    callAI(groqCluster[3], world.agents.slice(8, 10))
  ]);
  const decisions = [...res1, ...res2, ...res3, ...res4];

  // ======================================================
  // Phase 3: Action Execution (执行层) - 逻辑处理
  // 更新位置、资源、产生新记忆
  // ======================================================
  
  let worldEvents = []; // 用于稍后写小说

  decisions.forEach((d, i) => {
    const agent = world.agents[i];
    agent.actionLog = d.say || `[${d.action}] ${d.thought}`;
    
    // 写入记忆 (Memory Stream Ingestion)
    // 只有重要的事情才记入长时记忆，这里简化为每回合思考都记入
    if (d.thought) agent.memories.push(d.thought);
    if (agent.memories.length > 10) agent.memories.shift(); // 遗忘机制

    // 执行逻辑
    switch (d.action) {
      case "MOVE":
        // 解析坐标 "1,2"
        const [nx, ny] = (d.target || "1,1").split(",").map(Number);
        if (!isNaN(nx) && !isNaN(ny)) {
          agent.x = Math.min(2, Math.max(0, nx));
          agent.y = Math.min(2, Math.max(0, ny));
          agent.locationName = MAP_NAMES[`${agent.x},${agent.y}`];
          worldEvents.push(`${agent.name}移动到了${agent.locationName}。`);
        }
        break;
      case "GATHER":
        world.globalResources.food += 2;
        world.globalResources.wood += 2;
        agent.hunger = Math.max(0, agent.hunger - 10);
        worldEvents.push(`${agent.name}收集了资源。`);
        break;
      case "TALK":
        // 社交更新：如果 TALK，增加好感度
        // 这需要复杂的实体链接，这里简化处理
        worldEvents.push(`${agent.name}对${d.target}说：“${d.say}”`);
        break;
      case "BUILD":
        const bp = world.buildings.find(b => b.status === "blueprint");
        if (bp && agent.x === bp.x && agent.y === bp.y) {
           bp.progress += 10;
           worldEvents.push(`${agent.name}正在建造${bp.name}。`);
        }
        break;
    }
    agent.hunger += 1;
  });

  // NPC 简单逻辑 (保持世界运转)
  world.npcs.forEach(npc => {
    npc.currentTask = Math.random()>0.5 ? "搬运物资" : "清理废墟";
  });

  // ======================================================
  // Phase 4: Narrative (叙事层) - SiliconFlow
  // ======================================================
  
  const timeNow = ["晨","午","昏","夜"][(world.turn - 1) % 4];
  let envData = { weather: world.weather, desc: world.envDescription };
  let story = "";

  try {
    // 降频环境描写
    if (world.turn % 3 === 1 || !world.envDescription) {
      const r1 = await getRandomSF().chat.completions.create({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{role:"user", content: `Day${world.turn} ${timeNow}. 极简环境(15字). JSON:{"weather":"...","desc":"..."}`}],
        response_format: { type: "json_object" }
      });
      envData = JSON.parse(cleanJson(r1.choices[0].message.content));
    }

    const r2 = await getRandomSF().chat.completions.create({
       model: "Qwen/Qwen2.5-7B-Instruct",
       messages: [{role:"user", content: `
         Smallville风格微小说(200字).
         环境:${envData.desc} (略写).
         事件流:${worldEvents.slice(0, 8).join("|")}.
         人物内心:${decisions.slice(0, 3).map(d=>d.thought).join("|")}.
         要求: 侧重描写人物的互动和位置移动，体现社会关系。
         必须返回 JSON:{"story":"..."}
       `}],
       response_format: { type: "json_object" }
     });
     story = JSON.parse(cleanJson(r2.choices[0].message.content)).story;
  } catch(e) {
     console.error("Story Error", e);
     story = `⚠️ [AI NARRATIVE ERROR] ${e.message}`;
  }

  // 保存
  world.turn += 1;
  world.weather = envData.weather;
  world.envDescription = envData.desc;
  world.logs.push(story);
  if(world.logs.length > 50) world.logs.shift();
  
  // 必须显式标记 Map 类型更改
  // Mongoose Map 比较特殊，需要这样标记
  // world.markModified('agents'); 
  
  await world.save();
  return NextResponse.json({ success: true, world });
}