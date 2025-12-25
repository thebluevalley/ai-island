import mongoose from 'mongoose';

// --- 建筑子结构 ---
const BuildingSchema = new mongoose.Schema({
  type: String, // e.g. "Clinic", "Warehouse"
  name: String, 
  x: Number,
  y: Number,
  status: { type: String, default: "blueprint" }, // blueprint, active
  progress: { type: Number, default: 0 }, // 0-100
  maxProgress: { type: Number, default: 100 },
  desc: String
});

// --- NPC 子结构 (纯算法驱动) ---
const NPCSchema = new mongoose.Schema({
  id: String,
  name: String,
  role: String, // "worker", "guard"
  state: String, // "idle", "working", "sleeping"
  currentTask: String
});

// --- AI 代理结构 (保持兼容并扩展) ---
const AgentSchema = new mongoose.Schema({
  id: Number,
  name: String,
  job: String,
  hp: { type: Number, default: 100 },
  hunger: { type: Number, default: 0 },
  sanity: { type: Number, default: 100 }, // 新增：理智/心情
  inventory: [String],
  x: { type: Number, default: 1 }, 
  y: { type: Number, default: 1 },
  locationName: String,
  actionLog: String, 
  avatarUrl: String
});

// --- 世界主结构 ---
const WorldSchema = new mongoose.Schema({
  turn: { type: Number, default: 0 },
  
  // 环境
  envDescription: String,
  weather: String,
  timeOfDay: String,
  
  // 舆论与剧情
  logs: [String], 
  socialNews: { type: String, default: "文明重启..." },
  
  // 经济系统 (全局资源)
  globalResources: {
    wood: { type: Number, default: 50 },
    stone: { type: Number, default: 20 },
    food: { type: Number, default: 50 },
    medicine: { type: Number, default: 5 },
    tech_point: { type: Number, default: 0 } // 科技点
  },

  // 实体列表
  agents: [AgentSchema], // 10名精英
  npcs: [NPCSchema],     // 5名苦工
  buildings: [BuildingSchema], // 建筑列表
  
  lastPlayerAction: { type: Number, default: 0 } // 用于判断是否触发议会
}, { 
  versionKey: false,
  timestamps: true
});

export const World = mongoose.models.World || mongoose.model('World', WorldSchema);
