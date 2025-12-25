'use client';
import { useState, useEffect, useRef } from 'react';

// 类型定义
type Agent = {
  id: number;
  name: string;
  job: string;
  gender: string;
  hp: number;
  hunger: number;
  inventory: string[];
  locationName: string;
  actionLog: string;
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "...",
    time: "...",
    desc: "正在同步卫星数据...",
    day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  
  // 状态控制
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // 暂停状态
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- 核心功能函数 ---

  // 1. 获取数据的通用函数
  const fetchData = async () => {
     if (loading || isPaused) return; // 如果暂停了，就不请求
     setLoading(true);
     try {
       const res = await fetch('/api/tick', { method: 'POST' });
       const data = await res.json();
       
       if (data.success && data.world) {
         setLogs(data.world.logs);
         setAgents(data.world.agents);
         setEnvInfo({
           weather: data.world.weather,
           time: data.world.timeOfDay,
           desc: data.world.envDescription,
           day: Math.floor((data.world.turn - 1) / 6) + 1
         });
       }
     } catch (e) {
       console.error("连接中断:", e);
     } finally {
       setLoading(false);
     }
  };

  // 2. 重置世界
  const handleReset = async () => {
    if (!confirm("⚠️ 警告：确定要毁灭当前世界并重新开始吗？所有进度将丢失！")) return;
    
    setIsPaused(true); // 先暂停
    setLogs(["正在重置时间线..."]);
    
    try {
      await fetch('/api/reset', { method: 'POST' });
      // 重置后刷新页面，让 tick 接口重建世界
      window.location.reload();
    } catch (e) {
      alert("重置失败，请检查网络");
      setIsPaused(false);
    }
  };

  // --- 生命周期 ---

  // 初始化加载
  useEffect(() => {
    fetchData();
  }, []); // 只在挂载时执行一次

  // 定时器循环 (心跳)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPaused) fetchData();
    }, 12000); // 12秒一回合
    return () => clearInterval(timer);
  }, [isPaused]); // 当暂停状态改变时，重新设置定时器

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    // 全屏容器：背景灰白，禁止body滚动
    <div className="flex flex-col h-[100dvh] w-full bg-gray-100 text-slate-800 font-sans overflow-hidden">
      
      {/* --- 顶部导航栏 (Header) --- */}
      <header className="shrink-0 h-16 bg-white border-b border-gray-200 px-6 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-black text-white font-bold px-2 py-1 rounded text-sm">AI</div>
          <h1 className="font-bold text-lg tracking-wide text-slate-900">ISLAND_SIMULATOR</h1>
          <span className="text-xs text-gray-400 border-l pl-3 ml-1 border-gray-300">
            自动存档中...
          </span>
        </div>

        <div className="flex items-center gap-3">
           {/* 状态指示灯 */}
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border ${loading ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-ping' : 'bg-gray-400'}`}></div>
              {loading ? "CALCULATING" : "IDLE"}
           </div>

           {/* 控制按钮组 */}
           <button 
             onClick={() => setIsPaused(!isPaused)}
             className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors border ${isPaused ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
           >
             {isPaused ? "▶ 继续演化" : "⏸ 暂停"}
           </button>
           
           <button 
             onClick={handleReset}
             className="px-4 py-1.5 rounded-md text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
           >
             ↺ 重置世界
           </button>
        </div>
      </header>

      {/* --- 主内容区 (三栏布局) --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 左栏：环境信息 (20%) */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Environment</h2>
            <div className="space-y-4">
              <div>
                <div className="text-4xl mb-1">🌤</div>
                <div className="text-xl font-semibold text-slate-800">{envInfo.weather}</div>
                <div className="text-sm text-gray-500">Day {envInfo.day} · {envInfo.time}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600 italic leading-relaxed">
                {envInfo.desc}
              </div>
            </div>
          </div>
          <div className="flex-1 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Coordinates</h2>
            <div className="w-full aspect-square bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center text-xs text-gray-400">
              [地图系统运行中]
            </div>
          </div>
        </aside>

        {/* 中栏：剧情小说 (55%) */}
        <main className="flex-1 bg-gray-50 relative flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
            {logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <div className="animate-spin text-2xl">⏳</div>
                <p>正在初始化世界数据...</p>
              </div>
            )}
            
            {logs.map((log, i) => (
              <div key={i} className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                {/* 模拟书页效果 */}
                <p className="text-slate-700 leading-8 text-lg text-justify font-serif">
                  {log}
                </p>
                <div className="mt-4 flex justify-end">
                   <span className="text-[10px] text-gray-300 font-mono">LOG_ID_{i}</span>
                </div>
              </div>
            ))}
            
            <div className="h-10"></div> {/* 底部留白 */}
          </div>
          
          {/* 暂停遮罩 */}
          {isPaused && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="bg-white px-6 py-4 rounded-lg shadow-xl border border-gray-200 flex flex-col items-center">
                <span className="text-2xl mb-2">⏸</span>
                <span className="font-bold text-slate-700">时间已暂停</span>
                <span className="text-xs text-gray-500 mt-1">点击顶部“继续”按钮恢复</span>
              </div>
            </div>
          )}
        </main>

        {/* 右栏：角色状态 (25%) */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-5 sticky top-0 bg-white z-10 border-b border-gray-100">
             <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Survivors Status</h2>
          </div>
          
          <div className="p-4 space-y-4">
            {agents.map(agent => (
              <div key={agent.id} className="group relative bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-blue-300 transition-colors">
                {/* 角色头图/名字 */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{agent.name}</h3>
                    <p className="text-xs text-slate-500">{agent.job} · {agent.gender}</p>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded font-mono font-bold ${agent.hp > 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    HP {agent.hp}
                  </div>
                </div>

                {/* 进度条 */}
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-[10px] text-gray-500 uppercase">
                    <span>Hunger</span>
                    <span>{agent.hunger}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all duration-500" style={{width: `${agent.hunger}%`}}></div>
                  </div>
                </div>

                {/* 详情 */}
                <div className="bg-slate-50 rounded-lg p-2 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>📍</span>
                    <span className="font-medium">{agent.locationName}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <span>🎒</span>
                    <span className="leading-tight">{agent.inventory.join(', ')}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 text-slate-500 italic">
                    “{agent.actionLog}”
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

      </div>
      
      {/* 移动端底部遮罩 (仅在屏幕太窄时显示提示，建议横屏或用电脑) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black text-white text-xs p-2 text-center opacity-80 z-50">
        建议使用桌面端浏览器以获得最佳体验
      </div>

    </div>
  );
}