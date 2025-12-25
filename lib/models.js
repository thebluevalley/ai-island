import mongoose from 'mongoose';

const BuildingSchema = new mongoose.Schema({
  type: String, name: String, x: Number, y: Number, 
  status: { type: String, default: "blueprint" }, 
  progress: { type: Number, default: 0 }, 
  maxProgress: { type: Number, default: 100 },
  desc: String
});

const NPCSchema = new mongoose.Schema({
  id: String, name: String, role: String, state: String, currentTask: String
});

// --- Agent 结构升级：增加记忆与社交 ---
const AgentSchema = new mongoose.Schema({
  id: Number,
  name: String,
  job: String,
  hp: { type: Number, default: 100 },
  hunger: { type: Number, default: 0 },
  
  // 空间感知
  x: { type: Number, default: 1 },
  y: { type: Number, default: 1 },
  locationName: String,

  // Smallville 核心：记忆流
  memories: [String], // ["看见张伟在砍树", "觉得今天天气不错"]
  
  // 社交关系: key是名字, value是好感度(-100~100)
  relationships: { type: Map, of: Number, default: {} },
  
  // 当前意图
  currentPlan: String, // "计划去海边找食物"
  actionLog: String,
});

const WorldSchema = new mongoose.Schema({
  turn: { type: Number, default: 0 },
  envDescription: String,
  weather: String,
  socialNews: { type: String, default: "文明重启..." },
  logs: [String], 
  
  globalResources: {
    wood: { type: Number, default: 50 },
    stone: { type: Number, default: 20 },
    food: { type: Number, default: 50 },
    medicine: { type: Number, default: 5 }
  },

  agents: [AgentSchema],
  npcs: [NPCSchema],
  buildings: [BuildingSchema]
}, { versionKey: false, timestamps: true });

export const World = mongoose.models.World || mongoose.model('World', WorldSchema);