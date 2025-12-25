'use client';
import { useState, useEffect, useRef } from 'react';

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
    desc: "正在扫描...",
    news: "暂无社会动态", // 新增
    day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
           news: data.world.socialNews || "社会秩序平稳", // 获取八卦
           day: Math.floor((data.world.turn - 1) / 6) + 1
         });
       }
     } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ 警告：确定要重置世界吗？")) return;
    setIsPaused(true);
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!isPaused) fetchData(); }, 12000);
    return () => clearInterval(timer);
  }, [isPaused]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [logs]);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-stone-100 text-stone-800 font-sans overflow-hidden">
      {/* 顶部栏 */}
      <header className="shrink-0 h-14 bg-white/90 backdrop-blur border-b border-stone-200 px-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-2">
          <div className="bg-stone-900 text-white px-2 rounded font-serif font-bold">AI</div>
          <span className="font-bold tracking-wide uppercase text-sm hidden md:inline">Island Society</span>
        </div>
        
        {/* 新增：滚动新闻条 (Social News) */}
        <div className="flex-1 mx-4 overflow-hidden relative h-8 bg-amber-50 rounded border border-amber-100 flex items-center px-3">
           <span className="text-xs font-bold text-amber-600 mr-2 shrink-0">NEWS:</span>
           <span className="text-xs text-amber-800 truncate animate-pulse">{envInfo.news}</span>
        </div>

        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`}></div>
           <button onClick={() => setIsPaused(!isPaused)} className="text-xs border px-2 py-1 rounded bg-white hover:bg-stone-50">
             {isPaused ? "▶" : "⏸"}
           </button>
           <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 px-2">↺</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：环境 (20%) */}
        <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col p-5 space-y-6">
           <div>
             <h2 className="text-[10px] font-bold text-stone-400 uppercase mb-2">Environment</h2>
             <div className="text-3xl mb-1">🌤 {envInfo.weather}</div>
             <div className="text-xs text-stone-500">Day {envInfo.day} · {envInfo.time}</div>
           </div>
           <div className="pl-3 border-l-2 border-stone-300">
             <p className="text-xs text-stone-600 italic font-serif leading-relaxed">“{envInfo.desc}”</p>
           </div>
        </aside>

        {/* 中栏：故事 (50%) */}
        <main className="flex-1 bg-[#fcfaf8] relative flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8">
            {logs.map((log, i) => (
              <article key={i} className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-stone-100">
                <div className="text-[10px] text-stone-400 font-mono mb-2">LOG #{i+1}</div>
                <p className="text-base leading-8 text-stone-800 font-serif text-justify">{log}</p>
              </article>
            ))}
            <div className="h-12"></div>
          </div>
        </main>

        {/* 右栏：8人状态 (30%) */}
        <aside className="w-80 bg-white border-l border-stone-200 flex flex-col z-20">
          <div className="p-3 border-b border-stone-100 bg-stone-50 text-[10px] font-bold text-stone-400 uppercase text-center">
            8 Survivors Online
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                {/* 装饰背景 */}
                <div className="absolute top-0 right-0 w-12 h-12 bg-stone-50 rounded-bl-full -mr-4 -mt-4"></div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <div className="font-bold text-sm text-stone-800">{agent.name} <span className="text-[10px] font-normal text-stone-500">({agent.job})</span></div>
                    <div className="text-[10px] text-stone-400">📍 {agent.locationName}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 rounded ${agent.hp>50?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>HP {agent.hp}</span>
                </div>
                
                {/* 动作日志 - 重点显示 */}
                <div className="text-xs text-stone-600 bg-stone-50 p-2 rounded border border-stone-100 italic">
                  "{agent.actionLog}"
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}