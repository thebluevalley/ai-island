import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

export const maxDuration = 60;

// --- 地图配置 ---
const MAP_LOCATIONS = {
  "0,0": "北岸礁石", "0,1": "浅滩", "0,2": "沉船遗迹",
  "1,0": "椰林",   "1,1": "中央广场", "1,2": "淡水溪流",
  "2,0": "密林深处",   "2,1": "矿石山坡", "2,2": "瞭望塔"
};
const getLocName = (x, y) => MAP_LOCATIONS[`${x},${y}`] || "荒野";

// --- 资源刷新规则 ---
const SPAWN_RULES = {
  "1,0": ["椰子", "树枝", "宽叶片"], 
  "0,1": ["蛤蜊", "海带", "漂流木"], 
  "1,2": ["淡水", "淡水鱼", "鹅卵石"], 
  "2,0": ["蘑菇", "硬木", "野果"], 
  "2,1": ["石块", "燧石"], 
  "0,2": ["废铁片", "塑料布"] 
};

export async function POST() {
  await connectDB();
  
  // --- 关键修复：将 API 客户端初始化移到函数内部 ---
  // 这样构建时不会报错，只有运行时才会读取 Key
  const groqEnv = new OpenAI({ apiKey: process.env.GROQ_API_KEY_1 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groqSocial = new OpenAI({ apiKey: process.env.GROQ_API_KEY_2 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groqJudge = new OpenAI({ apiKey: process.env.GROQ_API_KEY_3 || "dummy", baseURL: "https://api.groq.com/openai/v1" });

  const sfTeamA = new OpenAI({ apiKey: process.env.SF_API_KEY_1 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  const sfTeamB = new OpenAI({ apiKey: process.env.SF_API_KEY_2 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  // --------------------------------------------------

  let world = await World.findOne();

  // 初始化世界
  if (!world || !world.agents || world.agents.length < 8) {
     if(world) await World.deleteMany({});
     world = await World.create({
        turn: 1, 
        weather: "晴朗",
        mapResources: {}, 
        mapBuildings: { "1,1": { name: "幸存者营地", progress: 0, max: 100 } },
        agents: [
            { id: 0, name: "张伟", gender: "男", age: 34, job: "前消防员", personality: "领袖气质", inventory: ["多功能刀"], x:1, y:1, locationName:"中央广场" },
            { id: 1, name: "林晓云", gender: "女", age: 26, job: "植物学者", personality: "温柔", inventory: ["采集袋"], x:1, y:1, locationName:"中央广场" },
            { id: 2, name: "王强", gender: "男", age: 42, job: "奸商", personality: "狡猾", inventory: ["打火机"], x:1, y:1, locationName:"中央广场" },
            { id: 3, name: "陈子墨", gender: "男", age: 19, job: "美术生", personality: "观察者", inventory: ["素描本"], x:1, y:1, locationName:"中央广场" },
            { id: 4, name: "老赵", gender: "男", age: 55, job: "老厨师", personality: "护食", inventory: ["铁锅"], x:1, y:1, locationName:"中央广场" },
            { id: 5, name: "Lisa", gender: "女", age: 29, job: "护士", personality: "干练", inventory: ["急救包"], x:1, y:1, locationName:"中央广场" },
            { id: 6, name: "阿彪", gender: "男", age: 24, job: "拳击手", personality: "鲁莽", inventory: [], x:1, y:1, locationName:"中央广场" },
            { id: 7, name: "神婆", gender: "女", age: 45, job: "占卜师", personality: "神叨叨", inventory: ["塔罗牌"], x:1, y:1, locationName:"中央广场" }
        ],
        logs: ["【序幕】新的生存挑战开始了。"]
     });
  }

  // 时间流逝
  const timeSlots = ["清晨", "上午", "正午", "下午", "黄昏", "深夜"];
  const timeNow = timeSlots[(world.turn - 1) % 6];
  const dayCount = Math.floor((world.turn - 1) / 6) + 1;

  // --- STEP 0: 资源自然刷新 ---
  if (Math.random() < 0.4) {
    const coords = Object.keys(SPAWN_RULES);
    const randomCoord = coords[Math.floor(Math.random() * coords.length)];
    const possibleItems = SPAWN_RULES[randomCoord];
    const newItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
    
    const currentItems = world.mapResources[randomCoord] || [];
    if (currentItems.length < 5) { 
      currentItems.push(newItem);
      world.mapResources = { ...world.mapResources, [randomCoord]: currentItems };
    }
  }

  // --- STEP 1: 环境生成 (Groq) ---
  const envRes = await groqEnv.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: `第${dayCount}天${timeNow}，天气${world.weather}。上一轮:${world.envDescription}。生成新的环境描写(50字内)和天气。JSON: {"weather":"", "description":""}` }],
    response_format: { type: "json_object" }
  });
  const envData = JSON.parse(envRes.choices[0].message.content);

  // --- STEP 2: 角色决策 (SiliconFlow) ---
  const getGroundItems = (x, y) => {
    const items = world.mapResources[`${x},${y}`] || [];
    return items.length > 0 ? items.join(", ") : "无";
  };
  const getBuilding = (x, y) => {
    const b = world.mapBuildings[`${x},${y}`];
    return b ? `${b.name}(进度${b.progress}%)` : "荒地";
  };

  const getPrompt = (agent) => `
    你是${agent.name} (${agent.job}, ${agent.personality})。
    状态: HP${agent.hp} 饱食${100-agent.hunger}%。
    位置: ${getLocName(agent.x, agent.y)}。
    
    【眼前所见】
    1. 地上物资: [${getGroundItems(agent.x, agent.y)}]
    2. 建筑工地: [${getBuilding(agent.x, agent.y)}]
    3. 你的背包: [${agent.inventory.join(", ")}]
    
    请决定行动。规则：
    1. **生存第一**：如果饿了(饱食<30%)，优先吃东西(背包里有食物)或去采集。
    2. **收集物资**：看到地上有用的东西，用 "PICKUP 物品名" 捡起来。
    3. **建设家园**：如果在 "中央广场(1,1)" 且有材料，用 "BUILD" 增加建筑进度。
    4. **移动**：去资源点(如椰林1,0, 溪流1,2)寻找物资。
    
    输出JSON: {"action": "PICKUP/EAT/BUILD/MOVE/TALK", "target": "物品名/方向/人名", "say": "台词"}
  `;

  const callSF = async (client, agentsList) => {
    return Promise.all(agentsList.map(agent => 
      client.chat.completions.create({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{role:"user", content: getPrompt(agent)}],
        response_format: { type: "json_object" }
      }).then(res => {
         try { return JSON.parse(res.choices[0].message.content); }
         catch(e) { return { action: "TALK", target: "所有人", say: "..." }; }
      })
    ));
  };

  const [groupA_Res, groupB_Res] = await Promise.all([
    callSF(sfTeamA, world.agents.slice(0, 4)), 
    callSF(sfTeamB, world.agents.slice(4, 8))
  ]);
  const allActions = [...groupA_Res, ...groupB_Res];

  // --- STEP 3: 物理裁判与逻辑结算 ---
  const updates = [];
  for (let i = 0; i < world.agents.length; i++) {
    const agent = world.agents[i];
    const act = allActions[i];
    const coord = `${agent.x},${agent.y}`;
    let update = { id: agent.id, action_log: act.say };
    
    // 简单移动逻辑
    if (act.action === "MOVE") {
        // 随机移动到一个相邻格子 (简化处理)
        const moves = [[0,1], [0,-1], [1,0], [-1,0]];
        const move = moves[Math.floor(Math.random() * moves.length)];
        agent.x = Math.max(0, Math.min(2, agent.x + move[0]));
        agent.y = Math.max(0, Math.min(2, agent.y + move[1]));
        agent.locationName = getLocName(agent.x, agent.y);
        update.action_log = `移动到了 ${agent.locationName}`;
    }
    
    // 捡拾
    if (act.action === "PICKUP" && act.target) {
      const ground = world.mapResources[coord] || [];
      const itemIndex = ground.findIndex(i => i.includes(act.target)); // 模糊匹配
      if (itemIndex > -1) {
        const item = ground[itemIndex];
        ground.splice(itemIndex, 1);
        agent.inventory.push(item);
        world.mapResources[coord] = ground;
        update.action_log = `捡起了 ${item}`;
      }
    }

    // 进食
    if (act.action === "EAT") {
      const foodIndex = agent.inventory.findIndex(item => item.includes(act.target));
      if (foodIndex > -1) {
        agent.inventory.splice(foodIndex, 1);
        agent.hunger = Math.max(0, agent.hunger - 30);
        agent.hp = Math.min(100, agent.hp + 5);
        update.action_log = `吃了 ${act.target}`;
      }
    }

    // 建造
    if (act.action === "BUILD" && coord === "1,1") {
      const hasMat = agent.inventory.find(item => item.match(/木|石|铁|枝/));
      if (hasMat) {
        const matIndex = agent.inventory.indexOf(hasMat);
        agent.inventory.splice(matIndex, 1);
        const building = world.mapBuildings["1,1"];
        building.progress = Math.min(100, building.progress + 10);
        world.mapBuildings["1,1"] = building;
        update.action_log = `消耗${hasMat}建设营地 (进度${building.progress}%)`;
      }
    }

    // 代谢
    agent.hunger = Math.min(100, agent.hunger + 3);
    if (agent.hunger >= 90) agent.hp -= 5;
    updates.push(update);
  }

  // --- STEP 4: 叙事裁判 ---
  const judgeRes = await groqJudge.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ 
      role: "user", 
      content: `
        写一段荒岛生存小说。
        角色行为: ${JSON.stringify(updates.map((u,i) => ({name: world.agents[i].name, log: u.action_log})))}
        当前环境: ${envData.description}
        
        要求：
        1. 描写大家为了生存而忙碌（找吃、盖房）。
        2. 300字以内，群像描写，富有文学性。
        JSON: {"story": "..."}
      ` 
    }],
    response_format: { type: "json_object" }
  });
  const storyData = JSON.parse(judgeRes.choices[0].message.content);

  // --- STEP 5: 社会八卦 ---
  const socialRes = await groqSocial.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: `生成一条社会动态: ${JSON.stringify(updates)}。JSON: {"news":"..."}` }],
    response_format: { type: "json_object" }
  });
  const socialData = JSON.parse(socialRes.choices[0].message.content);

  // 保存
  world.turn += 1;
  world.weather = envData.weather;
  world.envDescription = envData.description;
  world.socialNews = socialData.news;
  world.logs.push(storyData.story);
  
  updates.forEach((u, i) => { world.agents[i].actionLog = u.action_log; });

  if (world.logs.length > 50) world.logs.shift();
  
  world.markModified('mapResources');
  world.markModified('mapBuildings');
  world.markModified('agents');
  world.markModified('logs');
  
  await world.save();

  return NextResponse.json({ success: true, world });
}