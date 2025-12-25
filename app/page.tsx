'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';

type Agent = {
  id: number;
  name: string;
  job: string;
  hp: number;
  hunger: number;
  inventory: string[];
  locationName: string;
  actionLog: string;
  avatarUrl?: string;
};

// 备用：Notion 风格
const getFallbackAvatar = (seed: string) => {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "--",
    time: "--",
    desc: "正在读取记录...",
    news: "...", 
    day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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
           news: data.world.socialNews || "无特别新闻",
           day: Math.floor((data.world.turn - 1) / 6) + 1
         });
       }
     } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ 确定要重置世界吗？")) return;
    setIsPaused(true);
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!isPaused) fetchData(); }, 12000);
    return () => clearInterval(timer);
  }, [isPaused]);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#f8f9fa] text-gray-800 font-sans overflow-hidden">
      
      {/* Top Bar */}
      <header className="shrink-0 h-14 bg-white border-b border-gray-200 px-6 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <div className="bg-black text-white w-8 h-8 flex items-center justify-center font-bold text-lg rounded-md">AI</div>
          <h1 className="font-bold tracking-widest text-sm uppercase">Survival Log</h1>
        </div>
        <div className="flex-1 mx-8 hidden md:flex items-center bg-gray-50 rounded-full px-5 py-2 border border-gray-200">
           <span className="text-[10px] font-bold text-red-500 mr-3 uppercase">News</span>
           <span className="text-xs text-gray-600 truncate">{envInfo.news}</span>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsPaused(!isPaused)} className="px-3 py-1 rounded border border-gray-300 bg-white text-xs hover:bg-gray-50 transition-colors">
             {isPaused ? "▶ Resume" : "⏸ Pause"}
           </button>
           <button onClick={handleReset} className="px-3 py-1 rounded border border-red-200 bg-red-50 text-red-500 text-xs hover:bg-red-100 transition-colors">
             Reset
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Environment */}
        <aside className="w-72 bg-white border-r border-gray-200 hidden md:flex flex-col p-6 space-y-8">
           <div className="text-center p-6 bg-gray-50 rounded-xl border border-gray-100">
             <div className="text-5xl mb-3">🌤</div>
             <div className="text-xl font-bold text-gray-800">{envInfo.weather}</div>
             <div className="text-xs text-gray-400 font-mono mt-2 uppercase tracking-wide">Day {envInfo.day} · {envInfo.time}</div>
           </div>
           <div>
             <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Report</h3>
             <p className="text-sm text-gray-600 leading-7 font-serif border-l-2 border-gray-200 pl-4">“{envInfo.desc}”</p>
           </div>
        </aside>

        {/* Middle: Logs */}
        <main className="flex-1 bg-[#f3f4f6] flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {[...logs].reverse().map((log, index) => {
              const realIndex = logs.length - index;
              const isNewest = index === 0;
              return (
                <div key={realIndex} className={`flex gap-4 ${isNewest ? 'opacity-100' : 'opacity-70 hover:opacity-100 transition-opacity'}`}>
                   <div className="text-[10px] font-mono text-gray-400 pt-3 w-8 text-right">#{realIndex}</div>
                   <div className={`flex-1 p-5 rounded-xl border ${isNewest ? 'bg-white border-gray-300 shadow-md' : 'bg-gray-50 border-gray-200'}`}>
                     <p className="text-[15px] leading-7 text-gray-700 font-serif text-justify">{log}</p>
                   </div>
                </div>
              );
            })}
            <div className="h-12"></div>
          </div>
        </main>

        {/* Right: Survivors (Clean Card Layout) */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col z-20">
          <div className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Survivors List</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                
                {/* 1. Header: Avatar + Name + Stats */}
                <div className="flex gap-4 mb-3">
                  {/* Avatar */}
                  <div className="relative w-14 h-14 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shrink-0">
                    <Image 
                      src={agent.avatarUrl || getFallbackAvatar(agent.name)} 
                      alt={agent.name}
                      fill
                      className="object-cover"
                      unoptimized={true} // Mandatory for external images
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-gray-800">{agent.name}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{agent.job}</span>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-1">
                      {/* HP */}
                      <div className="flex items-center gap-2">
                         <span className="text-[8px] font-bold text-gray-400 w-3">HP</span>
                         <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${agent.hp > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                         </div>
                      </div>
                      {/* Hunger */}
                      <div className="flex items-center gap-2">
                         <span className="text-[8px] font-bold text-gray-400 w-3">FD</span>
                         <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{width: `${Math.max(0, 100 - agent.hunger)}%`}}></div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Action Bubble */}
                <div className="relative bg-gray-50 p-2.5 rounded-lg border border-gray-100 mb-2">
                  <div className="absolute -top-1.5 left-6 w-3 h-3 bg-gray-50 border-t border-l border-gray-100 transform rotate-45"></div>
                  <p className="text-xs text-gray-600 italic leading-snug">“{agent.actionLog}”</p>
                </div>

                {/* 3. Footer: Loc + Inventory */}
                <div className="flex justify-between items-center pt-1">
                   <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                     <span>📍 {agent.locationName}</span>
                   </div>
                   
                   {agent.inventory.length > 0 && (
                     <div className="flex gap-1">
                       {agent.inventory.slice(0, 3).map((item, i) => (
                         <span key={i} className="w-5 h-5 flex items-center justify-center bg-gray-100 border border-gray-200 rounded text-[10px] text-gray-500" title={item}>
                           📦
                         </span>
                       ))}
                       {agent.inventory.length > 3 && <span className="text-[10px] text-gray-400">...</span>}
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