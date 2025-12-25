'use client';
import { useState, useEffect, useRef } from 'react';

// 定义数据类型，防止 TypeScript 报错
type Agent = {
  id: number;
  name: string;
  hp: number;
  hunger: number;
  inventory: string[];
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  // 预置数据用于展示 UI 效果，防止页面空白
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
        const res = await fetch('/api/tick', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
          setLogs(prev => [...prev, data.log]);
          if (data.agents) {
            setAgents(data.agents);
          }
        }
      } catch (e) {
        console.error("AI 累了:", e);
      } finally {
        setLoading(false);
      }
    }, 10000); // 10秒刷新一次

    return () => clearInterval(timer);
  }, [loading]);

  return (
    // 主容器：浅色背景(bg-gray-50)，深色文字(text-gray-900)
    <main className="flex flex-col h-[100dvh] bg-gray-50 text-gray-900 font-mono text-sm overflow-hidden">
      
      {/* --- 上半部分：标题与日志区域 --- */}
      {/* flex-1 让它占据剩余所有空间，overflow-y-auto 允许内部滚动 */}
      <div className="flex-1 overflow-y-auto p-4 pb-48">
        
        {/* 标题栏：清晰分隔，不再重叠 */}
        <div className="border-b border-gray-200 pb-4 mb-4 bg-gray-50 sticky top-0 z-10">
          <h1 className="text-xl font-bold tracking-wider text-black">
            {'>>>'} AI_ISLAND_SIM
          </h1>
          <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
            <span className={`inline-block w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`}></span>
            <span>STATUS: {loading ? "CALCULATING..." : "ONLINE"}</span>
          </div>
        </div>
        
        {/* 日志内容：左侧加深色线条装饰 */}
        <div className="space-y-3">
          {logs.length === 0 && <p className="text-gray-400 italic">正在等待卫星信号连接...</p>}
          
          {logs.map((log, i) => (
            <div key={i} className="pl-3 border-l-2 border-gray-300 py-1 bg-white shadow-sm rounded-r-md px-2">
              <p className="leading-relaxed">{log}</p>
            </div>
          ))}
        </div>

        {/* Loading 提示 */}
        {loading && (
          <p className="animate-pulse text-blue-600 font-medium pt-4 text-center">
            {'>>>'} 平行宇宙推演中...
          </p>
        )}
        
        {/* 滚动锚点 */}
        <div ref={endRef} className="h-4" />
      </div>

      {/* --- 下半部分：底部固定仪表盘 --- */}
      {/* 白色半透明背景，顶部加阴影，视觉上浮在日志上方 */}
      <div className="shrink-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <h2 className="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-widest text-center">
          —— 实验体状态监控 ——
        </h2>
        
        {/* 使用 Grid 布局，强制分为 2 列，防止卡片重叠 */}
        <div className="grid grid-cols-2 gap-3">
           {agents.map(agent => (
             <div key={agent.id} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm flex flex-col space-y-1 relative overflow-hidden group">
               {/* 一个淡淡的背景装饰 */}
               <div className="absolute top-0 right-0 w-8 h-8 bg-gray-50 rounded-bl-full -mr-2 -mt-2 group-hover:bg-blue-50 transition-colors"></div>
               
               <div className="flex justify-between items-center relative z-10">
                 <span className="font-bold text-base text-gray-800">{agent.name}</span>
                 {/* 血量根据数值变色：高血量绿色，低血量红色 */}
                 <span className={`font-mono font-bold ${agent.hp > 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                   HP:{agent.hp}
                 </span>
               </div>
               
               <div className="text-xs text-gray-500 flex flex-col space-y-1 mt-1">
                 <div className="flex justify-between">
                   <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 truncate max-w-[70%]">
                     {agent.inventory.length > 0 ? agent.inventory.join(' ') : '空'}
                   </span>
                   <span>饱食:{100 - agent.hunger}%</span>
                 </div>
               </div>
             </div>
           ))}
        </div>
      </div>
    </main>
  );
}