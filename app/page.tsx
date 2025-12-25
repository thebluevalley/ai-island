'use client';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 核心引擎：每 10 秒触发一次后端演化
  useEffect(() => {
    // 页面加载时先读取一次状态（防止页面空白）
    // 这里的 fetch 可以根据你的实际 API 情况调整，这里复用 tick 逻辑演示
    
    const timer = setInterval(async () => {
      if (loading) return; 
      setLoading(true);
      
      try {
        // 1. 触发演化
        const res = await fetch('/api/tick', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
          // 这里为了演示简单，直接把新日志加进去
          // 实际项目中最好有一个 GET /api/state 接口来拉取完整数据
          setLogs(prev => [...prev, data.log]);
          
          // 如果后端返回了 agents 数据，也可以在这里更新
          // setAgents(data.agents); 
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
    <main className="min-h-screen bg-black text-green-500 font-mono text-sm flex flex-col p-4 pb-safe">
      <div className="flex-1 overflow-y-auto space-y-3 mb-48">
        
        {/* 头部标题 - 已修复 >>> 问题 */}
        <div className="border-b border-green-900 pb-2 mb-4">
          <h1 className="text-xl font-bold">{'>>>'} AI_ISLAND_SIM_V1.0</h1>
          <p className="text-gray-500 text-xs">STATUS: {loading ? "CALCULATING..." : "IDLE"}</p>
        </div>
        
        {/* 模拟的初始系统日志 */}
        <p>[系统] 正在连接卫星信号...</p>
        <p>[系统] 4名实验体生命体征平稳。</p>

        {/* 动态日志渲染 */}
        {logs.map((log, i) => (
          <p key={i} className="mb-1 border-l-2 border-green-900 pl-2">
            {log}
          </p>
        ))}

        {/* Loading 状态 - 已修复 >>> 问题 */}
        {loading && (
          <p className="animate-pulse text-green-300">
            {'>>>'} 正在推演下一回合平行宇宙...
          </p>
        )}
        
        <div ref={endRef} />
      </div>

      {/* 底部固定仪表盘 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur border-t border-green-800 p-4 pb-8">
        <div className="grid grid-cols-2 gap-2">
           {/* 这里的 Agents 数据是静态演示，你可以对接真实数据 */}
           <div className="bg-black border border-green-800 p-2 rounded">
             <div className="flex justify-between"><span className="font-bold">铁头</span> <span>HP:100</span></div>
             <div className="text-xs text-gray-400">木棍 | 饥饿:20</div>
           </div>
           <div className="bg-black border border-green-800 p-2 rounded">
             <div className="flex justify-between"><span className="font-bold">医生</span> <span>HP:90</span></div>
             <div className="text-xs text-gray-400">绷带 | 饥饿:15</div>
           </div>
           <div className="bg-black border border-green-800 p-2 rounded">
             <div className="flex justify-between"><span className="font-bold">骗子</span> <span>HP:85</span></div>
             <div className="text-xs text-gray-400">硬币 | 饥饿:10</div>
           </div>
           <div className="bg-black border border-green-800 p-2 rounded">
             <div className="flex justify-between"><span className="font-bold">仓鼠</span> <span>HP:100</span></div>
             <div className="text-xs text-gray-400">饼干 | 饥饿:0</div>
           </div>
        </div>
      </div>
    </main>
  );
}