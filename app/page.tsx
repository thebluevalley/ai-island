'use client';
import { useState, useEffect, useRef } from 'react';

// 定义 Agent 的数据结构，方便后续使用
type Agent = {
  id: number;
  name: string;
  hp: number;
  hunger: number;
  inventory: string[];
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  // 预设一些初始数据，这样页面一加载就不会是空的，方便调试样式
  const [agents, setAgents] = useState<Agent[]>([
    { id: 0, name: "铁头", hp: 100, hunger: 20, inventory: ["木棍"] },
    { id: 1, name: "医生", hp: 90, hunger: 15, inventory: ["绷带"] },
    { id: 2, name: "骗子", hp: 85, hunger: 10, inventory: ["硬币"] },
    { id: 3, name: "仓鼠", hp: 100, hunger: 0, inventory: ["饼干"] },
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 核心引擎：每 10 秒触发一次后端演化
  useEffect(() => {
    const timer = setInterval(async () => {
      if (loading) return; 
      setLoading(true);
      
      try {
        // 1. 触发演化
        const res = await fetch('/api/tick', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
          setLogs(prev => [...prev, data.log]);
          // 假设后端也会返回最新的 agents 状态
          if (data.agents) {
            setAgents(data.agents);
          }
        }
      } catch (e) {
        console.error("AI 累了:", e);
      } finally {
        setLoading(false);
      }
    }, 10000); // 10秒一次心跳

    return () => clearInterval(timer);
  }, [loading]);

  return (
    // 主容器：浅色背景，深色文字
    <main className="min-h-screen bg-gray-50 text-gray-900 font-mono text-sm flex flex-col">
      
      {/* --- 上半部分：日志滚动区 --- */}
      {/* pb-48 是为了给底部的固定栏留出空间 */}
      <div className="flex-1 overflow-y-auto p-4 pb-48 space-y-3">
        
        {/* 标题栏：浅灰边框 */}
        <div className="border-b border-gray-200 pb-3 mb-4">
          <h1 className="text-xl font-bold tracking-wider">{'>>>'} AI_ISLAND_SIM_V1.0</h1>
          <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
            <span className={`inline-block w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`}></span>
            <span>STATUS: {loading ? "CALCULATING..." : "ONLINE"}</span>
          </div>
        </div>
        
        {/* 初始系统日志 */}
        <p className="text-gray-600">[系统] 卫星信号已连接。</p>
        <p className="text-gray-600">[系统] 实验体生命体征监测中...</p>

        {/* 动态日志渲染：使用深色左边框做强调 */}
        <div className="space-y-2">
          {logs.map((log, i) => (
            <div key={i} className="pl-3 border-l-2 border-gray-300 py-1 leading-relaxed bg-white shadow-sm rounded-r-md">
              <p>{log}</p>
            </div>
          ))}
        </div>

        {/* Loading 状态：使用柔和的蓝色 */}
        {loading && (
          <p className="animate-pulse text-blue-600 font-medium pt-2">
            {'>>>'} 正在推演下一回合平行宇宙...
          </p>
        )}
        
        {/* 滚动锚点 */}
        <div ref={endRef} className="h-4" />
      </div>

      {/* --- 下半部分：底部固定仪表盘 --- */}
      {/* 使用白色半透明背景和顶部边框，营造层次感 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <h2 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">实验体状态监控</h2>
        
        {/* 使用 Grid 布局彻底解决重叠问题，2列整齐排列 */}
        <div className="grid grid-cols-2 gap-3">
           {agents.map(agent => (
             // 单个角色卡片：纯白背景，圆角，轻微阴影
             <div key={agent.id} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm flex flex-col space-y-1">
               <div className="flex justify-between items-center">
                 <span className="font-bold text-base">{agent.name}</span>
                 {/* 血量根据数值变色 */}
                 <span className={`font-mono font-bold ${agent.hp > 50 ? 'text-green-600' : 'text-red-600'}`}>
                   HP:{agent.hp}
                 </span>
               </div>
               <div className="text-xs text-gray-500 flex justify-between items-center bg-gray-50 p-1 rounded">
                 <span className="truncate max-w-[60%]">
                   🎒 {agent.inventory.length > 0 ? agent.inventory.join(',') : '空'}
                 </span>
                 <span>🍗 饥饿:{agent.hunger}</span>
               </div>
             </div>
           ))}
        </div>
      </div>
    </main>
  );
}