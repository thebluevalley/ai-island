import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  id: Number,
  name: String,
  gender: String,
  age: Number,
  job: String,
  personality: String,
  backstory: String,
  avatarUrl: String, // 头像字段
  hp: { type: Number, default: 100 },
  hunger: { type: Number, default: 0 },
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
  mapResources: { type: Object, default: {} },
  mapBuildings: { type: Object, default: {} },
  agents: [AgentSchema],
  lastUpdated: { type: Date, default: Date.now }
}, { 
  versionKey: false 
});

export const World = mongoose.models.World || mongoose.model('World', WorldSchema);