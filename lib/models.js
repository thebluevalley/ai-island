import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  id: Number,
  name: String,
  gender: String, // 新增：性别
  age: Number,    // 新增：年龄
  job: String,    // 新增：职业
  backstory: String, // 新增：成长经历/性格
  personality: String, 
  hp: { type: Number, default: 100 },
  hunger: { type: Number, default: 0 },
  inventory: [String],
  // 新增：坐标系统 (0-2)
  x: { type: Number, default: 1 }, 
  y: { type: Number, default: 1 },
  locationName: String, // 当前地点名称
  actionLog: String, // 记录上一步具体做了什么，用于显示
});

const WorldSchema = new mongoose.Schema({
  turn: { type: Number, default: 0 },
  // 新增：独立的环境描写，不再混在 log 里
  envDescription: { type: String, default: "海风轻轻吹拂着沙滩，海浪拍打着礁石，一切显得格外宁静。" },
  weather: { type: String, default: "晴朗" },
  timeOfDay: { type: String, default: "清晨" }, // 上午/下午/晚上
  logs: [String], 
  agents: [AgentSchema],
  lastUpdated: { type: Date, default: Date.now }
}, { 
  versionKey: false 
});

export const World = mongoose.models.World || mongoose.model('World', WorldSchema);