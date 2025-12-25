import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

// --- 初始化 AI 客户端 ---
const groqEnv = new OpenAI({ apiKey: process.env.GROQ_API_KEY_1, baseURL: "https://api.groq.com/openai/v1" });
const groqJudge = new OpenAI({ apiKey: process.env.GROQ_API_KEY_2, baseURL: "https://api.groq.com/openai/v1" });
const sfTeamA = new OpenAI({ apiKey: process.env.SF_API_KEY_1, baseURL: "https://api.siliconflow.cn/v1" });
const sfTeamB = new OpenAI({ apiKey: process.env.SF_API_KEY_2, baseURL: "https://api.siliconflow.cn/v1" });

export const maxDuration = 60; // 延长超时时间

// --- 地图系统定义 ---
// 简化的 3x3 岛屿地图
const MAP_LOCATIONS = {
  "0,0": "北岸礁石区", "0,1": "北侧浅滩", "0,2": "沉船遗迹",
  "1,0": "椰林边缘",   "1,1": "中央营地", "1,2": "淡水溪流",
  "2,0": "西侧密林",   "2,1": "岩石山坡", "2,2": "山顶瞭望点"
};

// 辅助函数：获取地点名称
const getLocName = (x, y) => MAP_LOCATIONS[`${x},${y}`] || "未知荒野";

export async function POST() {
  await connectDB();
  
  // 1. 获取世界数据
  let world = await World.findOne();

  // 如果没有世界，或者发现是旧数据（没有 envDescription 字段），则重置世界
  // 注意：这会清空之前的进度，应用新的人设
  if (!world || !world.envDescription) {
    // 先删除旧的（如果存在）
    if (world) await World.deleteMany({});
    
    world = await World.create({
      turn: 1,
      weather: "微风",
      timeOfDay: "清晨",
      envDescription: "清晨的阳光穿过稀疏的椰子树叶，洒在潮湿的沙地上。海鸟在远处鸣叫，空气中弥漫着海盐和泥土混合的味道。",
      logs: ["【序幕】四名幸存者在荒岛的沙滩上醒来，周围是陌生的环境，他们需要在这里活下去。"],
      agents: [
        { 
          id: 0, name: "张伟", gender: "男", age: 34, job: "退役消防员",
          personality: "沉稳、责任感强、有些固执",
          backstory: "曾在救援队服役十年，因伤退役。擅长生存技能和危机处理，但因为过去的创伤，不愿轻易冒险，总想建立绝对安全的避难所。",
          inventory: ["多功能刀"], hp: 100, hunger: 10, x: 1, y: 1, locationName: "中央营地", actionLog: "正在观察地形"
        },
        { 
          id: 1, name: "林晓云", gender: "女", age: 26, job: "植物学研究生",
          personality: "细心、敏感、乐观",
          backstory: "从小在山区长大，对草药和植物了如指掌。虽然体能不如他人，但她是团队的'后勤补给站'，总是能发现别人忽略的食物。",
          inventory: ["采集袋", "笔记本"], hp: 90, hunger: 10, x: 1, y: 1, locationName: "中央营地", actionLog: "检查随身物品"
        },
        { 
          id: 2, name: "王强", gender: "男", age: 42, job: "小微企业主",
          personality: "精明、利己主义、口才好",
          backstory: "白手起家的商人，习惯用利益交换来解决问题。在荒岛上，他依然试图用'交易'维持地位，虽然体力一般，但很会偷懒和谈判。",
          inventory: ["打火机", "半包烟"], hp: 95, hunger: 10, x: 1, y: 1, locationName: "中央营地", actionLog: "点了一支烟"
        },
        { 
          id: 3, name: "陈子墨", gender: "男", age: 19, job: "美术生",
          personality: "内向、观察力敏锐、体弱",
          backstory: "休学旅行途中遭遇意外。他话不多，喜欢发呆观察云彩和蚂蚁。虽然看似无用，但他总能发现环境中的细微变化和潜在危险。",
          inventory: ["素描本"], hp: 80, hunger: 10, x: 1, y: 1, locationName: "中央营地", actionLog: "望着大海发呆"
        }
      ]
    });
  }

  // --- 时间流逝计算 ---
  // 每天分为 6 个时段：清晨 -> 上午 -> 正午 -> 下午 -> 黄昏 -> 深夜
  const timeSlots = ["清晨", "上午", "正午", "下午", "黄昏", "深夜"];
  const currentSlotIndex = (world.turn - 1) % 6;
  const dayCount = Math.floor((world.turn - 1) / 6) + 1;
  const timeNow = timeSlots[currentSlotIndex];
  
  // --- STEP 1: 环境生成 (Groq - Llama 3.3) ---
  const envRes = await groqEnv.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: `
      当前是第 ${dayCount} 天的 ${timeNow}。
      天气: ${world.weather}。
      上一轮环境: ${world.envDescription}。
      
      请生成这一时段的**环境描写**和**天气变化**。
      要求：
      1. **生活化**：不要总是发生灾难。多描写光影、声音、植物、气味等生活细节。
      2. **平淡真实**：只有 10% 的概率发生小意外（如下雨），90% 是平静的。
      3. **返回JSON**: {"weather": "string", "description": "一段优美的环境描写(50字左右)"}
    ` }],
    response_format: { type: "json_object" }
  });
  const envData = JSON.parse(envRes.choices[0].message.content);

  // --- STEP 2: 角色决策 (SiliconFlow - Qwen) ---
  const getPrompt = (agent) => `
    你现在是真人扮演游戏。
    角色: ${agent.name} (${agent.gender}, ${agent.age}岁, ${agent.job})。
    性格: ${agent.personality}。
    背景: ${agent.backstory}。
    当前状态: HP ${agent.hp}, 饥饿 ${agent.hunger}/100。
    当前位置: (${agent.x}, ${agent.y}) - ${getLocName(agent.x, agent.y)}。
    时间: 第 ${dayCount} 天 ${timeNow}。
    环境: ${envData.description}。
    背包: ${agent.inventory.join(', ')}。

    请决定你这一时段的行动。
    规则：
    1. **像真人一样生活**。你可以聊天、发呆、整理装备、散步、或者睡觉。不要每回合都像在打仗。
    2. 如果你想移动，请说明你想去哪个方向（东/南/西/北），坐标范围是 0-2。
    3. 你的决策必须符合你的【背景故事】。比如张伟会检查安全，王强会偷懒，林晓云会看植物。
    4. 简短输出你的行动(Action)和一句话内心独白或台词(Say)。
  `;

  // 并行调用两个 Key
  const [res0, res1, res2, res3] = await Promise.all([
    sfTeamA.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[0])}] }),
    sfTeamA.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[1])}] }),
    sfTeamB.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[2])}] }),
    sfTeamB.chat.completions.create({ model: "Qwen/Qwen2.5-7B-Instruct", messages: [{role:"user", content: getPrompt(world.agents[3])}] }),
  ]);

  const rawActions = [res0, res1, res2, res3].map(r => r.choices[0].message.content);

  // --- STEP 3: 裁判结算 (Groq - Llama 3.3) ---
  const judgeRes = await groqJudge.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ 
      role: "user", 
      content: `
        作为小说家，整理以下角色的行动。
        
        角色数据: ${JSON.stringify(world.agents.map(a=>({id: a.id, name: a.name, x:a.x, y:a.y})))}
        角色原始行动: 
        0(张伟): ${rawActions[0]}
        1(林晓云): ${rawActions[1]}
        2(王强): ${rawActions[2]}
        3(陈子墨): ${rawActions[3]}

        任务：
        1. **解析移动**：如果文本包含"向东/西/南/北"或"去xxx"，更新 x,y 坐标 (范围限制 0-2)。
        2. **更新状态**：每回合饥饿+5。如果描述中吃了东西则减少。
        3. **生成剧情**：写一段**第三人称、群像式**的小说段落。将所有人的行动编织在一起。
           - **不要**写"第一回"、"回合开始"这种游戏术语。
           - 就像在写一本小说，直接描写人物互动和生活气息。
           - 重点突出每个人的性格差异。
        
        返回JSON:
        {
          "story_segment": "一段优美的中文小说文本...",
          "agents_update": [
            {"id": 0, "dx": 0, "dy": 0, "hp_change": 0, "hunger_change": 5, "action_summary": "在营地生火"},
            ... (对应4个人)
          ]
        }
      ` 
    }],
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(judgeRes.choices[0].message.content);

  // --- 更新数据库状态 ---
  world.turn += 1;
  world.weather = envData.weather;
  world.envDescription = envData.description; // 存储最新的环境描写
  world.timeOfDay = timeNow;
  
  // 记录日志
  world.logs.push(result.story_segment);
  
  // 更新角色数据
  if (result.agents_update) {
      result.agents_update.forEach((u, index) => {
        const agent = world.agents[index];
        // 坐标更新 (限制在 0-2)
        agent.x = Math.max(0, Math.min(2, agent.x + (u.dx || 0)));
        agent.y = Math.max(0, Math.min(2, agent.y + (u.dy || 0)));
        agent.locationName = getLocName(agent.x, agent.y); 
        
        // 状态更新
        agent.hp = Math.max(0, Math.min(100, agent.hp + (u.hp_change || 0)));
        agent.hunger = Math.max(0, Math.min(100, agent.hunger + (u.hunger_change || 0)));
        agent.actionLog = u.action_summary || "正在休息";
      });
  }

  // 限制日志长度，防止数据库膨胀
  if (world.logs.length > 50) world.logs.shift();
  
  // 标记修改以触发 Mongoose 保存
  world.markModified('agents');
  world.markModified('logs');
  
  await world.save();

  // 返回完整的 world 对象，供前端更新 UI
  return NextResponse.json({ 
      success: true, 
      world: world 
  });
}