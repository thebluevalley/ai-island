import mongoose from 'mongoose';

// Agent 子文档结构
const AgentSchema = new mongoose.Schema({
  id: Number,
  name: String,
  personality: String,
  hp: { type: Number, default: 100 },
  hunger: { type: Number, default: 0 },
  inventory: [String],
  status: String, 
});

// World 主文档结构
const WorldSchema = new mongoose.Schema({
  turn: { type: Number, default: 0 },
  weather: { type: String, default: "晴朗" },
  logs: [String], 
  agents: [AgentSchema],
  lastUpdated: { type: Date, default: Date.now }
}, { 
  // --- 修复关键：关闭版本锁 ---
  // 这允许“最后一次写入”直接覆盖，不再检查 __v 版本号，
  // 从而彻底解决 VersionError 问题。
  versionKey: false 
});

// 防止热重载导致的各种模型重复定义错误
export const World = mongoose.models.World || mongoose.model('World', WorldSchema);