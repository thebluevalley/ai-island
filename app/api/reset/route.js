import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

const AVATAR_BASE = "https://api.dicebear.com/9.x/notionists/svg";

export async function POST() {
  await connectDB();
  await World.deleteMany({});

  const newWorld = await World.create({
    turn: 1,
    weather: "晴朗",
    envDescription: "幸存者们在海滩醒来，废墟中蕴藏着重建文明的希望。",
    globalResources: { wood: 100, stone: 50, food: 100, medicine: 10, tech_point: 0 },
    
    // --- 10 位 AI 精英 ---
    agents: [
      { id: 0, name: "张伟", job: "领袖", avatarUrl: `${AVATAR_BASE}?seed=Felix&flip=true` },
      { id: 1, name: "林晓云", job: "学者", avatarUrl: `${AVATAR_BASE}?seed=Lydia` },
      { id: 2, name: "王强", job: "商人", avatarUrl: `${AVATAR_BASE}?seed=Robert&glassesProbability=100` },
      { id: 3, name: "陈子墨", job: "记录员", avatarUrl: `${AVATAR_BASE}?seed=Sam` },
      { id: 4, name: "老赵", job: "大厨", avatarUrl: `${AVATAR_BASE}?seed=Bear&beardProbability=100` },
      { id: 5, name: "Lisa", job: "医生", avatarUrl: `${AVATAR_BASE}?seed=Jocelyn` },
      { id: 6, name: "阿彪", job: "保安", avatarUrl: `${AVATAR_BASE}?seed=Milo` },
      { id: 7, name: "神婆", job: "占卜师", avatarUrl: `${AVATAR_BASE}?seed=Destiny` },
      { id: 8, name: "鲁班七号", job: "建筑师", avatarUrl: `${AVATAR_BASE}?seed=Leo` }, // 新增
      { id: 9, name: "猴子", job: "斥候", avatarUrl: `${AVATAR_BASE}?seed=Aneka` }      // 新增
    ].map(a => ({...a, hp:100, hunger:0, sanity:100, x:1, y:1, locationName:"中央广场", actionLog:"苏醒..."})),

    // --- 5 位 NPC 苦工 ---
    npcs: [
      { id: "n1", name: "苦工甲", role: "worker", state: "idle", currentTask: "等待指令" },
      { id: "n2", name: "苦工乙", role: "worker", state: "idle", currentTask: "等待指令" },
      { id: "n3", name: "采集者A", role: "gatherer", state: "idle", currentTask: "等待指令" },
      { id: "n4", name: "采集者B", role: "gatherer", state: "idle", currentTask: "等待指令" },
      { id: "n5", name: "守夜人", role: "guard", state: "idle", currentTask: "巡逻" },
    ],

    // 初始建筑
    buildings: [
      { type: "Campfire", name: "中央篝火", x: 1, y: 1, status: "active", progress: 100, maxProgress: 100, desc:"提供基础照明" }
    ]
  });

  return NextResponse.json({ success: true, world: newWorld });
}
