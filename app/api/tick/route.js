import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

export const maxDuration = 60;

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

  // --- API 资源池 (11 Key) ---
  const groqCluster = [
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_1, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_2, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_3, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_4, baseURL: "https://api.groq.com/openai/v1" }),
    new OpenAI({ apiKey: process.env.GROQ_API_KEY_5, baseURL: "https://api.groq.com/openai/v1" }), // Matrix
  ];

  const sfKeys = [
    process.env.SF_API_KEY_1, process.env.SF_API_KEY_2, process.env.SF_API_KEY_3,
    process.env.SF_API_KEY_4, process.env.SF_API_KEY_5, process.env.SF_API_KEY_6
  ].filter(key => key);

  const getRandomSF = () => {
    const randomKey = sfKeys[Math.floor(Math.random() * sfKeys.length)] || "dummy";
    return new OpenAI({ apiKey: randomKey, baseURL: "https://api.siliconflow.cn/v1" });
  };

  let world = await World.findOne();
  if (!world) return NextResponse.json({error: "No world"});

  // ==========================================
  // Step 1: 议会 (Groq 5)
  // ==========================================
  let councilLog = "";
  let isCouncilSession = false;

  if (!world.buildings.find(b => b.status === "blueprint") && world.globalResources.wood > 100 && Math.random() < 0.4) {
     try {
       const res = await groqCluster[4].chat.completions.create({
         model: "llama-3.3-70b-versatile",
         messages: [{ role: "user", content: `资源:${JSON.stringify(world.globalResources)}. 建筑:${world.buildings.map(b=>b.name).join(",")}. 决定下个建筑(House/Warehouse/Clinic/Kitchen/Tower). JSON:{"decision":"...","reason":"..."}` }],
         response_format: { type: "json_object" }
       });
       const council = JSON.parse(res.choices[0].message.content);
       const cost = BUILDING_COSTS[council.decision] || BUILDING_COSTS["House"];
       
       world.globalResources.wood -= cost.wood;
       if(cost.stone) world.globalResources.stone -= cost.stone;
       world.buildings.push({ type: council.decision, name: cost.name, x: 1, y: 1, status: "blueprint", progress: 0, maxProgress: cost.time, desc: council.reason });
       councilLog = `议会批准建造${cost.name}`;
       isCouncilSession = true;
     } catch(e) {}
  }

  // ==========================================
  // Step 2: 角色意图 (Groq 1-4)
  // ==========================================
  const getPrompt = (agent) => {
    let specificInst = isCouncilSession 
      ? `议会刚刚决定建造新建筑，请发表你的看法！必须说话！` 
      : `日常工作中。请多用动作描写(action_desc)，少说话(say留空)。`;

    return `你叫${agent.name},职业${agent.job}. HP${agent.hp}. 
    当前蓝图:${world.buildings.find(b=>b.status==='blueprint')?.name || "无"}.
    ${specificInst}
    可执行: 1.WORK 2.COMMAND 3.REST.
    JSON格式: {"intent":"...", "target":"...", "say":"台词(无话可说留空)", "action_desc":"动作描写(如:擦汗/凝视)"}`;
  };
  
  const callAI = (client, list) => Promise.all(list.map(a => 
    client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{role:"user", content: getPrompt(a)}],
      response_format: { type: "json_object" }
    }).then(r => JSON.parse(r.choices[0].message.content)).catch(e=>({intent:"REST", say:"", action_desc:"思考中"}))
  ));

  const [intents1, intents2, intents3, intents4] = await Promise.all([
    callAI(groqCluster[0], world.agents.slice(0, 3)),
    callAI(groqCluster[1], world.agents.slice(3, 6)),
    callAI(groqCluster[2], world.agents.slice(6, 8)),
    callAI(groqCluster[3], world.agents.slice(8, 10))
  ]);
  const allIntents = [...intents1, ...intents2, ...intents3, ...intents4];

  // ==========================================
  // Step 3: Matrix 仲裁 (Groq 5)
  // ==========================================
  let matrixReport = "";
  try {
    const npcStates = world.npcs.map(n => ({id:n.id, role:n.role, task:n.currentTask}));
    const agentRequests = world.agents.map((a, i) => ({ 
        name: a.name, 
        job: a.job, 
        intent: allIntents[i].intent 
    }));

    const matrixRes = await groqCluster[4].chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: `
        系统主脑。NPC: ${JSON.stringify(npcStates)}. AI请求: ${JSON.stringify(agentRequests)}.
        逻辑: COMMAND+蓝图->指派NPC建设. 闲置NPC->采集.
        返回JSON: {"npc_updates": [{"id":"n1", "task":"..."}], "events": ["张伟指挥...", "鲁班建设..."]}
      `}],
      response_format: { type: "json_object" }
    });
    
    const decision = JSON.parse(matrixRes.choices[0].message.content);
    matrixReport = decision.events?.join(" ") || "";

    // 应用 NPC 更新
    const updates = decision.npc_updates || [];
    world.npcs.forEach(npc => {
      const update = updates.find(u => u.id === npc.id);
      if (update) {
        npc.currentTask = update.task;
      } else {
        if(!npc.currentTask.includes("建设")) {
            npc.currentTask = Math.random()>0.5 ? "采集食物" : "伐木";
            if (npc.currentTask === "采集食物") world.globalResources.food += 2;
            if (npc.currentTask === "伐木") world.globalResources.wood += 2;
        }
      }
      if (npc.currentTask.includes("建设")) {
         const bp = world.buildings.find(b => b.status === "blueprint");
         if (bp) {
           bp.progress = Math.min(bp.maxProgress, bp.progress + 5);
           if (bp.progress >= bp.maxProgress) bp.status = "active";
         }
      }
    });

  } catch (e) { console.error(e); matrixReport = `主脑运算异常: ${e.message}`; }

  allIntents.forEach((intent, i) => {
    const agent = world.agents[i];
    agent.actionLog = intent.say ? `“${intent.say}”` : `[${intent.action_desc || "工作中"}]`;
    agent.hunger += 1;
    if (intent.intent === "WORK" && (agent.job === "建筑师" || agent.job === "工匠")) {
        const bp = world.buildings.find(b => b.status === "blueprint");
        if (bp) bp.progress += 10;
    }
  });

  // ==========================================
  // Step 4: 叙事生成 (SiliconFlow) - 动态环境优化版
  // ==========================================
  const timeNow = ["晨","午","昏","夜"][(world.turn - 1) % 4];
  let envData = { weather: world.weather, desc: world.envDescription };
  let story = "";

  try {
    const isEnvUpdateTurn = world.turn % 3 === 1 || !world.envDescription;
    let envInstruction = "";

    if (isEnvUpdateTurn) {
      // --- 更新回合：生成新环境并要求描写 ---
      const r1 = await getRandomSF().chat.completions.create({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{role:"user", content: `Day${world.turn} ${timeNow}. 极简环境(15字). JSON:{"weather":"...","desc":"..."}`}],
        response_format: { type: "json_object" }
      });
      envData = JSON.parse(cleanJson(r1.choices[0].message.content));
      // 指令：需要描写
      envInstruction = `环境变化:${envData.desc} (请在开头简要描写)`;
    } else {
      // --- 保持回合：使用旧环境，但要求忽略描写 ---
      // 指令：明确要求不写环境
      envInstruction = `环境(保持不变): ${envData.desc} (⚠️本段落请完全省略环境描写，将字数全部用于人物动作和交互)`;
    }

    const activeCharacters = allIntents.map((act, i) => {
        const name = world.agents[i].name;
        if (act.say) return `${name}说:"${act.say}"`;
        if (act.action_desc) return `${name}${act.action_desc}`;
        return null; 
    }).filter(Boolean).slice(0, 6).join("；");

    const r2 = await getRandomSF().chat.completions.create({
       model: "Qwen/Qwen2.5-7B-Instruct",
       messages: [{role:"user", content: `
         写200-350字微小说。
         ${envInstruction}
         议会:${councilLog}. 系统:${matrixReport}.
         角色动态:${activeCharacters}.
         要求: 只有部分人说话。描写要有镜头感，多写神态动作。
         必须返回 JSON:{"story":"..."}
       `}],
       response_format: { type: "json_object" }
     });
     story = JSON.parse(cleanJson(r2.choices[0].message.content)).story;
  } catch(e) {
     console.error("Story Error", e);
     story = `⚠️ [AI ERROR] ${e.message}`;
  }

  // ==========================================
  // 保存
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