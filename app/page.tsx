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
  // 初始演示数据
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

  // 核心循环：每 10 秒触发一次
  useEffect(() => {
    const timer = setInterval(async () => {
      if (loading) return; 
      setLoading(true);
      
      try {
        const res = await fetch('/api/tick', { method: 'POST' });
        
        // --- 错误诊断代码 ---
        if (!res.ok) {
           // 如果服务器返回 500/504 等错误，尝试读取错误文本
           const errText = await res.text();
           throw new Error(`服务器报错 (${res.status}): ${errText.slice(0, 100)}...`); 
        }
        // ------------------

        const data = await res.json();
        
        if (data.success) {
          setLogs(prev => [...prev, data.log]);
          if (data.agents) setAgents(data.agents);
        } else {
          // 如果后端虽然通了，但逻辑返回失败
          console.warn("逻辑错误:", data);
        }
      } catch (e: any) {
        console.error("请求失败:", e);
        // 关键：把错误直接显示在界面上，方便手机端调试
        setLogs(prev => [...prev, `[系统警报] 连接中断: ${e.message || "未知错误"}`]);
      } finally {
        setLoading(false);
      }
    }, 10000); 

    return () => clearInterval(timer);
  }, [loading]);

  return (
    // 最外层容器：强制占满屏幕高度，使用上下弹性布局
    <div className="flex flex-col h-[100dvh] w-full bg-gray-50 overflow-hidden">
      
      {/* --- 顶部：标题栏 (固定高度) --- */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold text-gray-900 tracking-wider">
            {'>>>'} AI_ISLAND_SIM
          </h1>
          <div className="flex items-center space-x-2">
            <span className={`block w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`} />
            <span className="text-xs font-mono text-gray-500">
              {loading ? "CALC..." : "LIVE"}
            </span>
          </div>
        </div>
      </header>
      
      {/* --- 中间：日志滚动区 (自动占据剩余空间) --- */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {logs.length === 0 && (
          <div className="text-center mt-10 text-gray-400 text-xs select-none">
            <p className="mb-2">正在建立卫星连接...</p>
            <p>等待第一次演化...</p>
          </div>
        )}

        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 text-sm group">
            <span className="text-gray-300 select-none opacity-50">|</span>
            {/* 根据是否是报错信息，显示不同颜色的边框 */}
            <div className={`
              p-2 rounded-lg shadow-sm border max-w-[90%] leading-relaxed text-gray-800
              ${log.includes('[系统警报]') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-100'}
            `}>
              {log}
            </div>
          </div>
        ))}

        {/* 底部 Loading 提示 */}
        {loading && (
          <div className="flex justify-center py-2">
             <span className="text-xs text-blue-500 animate-pulse font-mono">
               {'>>>'} 平行宇宙推演中...
             </span>
          </div>
        )}
        
        {/* 滚动锚点 */}
        <div ref={endRef} className="h-2" />
      </main>

      {/* --- 底部：仪表盘 (固定高度) --- */}
      <footer className="shrink-0 bg-white border-t border-gray-200 p-3 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-2 px-1">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            SURVIVOR STATUS
          </h2>
          <span className="text-[10px] text-gray-400 font-mono">DAY: 1</span>
        </div>
        
        {/* 2列 Grid 布局，整齐排列 */}
        <div className="grid grid-cols-2 gap-2 h-32 overflow-y-auto no-scrollbar">
           {agents.map(agent => (
             <div key={agent.id} className="relative bg-gray-50 border border-gray-200 p-2 rounded-lg flex flex-col justify-between">
               
               {/* 角色名与血量 */}
               <div className="flex justify-between items-center">
                 <span className="font-bold text-sm text-gray-800">{agent.name}</span>
                 <div className="flex items-center gap-1">
                   <span className={`text-xs font-mono font-bold ${agent.hp > 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                     {agent.hp}
                   </span>
                   <div className="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
                     <div 
                       className={`h-full ${agent.hp > 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                       style={{width: `${agent.hp}%`}}
                     />
                   </div>
                 </div>
               </div>
               
               {/* 物品与饥饿度 */}
               <div className="mt-2 flex justify-between items-end text-[10px] text-gray-500">
                 <span className="bg-white px-1 py-0.5 rounded border border-gray-100 truncate max-w-[60%]">
                   {agent.inventory.length > 0 ? agent.inventory.join(' ') : '空'}
                 </span>
                 <span>饱食:{100 - agent.hunger}%</span>
               </div>
             </div>
           ))}
        </div>
      </footer>
    </div>
  );
}