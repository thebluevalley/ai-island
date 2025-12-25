'use client';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [logs, setLogs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [turn, setTurn] = useState(0);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  // 轮询获取数据
  const fetchData = async () => {
    try {
      // 这里的 API 需要你自己简单实现一个 GET /api/state 
      // 为了演示方便，我们假设 tick 接口也返回全量数据，或者你可以另写一个接口
      // 这里我们直接用 fetch tick 的逻辑
    } catch (e) { console.error(e); }
  };

  // 自动触发演化 (心跳)
  useEffect(() => {
    const timer = setInterval(async () => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await fetch('/api/tick', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            // 简单起见，这里建议刷新页面或者重新拉取数据
            // 实际项目中，你应该把获取数据 (GET) 和 触发演化 (POST) 分开
            window.location.reload(); 
        }
      } catch (e) {
        console.error("演化失败", e);
      } finally {
        setLoading(false);
      }
    }, 12000); // 12秒一次
    return () => clearInterval(timer);
  }, [loading]);
  
  // 页面加载时获取初始数据 (你需要补充一个 GET /api/read 接口来读取数据库，这里省略代码以免太长)
  // 临时方案：直接渲染简单的静态 UI 占位，等连上数据库就能看到动态内容

  return (
    <main className="min-h-screen bg-black text-green-500 font-mono text-sm flex flex-col p-4 pb-safe">
      <div className="flex-1 overflow-y-auto space-y-3 mb-48">
        {/* 这里渲染 logs */}
        <div className="border-b border-green-900 pb-2 mb-4">
          <h1 className="text-xl font-bold">>>> AI_ISLAND_SIM_V1.0</h1>
          <p className="text-gray-500 text-xs">STATUS: {loading ? "CALCULATING..." : "IDLE"}</p>
        </div>
        
        {/* 模拟日志显示 */}
        <p>[系统] 正在连接卫星信号...</p>
        <p>[系统] 4名实验体生命体征平稳。</p>
        {loading && <p className="animate-pulse">>>> 正在推演下一回合平行宇宙...</p>}
        
        <div ref={endRef} />
      </div>

      {/* 底部固定仪表盘 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur border-t border-green-800 p-4 pb-8">
        <div className="grid grid-cols-2 gap-2">
           {/* 模拟数据卡片 */}
           <div className="bg-black border border-green-800 p-2 rounded">
             <div className="flex justify-between"><span className="font-bold">铁头</span> <span>HP:100</span></div>
             <div className="text-xs text-gray-400">木棍 | 饥饿:20</div>
           </div>
           <div className="bg-black border border-green-800 p-2 rounded">
             <div className="flex justify-between"><span className="font-bold">医生</span> <span>HP:90</span></div>
             <div className="text-xs text-gray-400">绷带 | 饥饿:15</div>
           </div>
        </div>
      </div>
    </main>
  );
}