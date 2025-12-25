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

// 备用头像：使用 Boring Avatars Beam 风格
const getFallbackAvatar = (name: string) => {
  return `https://source.boringavatars.com/beam/120/${name}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`;
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "--",
    time: "--",
    desc: "读取中...",
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
    <div className="flex flex-col h-[100dvh] w-full bg-[#f3f4f6] text-slate-800 font-sans overflow-hidden">
      
      {/* 顶部栏 */}
      <header className="shrink-0 h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shadow-sm z-30">
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 text-white px-3 py-1 rounded font-bold text-lg tracking-wider">LOG</div>
          <div>
            <h1 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Survival Sim</h1>
            <p className="text-[10px] text-slate-400">STATUS: {loading ? 'SYNCING...' : 'ONLINE'}</p>
          </div>
        </div>
        <div className="flex-1 mx-8 hidden md:flex items-center bg-slate-50 rounded-full px-4 py-1.5 border border-slate-200">
           <span className="text-[10px] font-bold text-blue-600 mr-3 shrink-0 uppercase">News</span>
           <span className="text-xs text-slate-600 truncate">{envInfo.news}</span>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsPaused(!isPaused)} className="px-3 py-1 rounded border border-slate-300 bg-white text-xs hover:bg-slate-50">
             {isPaused ? "▶ Resume" : "⏸ Pause"}
           </button>
           <button onClick={handleReset} className="px-3 py-1 rounded border border-red-200 bg-red-50 text-red-500 text-xs hover:bg-red-100">
             Reset
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* 左栏：环境 */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col p-6 space-y-6">
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
             <div className="text-4xl mb-2">🌤</div>
             <div className="text-xl font-bold text-slate-700">{envInfo.weather}</div>
             <div className="text-xs text-slate-400 font-mono mt-1">DAY {envInfo.day} - {envInfo.time}</div>
           </div>
           <div>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Atmosphere</h3>
             <p className="text-sm text-slate-600 leading-6 italic font-serif">“{envInfo.desc}”</p>
           </div>
        </aside>

        {/* 中栏：日志 */}
        <main className="flex-1 bg-[#f3f4f6] flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {[...logs].reverse().map((log, index) => {
              const realIndex = logs.length - index;
              const isNewest = index === 0;
              return (
                <div key={realIndex} className={`flex gap-3 ${isNewest ? 'opacity-100' : 'opacity-70'}`}>
                   <div className="text-[10px] font-mono text-slate-400 pt-2 w-8 text-right">#{realIndex}</div>
                   <div className={`flex-1 p-5 rounded-lg border ${isNewest ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                     <p className="text-sm leading-7 text-slate-700 text-justify">{log}</p>
                   </div>
                </div>
              );
            })}
            <div className="h-12"></div>
          </div>
        </main>

        {/* 右栏：人物卡片 (重构版) */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col z-20">
          <div className="p-3 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase text-center tracking-widest">
            Survivors ({agents.length})
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8fafc]">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col gap-3">
                
                {/* 顶部：头像 + 基础信息 */}
                <div className="flex gap-3">
                  {/* 头像 */}
                  <div className="relative w-12 h-12 rounded-lg bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
                    <Image 
                      src={agent.avatarUrl || getFallbackAvatar(agent.name)} 
                      alt={agent.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  
                  {/* 信息 + 条状图 */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-sm text-slate-800">{agent.name}</span>
                      <span className="text-[10px] text-slate-400">{agent.job}</span>
                    </div>
                    
                    {/* HP 条 */}
                    <div className="flex items-center gap-2">
                       <div className="text-[9px] font-bold text-slate-400 w-4">HP</div>
                       <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${agent.hp > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                       </div>
                    </div>
                    
                    {/* 饥饿条 */}
                    <div className="flex items-center gap-2">
                       <div className="text-[9px] font-bold text-slate-400 w-4">SAT</div>
                       <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{width: `${Math.max(0, 100 - agent.hunger)}%`}}></div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* 底部：位置与动作 */}
                <div className="text-xs space-y-2">
                   {/* 气泡式日志 */}
                   <div className="relative bg-slate-50 p-2 rounded-lg text-slate-600 border border-slate-100 italic text-[11px] leading-snug">
                     <span className="absolute -top-1 left-4 w-2 h-2 bg-slate-50 border-t border-l border-slate-100 transform rotate-45"></span>
                     “{agent.actionLog}”
                   </div>

                   {/* 底部栏：位置 + 背包 */}
                   <div className="flex justify-between items-center pt-1">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                        <span>📍 {agent.locationName}</span>
                      </div>
                      <div className="flex gap-1">
                        {agent.inventory.map((item, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] text-slate-500">
                            {item}
                          </span>
                        ))}
                      </div>
                   </div>
                </div>

              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}