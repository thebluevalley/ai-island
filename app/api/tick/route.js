import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

export const maxDuration = 60;

const MAP_LOCATIONS = {
  "0,0": "北岸礁石", "0,1": "浅滩", "0,2": "沉船遗迹",
  "1,0": "椰林",   "1,1": "中央广场", "1,2": "淡水溪流",
  "2,0": "密林深处",   "2,1": "矿石山坡", "2,2": "瞭望塔"
};
const getLocName = (x, y) => MAP_LOCATIONS[`${x},${y}`] || "荒野";

const SPAWN_RULES = {
  "1,0": ["椰子", "树枝"], "0,1": ["蛤蜊", "漂流木"], 
  "1,2": ["淡水鱼", "鹅卵石"], "2,0": ["蘑菇", "野果"], 
  "2,1": ["石块", "燧石"], "0,2": ["废铁片", "塑料布"] 
};

// --- 更换为 Boring Avatars (Beam 风格) ---
// 这是一个非常稳定且风格现代的头像源
const AVATAR_BASE = "https://source.boringavatars.com/beam/120";

export async function POST() {
  await connectDB();
  
  // --- 客户端初始化 (保持降级后的配置) ---
  const sfClient = new OpenAI({ apiKey: process.env.SF_API_KEY_1 || "dummy", baseURL: "https://api.siliconflow.cn/v1" });
  
  const groq1 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_1 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq2 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_2 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq3 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_3 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  const groq4 = new OpenAI({ apiKey: process.env.GROQ_API_KEY_4 || "dummy", baseURL: "https://api.groq.com/openai/v1" });
  
  let world = await World.findOne();
  
  // --- 初始化世界 (更新头像配色) ---
  if (!world || !world.agents || world.agents.length < 8) {
     if(world) await World.deleteMany({});
     world = await World.create({
        turn: 1, weather: "晴朗", mapResources: {}, mapBuildings: {"1,1":{name:"营地",progress:0,max:100}},
        agents: [
            // 使用 name 作为 seed，colors 指定配色，保证每次生成都一样但每个人不同
            { id: 0, name: "张伟", job: "消防员", hp: 100, hunger: 0, inventory: ["多功能刀"], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/ZhangWei?colors=264653,2a9d8f,e9c46a,f4a261,e76f51` },
            { id: 1, name: "林晓云", job: "学者", hp: 90, hunger: 0, inventory: [], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/LinXiaoyun?colors=e0fbfc,c2dfe3,9db4c0,5c6b73,253237` },
            { id: 2, name: "王强", job: "商人", hp: 95, hunger: 0, inventory: [], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/WangQiang?colors=003049,d62828,f77f00,fcbf49,eae2b7` },
            { id: 3, name: "陈子墨", job: "学生", hp: 80, hunger: 0, inventory: ["画笔"], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/ChenZimo?colors=cdb4db,ffc8dd,ffafcc,bde0fe,a2d2ff` },
            { id: 4, name: "老赵", job: "厨师", hp: 90, hunger: 0, inventory: ["铁锅"], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/OldZhao?colors=606c38,283618,fefae0,dda15e,bc6c25` },
            { id: 5, name: "Lisa", job: "护士", hp: 90, hunger: 0, inventory: ["急救包"], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/LisaNurse?colors=ffcdb2,ffb4a2,e5989b,b5838d,6d6875` },
            { id: 6, name: "阿彪", job: "拳手", hp: 110, hunger: 0, inventory: [], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/AhBiao?colors=540d6e,ee4266,ffd23f,3bceac,0ead69` },
            { id: 7, name: "神婆", job: "占卜师", hp: 85, hunger: 0, inventory: ["塔罗牌"], x:1, y:1, locationName:"中央广场",
              avatarUrl: `${AVATAR_BASE}/Shenpo?colors=7400b8,6930c3,5e60ce,5390d9,4ea8de` }
        ],
        logs: ["【序幕】生存实验开始..."]
     });
  }

  const timeSlots = ["清晨", "上午", "正午", "下午", "黄昏", "深夜"];
  const timeNow = timeSlots[(world.turn - 1) % 6];
  const dayCount = Math.floor((world.turn - 1) / 6) + 1;

  // --- STEP 0: 资源刷新 ---
  if (Math.random() < 0.4) {
    const coords = Object.keys(SPAWN_RULES);
    const rC = coords[Math.floor(Math.random() * coords.length)];
    const item = SPAWN_RULES[rC][Math.floor(Math.random() * SPAWN_RULES[rC].length)];
    const items = world.mapResources[rC] || [];
    if (items.length < 5) { 
      items.push(item);
      world.mapResources = { ...world.mapResources, [rC]: items };
    }
  }

  // --- STEP 1: 环境 (SiliconFlow) ---
  let envData = { description: world.envDescription, weather: world.weather };
  try {
    const res = await sfClient.chat.completions.create({
      model: "Qwen/Qwen2.5-7B-Instruct",
      messages: [{ role: "user", content: `第${dayCount}天${timeNow}，天气${world.weather}。上一轮:${world.envDescription}。生成环境(50字)和天气。JSON: {"weather":"", "description":""}` }],
      response_format: { type: "json_object" }
    });
    envData = JSON.parse(res.choices[0].message.content);
  } catch(e) {}

  // --- STEP 2: 角色决策 (4 Groq Keys - 8b-instant) ---
  const getInfo = (agent) => {
    const ground = (world.mapResources[`${agent.x},${agent.y}`] || []).join(", ") || "无";
    const people = world.agents.filter(a => a.id !== agent.id && a.x === agent.x && a.y === agent.y).map(n => `${n.name}`).join(", ");
    return `位置:${getLocName(agent.x,agent.y)} 地上:[${ground}] 身边:[${people}] 背包:[${agent.inventory}]`;
  };

  const getPrompt = (agent) => `
    你是${agent.name} (${agent.job})。状态: HP${agent.hp} 饥饿${agent.hunger}%。
    环境: ${envData.description}。
    感知: ${getInfo(agent)}
    规则:
    1. 交互: 身边有人 TALK, GIVE, ATTACK, STEAL。
    2. 生存: 饿了EAT。有东西PICKUP。
    3. 建设: 中央广场BUILD。
    4. 移动: MOVE。
    JSON: {"action": "类型", "target": "目标", "say": "台词"}
  `;

  const callActors = (client, list) => Promise.all(list.map(a => 
    client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{role:"user", content: getPrompt(a)}],
      response_format: { type: "json_object" }
    }).then(r => JSON.parse(r.choices[0].message.content)).catch(()=>({action:"TALK",target:"...",say:"..."}))
  ));

  const [act1, act2, act3, act4] = await Promise.all([
    callActors(groq1, world.agents.slice(0,2)),
    callActors(groq2, world.agents.slice(2,4)),
    callActors(groq3, world.agents.slice(4,6)),
    callActors(groq4, world.agents.slice(6,8))
  ]);
  const rawActions = [...act1, ...act2, ...act3, ...act4];

  // --- STEP 3: 裁判 (Groq 1 - 8b-instant) ---
  let refereeUpdates = [];
  try {
      const refereeRes = await groq1.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ 
          role: "user", 
          content: `
            我是裁判。判定结果。
            意图: ${JSON.stringify(world.agents.map((a,i) => ({
                id: a.id, name: a.name, job: a.job, 
                action: rawActions[i].action, target: rawActions[i].target, say: rawActions[i].say
            })))}
            JSON: { "updates": [{"id": 0, "log": "...", "hp_change": 0}, ...] }
          ` 
        }],
        response_format: { type: "json_object" }
      });
      const json = JSON.parse(refereeRes.choices[0].message.content);
      refereeUpdates = json.updates || json.results || [];
      if (refereeUpdates.length < 8) {
          world.agents.forEach(a => {
              if(!refereeUpdates.find(u=>u.id===a.id)) refereeUpdates.push({id:a.id, log:rawActions[a.id].say, hp_change:0});
          });
      }
  } catch(e) {
      refereeUpdates = world.agents.map((a,i) => ({id:a.id, log: rawActions[i].say, hp_change:0}));
  }

  // --- STEP 4: 执行 ---
  refereeUpdates.forEach(u => {
      const agent = world.agents.find(a => a.id === u.id);
      const rawAct = rawActions[u.id];
      if (!agent) return;

      agent.hp = Math.max(0, Math.min(100, agent.hp + (u.hp_change || 0)));
      agent.actionLog = u.log || rawAct.say;
      
      const coord = `${agent.x},${agent.y}`;
      if (rawAct.action === "MOVE") {
         const moves = [[0,1], [0,-1], [1,0], [-1,0]];
         const m = moves[Math.floor(Math.random()*moves.length)];
         agent.x = Math.max(0, Math.min(2, agent.x+m[0]));
         agent.y = Math.max(0, Math.min(2, agent.y+m[1]));
         agent.locationName = getLocName(agent.x, agent.y);
      }
      if (rawAct.action === "PICKUP" && rawAct.target) {
          const ground = world.mapResources[coord] || [];
          const idx = ground.findIndex(i=>i.includes(rawAct.target));
          if (idx > -1) {
              ground.splice(idx, 1);
              agent.inventory.push(ground[idx]);
              world.mapResources[coord] = ground;
          }
      }
      if (rawAct.action === "EAT") {
          const idx = agent.inventory.findIndex(i=>i.includes(rawAct.target));
          if (idx > -1) {
              agent.inventory.splice(idx, 1);
              agent.hunger = Math.max(0, agent.hunger - 30);
              agent.hp = Math.min(100, agent.hp + 5);
          }
      }
      agent.hunger = Math.min(100, agent.hunger + 3);
  });

  // --- STEP 5: 叙事 & 新闻 (SiliconFlow) ---
  const [judgeRes, socialRes] = await Promise.all([
      sfClient.chat.completions.create({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{ role: "user", content: `写一段荒岛小说(300字)。基于: ${JSON.stringify(refereeUpdates)}。环境:${envData.description}。返回 JSON: {"story": "..."}` }],
        response_format: { type: "json_object" }
      }),
      sfClient.chat.completions.create({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{ role: "user", content: `生成社会新闻: ${JSON.stringify(refereeUpdates)}。返回 JSON: {"news": "..."}` }],
        response_format: { type: "json_object" }
      })
  ]);

  const storyData = JSON.parse(judgeRes.choices[0].message.content);
  const socialData = JSON.parse(socialRes.choices[0].message.content);

  world.turn += 1;
  world.weather = envData.weather;
  world.envDescription = envData.description;
  world.socialNews = socialData.news;
  world.logs.push(storyData.story || "...");
  if(world.logs.length > 50) world.logs.shift();
  world.markModified('mapResources');
  world.markModified('mapBuildings');
  world.markModified('agents');
  world.markModified('logs');
  await world.save();

  return NextResponse.json({ success: true, world });
}