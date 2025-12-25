'use client';
import { useState, useEffect, useRef } from 'react';

// 类型定义
type Agent = {
  id: number;
  name: string;
  job: string;
  hp: number;
  hunger: number;
  inventory: string[];
  locationName: string;
  actionLog: string;
};

// --- 1. 零依赖·本地头像组件 (100% 解决 VPN/图片裂开问题) ---
// 根据名字生成固定的颜色，确保刷新后颜色不变
const getIdentityColor = (name: string) => {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const TacticalAvatar = ({ name, job }: { name: string, job: string }) => {
  const colorClass = getIdentityColor(name);
  return (
    <div className={`w-12 h-12 ${colorClass} rounded-lg flex flex-col items-center justify-center shadow-inner border-2 border-white/20 shrink-0 text-white`}>
      <span className="text-sm font-bold leading-none mt-1">{name[0]}</span>
      <span className="text-[8px] opacity-80 uppercase scale-75 leading-tight">{job.slice(0,2)}</span>
    </div>
  );
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "--", time: "--", desc: "SYSTEM OFFLINE", news: "WAITING FOR SIGNAL...", day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // 控制右侧栏哪张卡片被展开 (ID)
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
    if (!confirm("⚠️ 警告：这将清除所有生存数据。确认重置？")) return;
    setIsPaused(true);
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!isPaused) fetchData(); }, 12000);
    return () => clearInterval(timer);
  }, [isPaused]);

  // 切换展开/收起状态
  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#e5e5e5] text-stone-800 font-sans overflow-hidden">
      
      {/* 顶部栏 */}
      <header className="shrink-0 h-14 bg-stone-900 border-b border-stone-800 px-6 flex justify-between items-center z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 text-stone-900 w-8 h-8 flex items-center justify-center font-bold rounded">AI</div>
          <h1 className="font-bold tracking-widest text-sm uppercase text-stone-100">Survival Protocol</h1>
        </div>
        <div className="flex-1 mx-8 hidden md:flex items-center bg-stone-800 rounded px-4 py-1.5 border border-stone-700/50">
           <span className="text-[10px] font-bold text-amber-500 mr-3 uppercase tracking-wider animate-pulse">Live Feed</span>
           <span className="text-xs text-stone-400 truncate font-mono">{envInfo.news}</span>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsPaused(!isPaused)} className="px-3 py-1 rounded border border-stone-600 bg-stone-700 text-stone-200 text-xs hover:bg-stone-600 transition-colors">
             {isPaused ? "▶ Resume" : "⏸ Pause"}
           </button>
           <button onClick={handleReset} className="px-3 py-1 rounded border border-red-900 bg-red-900/20 text-red-500 text-xs hover:bg-red-900/40 transition-colors font-bold">
             Reset
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* 左栏：环境数据 */}
        <aside className="w-64 bg-[#f4f4f5] border-r border-stone-300 hidden md:flex flex-col p-6 space-y-6">
           <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm">
             <div className="text-5xl mb-3 opacity-80">🌤</div>
             <div className="text-2xl font-bold text-stone-800">{envInfo.weather}</div>
             <div className="text-xs text-stone-500 font-mono mt-1 uppercase border-t border-stone-100 pt-2">
               Day {envInfo.day} <span className="mx-1">|</span> {envInfo.time}
             </div>
           </div>
           <div>
             <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Atmosphere</h3>
             <p className="text-sm text-stone-600 leading-6 italic font-serif border-l-4 border-amber-400 pl-4 bg-white/50 py-2 rounded-r">
               “{envInfo.desc}”
             </p>
           </div>
        </aside>

        {/* 中栏：日志流 (不会被遮挡) */}
        <main className="flex-1 bg-[#e5e5e5] flex flex-col min-w-0 relative z-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-3 scroll-smooth">
            {[...logs].reverse().map((log, index) => {
              const realIndex = logs.length - index;
              const isNewest = index === 0;
              return (
                <div key={realIndex} className={`flex gap-3 ${isNewest ? 'opacity-100' : 'opacity-70 hover:opacity-100 transition-opacity'}`}>
                   <div className="text-[10px] font-mono text-stone-400 pt-3 w-8 text-right">#{String(realIndex).padStart(2,'0')}</div>
                   <div className={`flex-1 p-4 rounded border ${
                     isNewest 
                     ? 'bg-white border-stone-300 shadow-lg translate-x-1' 
                     : 'bg-[#ececec] border-stone-200'
                   } transition-all duration-500`}>
                     <p className="text-[15px] leading-7 text-stone-800 font-serif text-justify">{log}</p>
                   </div>
                </div>
              );
            })}
            <div className="h-12"></div>
          </div>
        </main>

        {/* 右栏：侧边栏手风琴 (Avatar + Info) */}
        <aside className="w-84 bg-[#fcfcfc] border-l border-stone-300 flex flex-col z-10 shadow-xl">
          <div className="p-3 border-b border-stone-200 bg-white text-[10px] font-bold text-stone-400 uppercase text-center tracking-widest sticky top-0">
            Survivors Roster ({agents.length})
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#f4f4f5]">
            {agents.map(agent => {
              const isExpanded = expandedId === agent.id;
              
              return (
                <div 
                  key={agent.id} 
                  onClick={() => toggleExpand(agent.id)}
                  className={`
                    border rounded-lg transition-all cursor-pointer overflow-hidden
                    ${isExpanded ? 'bg-white border-stone-400 shadow-md ring-1 ring-stone-200' : 'bg-white border-stone-200 hover:border-stone-300 shadow-sm'}
                  `}
                >
                  {/* --- 头部：始终可见 (头像 + 名字 + 血条) --- */}
                  <div className="p-3 flex items-center gap-3">
                    {/* 本地渲染头像：无图床，无 VPN 问题 */}
                    <TacticalAvatar name={agent.name} job={agent.job} />

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-sm text-stone-800">{agent.name}</span>
                        <span className="text-[9px] text-stone-400 uppercase font-bold tracking-wider">{agent.job}</span>
                      </div>
                      
                      {/* 血条 */}
                      <div className="flex items-center gap-1.5 h-3">
                         <span className="text-[8px] font-bold text-stone-400 w-3">HP</span>
                         <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden border border-stone-100">
                            <div className={`h-full ${agent.hp > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                         </div>
                      </div>
                    </div>
                    
                    {/* 展开指示箭头 */}
                    <div className={`text-stone-300 transform transition-transform duration-200 ${isExpanded ? 'rotate-90 text-stone-500' : ''}`}>›</div>
                  </div>

                  {/* --- 展开区域：详情 (背包 + 对话) --- */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-stone-100 bg-stone-50/50 animate-in slide-in-from-top-2 duration-200">
                      
                      {/* 1. 状态数值 */}
                      <div className="flex gap-4 my-2 text-[10px] text-stone-500 font-mono">
                        <div>LOC: <span className="text-stone-800 font-bold">{agent.locationName}</span></div>
                        <div>HUNGER: <span className={`font-bold ${agent.hunger > 50 ? 'text-red-500' : 'text-stone-800'}`}>{agent.hunger}%</span></div>
                      </div>

                      {/* 2. 刚才说的话 (Action Log) */}
                      <div className="relative bg-white p-2 rounded border border-stone-200 text-xs text-stone-600 italic mb-3">
                        <span className="absolute -top-1.5 left-4 w-2 h-2 bg-white border-t border-l border-stone-200 transform rotate-45"></span>
                        “{agent.actionLog}”
                      </div>

                      {/* 3. 背包 */}
                      <div>
                        <div className="text-[9px] font-bold text-stone-400 uppercase mb-1">Inventory</div>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.inventory.length > 0 ? (
                            agent.inventory.map((item, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-[10px] text-stone-600 shadow-sm">
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-stone-400 italic">空空如也</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}