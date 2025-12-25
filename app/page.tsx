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
    desc: "正在建立卫星连接...",
    day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- API 逻辑 ---
  const fetchData = async () => {
     if (loading || isPaused) return;
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
       console.error(e);
     } finally {
       setLoading(false);
     }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ 警告：确定要毁灭当前世界并重新开始吗？")) return;
    setIsPaused(true);
    setLogs(["正在重置时间线..."]);
    try {
      await fetch('/api/reset', { method: 'POST' });
      window.location.reload();
    } catch (e) {
      alert("重置失败");
      setIsPaused(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!isPaused) fetchData(); }, 12000);
    return () => clearInterval(timer);
  }, [isPaused]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [logs]);

  return (
    // 全局背景使用暖灰色 Stone-100
    <div className="flex flex-col h-[100dvh] w-full bg-stone-100 text-stone-800 font-sans overflow-hidden">
      
      {/* --- Header: 磨砂玻璃质感 --- */}
      <header className="shrink-0 h-16 bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 flex justify-between items-center z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-stone-900 text-white rounded-lg flex items-center justify-center font-bold font-serif text-lg">AI</div>
          <div>
            <h1 className="font-bold text-lg tracking-wider text-stone-800 uppercase">Island Simulator</h1>
            <p className="text-[10px] text-stone-500 tracking-widest uppercase">Generative Storytelling</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {/* 状态胶囊 */}
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${loading ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></div>
              {loading ? "PROCESSING..." : "LIVE"}
           </div>

           <div className="h-6 w-[1px] bg-stone-200"></div>

           <button onClick={() => setIsPaused(!isPaused)} className="text-stone-500 hover:text-stone-800 transition-colors">
             {isPaused ? "▶ 继续" : "⏸ 暂停"}
           </button>
           <button onClick={handleReset} className="text-red-400 hover:text-red-600 transition-colors text-sm">
             重置
           </button>
        </div>
      </header>

      {/* --- Main Content Grid --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 左栏：环境仪表盘 (20%) - 视觉重点 */}
        <aside className="w-72 bg-white border-r border-stone-200 flex flex-col hidden md:flex z-20">
          <div className="p-6 space-y-6">
            
            {/* 1. 天气卡片 */}
            <div>
              <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Environment</h2>
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-3xl">🌤</span>
                  <div className="text-right">
                    <div className="text-xl font-bold text-stone-800">{envInfo.weather}</div>
                    <div className="text-xs text-stone-500 uppercase tracking-wide">Day {envInfo.day} · {envInfo.time}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 环境描写 (单独显示) */}
            <div>
              <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Atmosphere</h2>
              <div className="relative pl-4 border-l-2 border-stone-300">
                <p className="text-sm text-stone-600 italic leading-relaxed font-serif">
                  “{envInfo.desc}”
                </p>
              </div>
            </div>

            {/* 3. 装饰性地图占位 */}
            <div className="pt-6 border-t border-stone-100">
               <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Location</h2>
               <div className="w-full aspect-video bg-stone-100 rounded-lg border border-stone-200 border-dashed flex items-center justify-center">
                 <span className="text-xs text-stone-400 font-mono">MAP SYSTEM ONLINE</span>
               </div>
            </div>

          </div>
        </aside>

        {/* 中栏：沉浸式阅读区 (55%) - 优化排版 */}
        <main className="flex-1 bg-[#fcfaf8] relative flex flex-col min-w-0 shadow-inner">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10">
            {logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-stone-300 gap-4">
                <div className="animate-spin text-2xl">⏳</div>
                <p className="font-serif italic">Creating World...</p>
              </div>
            )}
            
            {logs.map((log, i) => (
              <article key={i} className="max-w-3xl mx-auto group">
                {/* 装饰性的章节号 */}
                <div className="flex items-center gap-4 mb-4 opacity-30 group-hover:opacity-100 transition-opacity">
                   <span className="h-[1px] w-8 bg-stone-400"></span>
                   <span className="text-[10px] font-mono text-stone-500">LOG {String(i + 1).padStart(3, '0')}</span>
                </div>

                {/* 正文：增加字号，增加行高，使用衬线体 */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100/50">
                  <p className="text-lg leading-9 text-stone-800 font-serif text-justify tracking-wide">
                    {log}
                  </p>
                </div>
              </article>
            ))}
            <div className="h-20"></div>
          </div>
          
          {/* 底部渐变遮罩 */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#fcfaf8] to-transparent pointer-events-none"></div>
        </main>

        {/* 右栏：幸存者状态 (25%) - 修复拥挤问题 */}
        <aside className="w-80 bg-white border-l border-stone-200 flex flex-col z-20">
          <div className="p-4 border-b border-stone-100 bg-white/95 sticky top-0 z-10 backdrop-blur">
             <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Survivors Status</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 duration-300">
                
                {/* 头部：名字与血量分离 */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-stone-800 text-lg">{agent.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded uppercase tracking-wider">{agent.job}</span>
                    </div>
                  </div>
                  {/* 血量圈 */}
                  <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-full border-2 ${agent.hp > 50 ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-rose-100 bg-rose-50 text-rose-600'}`}>
                    <span className="text-xs font-bold">{agent.hp}</span>
                    <span className="text-[8px] font-bold opacity-50">HP</span>
                  </div>
                </div>

                {/* 进度条区域 */}
                <div className="space-y-3 mb-4">
                  {/* 饥饿度 */}
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-400 mb-1 uppercase tracking-wider">
                      <span>Energy</span>
                      <span>{100 - agent.hunger}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-400 rounded-full" style={{width: `${100 - agent.hunger}%`}}></div>
                    </div>
                  </div>
                </div>

                {/* 底部信息：位置与动作 */}
                <div className="pt-3 border-t border-stone-100 space-y-2">
                   <div className="flex items-start gap-2 text-xs text-stone-600">
                      <span className="mt-0.5">📍</span>
                      <span className="font-medium">{agent.locationName}</span>
                   </div>
                   <div className="flex items-start gap-2 text-xs text-stone-500 italic">
                      <span className="mt-0.5">💭</span>
                      <span className="leading-tight">“{agent.actionLog}”</span>
                   </div>
                   {agent.inventory.length > 0 && (
                     <div className="flex flex-wrap gap-1 mt-1">
                       {agent.inventory.map((item, idx) => (
                         <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded border border-stone-200">
                           {item}
                         </span>
                       ))}
                     </div>
                   )}
                </div>

              </div>
            ))}
          </div>
        </aside>

      </div>
    </div>
  );
}