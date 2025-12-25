import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  id: Number,
  name: String,
  gender: String,
  age: Number,
  job: String,
  personality: String,
  backstory: String,
  hp: { type: Number, default: 100 },
  hunger: { type: Number, default: 0 }, // 注意：这里 0 是不饿，100 是饿死
  inventory: [String],
  x: { type: Number, default: 1 }, 
  y: { type: Number, default: 1 },
  locationName: String,
  actionLog: String, 
  relationships: { type: String, default: "{}" } 
});

const WorldSchema = new mongoose.Schema({
  turn: { type: Number, default: 0 },
  envDescription: String,
  weather: String,
  timeOfDay: String,
  logs: [String], 
  socialNews: { type: String, default: "暂无社会动态" },
  
  // --- 新增：地图资源层 ---
  // 格式: {"1,1": ["木头", "椰子"], "0,1": ["死鱼"]}
  mapResources: { type: Object, default: {} },
  
  // --- 新增：建筑层 ---
  // 格式: {"1,1": { name: "主营地", progress: 10, max: 100 }}
  mapBuildings: { type: Object, default: {} },

  agents: [AgentSchema],
  lastUpdated: { type: Date, default: Date.now }
}, { 
  versionKey: false 
});

export const World = mongoose.models.World || mongoose.model('World', WorldSchema);