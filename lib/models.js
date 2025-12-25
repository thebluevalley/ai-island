import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  id: Number,
  name: String,
  personality: String,
  hp: { type: Number, default: 100 },
  hunger: { type: Number, default: 0 },
  inventory: [String],
  status: String, // 比如 "健康", "受伤"
});

const WorldSchema = new mongoose.Schema({
  turn: { type: Number, default: 0 },
  weather: { type: String, default: "晴朗" },
  logs: [String], // 存储每一回合的剧情文本
  agents: [AgentSchema],
  lastUpdated: { type: Date, default: Date.now }
});

// 防止热重载导致的各种模型重复定义错误
export const World = mongoose.models.World || mongoose.model('World', WorldSchema);