'use client';
import { useState, useEffect, useRef } from 'react';
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

// 头像 Fallback
const getFallbackAvatar = (seed: string) => {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "--", time: "--", desc: "读取中...", news: "...", day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // 新增：当前选中的角色（用于显示详情弹窗）
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

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
         
         // 如果当前打开了详情页，实时更新详情页的数据
         if (selectedAgent) {
            const updatedAgent = data.world.agents.find((a: Agent) => a.id === selectedAgent.id);
            if (updatedAgent) setSelectedAgent(updatedAgent);
         }
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
  }, [isPaused, selectedAgent]); // 依赖项加入 selectedAgent 以便实时刷新

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#e5e5e5] text-stone-800 font-sans overflow-hidden">
      
      {/* Top Bar */}
      <header className="shrink-0 h-14 bg-white border-b border-stone-300 px-6 flex justify-between items-center z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-stone-800 text-white w-8 h-8 flex items-center justify-center font-bold rounded">AI</div>
          <h1 className="font-bold tracking-widest text-sm uppercase text-stone-700">Survival Protocol</h1>
        </div>
        <div className="flex-1 mx-8 hidden md:flex items-center bg-stone-100 rounded px-4 py-1.5 border border-stone-200">
           <span className="text-[10px] font-bold text-red-600 mr-3 uppercase tracking-wider">Alert</span>
           <span className="text-xs text-stone-600 truncate font-mono">{envInfo.news}</span>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsPaused(!isPaused)} className="px-3 py-1 rounded border border-stone-300 bg-white text-xs hover:bg-stone-50 transition-colors">
             {isPaused ? "▶ Resume" : "⏸ Pause"}
           </button>
           <button onClick={handleReset} className="px-3 py-1 rounded border border-red-300 bg-red-50 text-red-600 text-xs hover:bg-red-100 transition-colors font-bold">
             Reset
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Environment */}
        <aside className="w-72 bg-[#f0f0f0] border-r border-stone-300 hidden md:flex flex-col p-6 space-y-6">
           <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm">
             <div className="text-5xl mb-3 opacity-80">🌤</div>
             <div className="text-2xl font-bold text-stone-800">{envInfo.weather}</div>
             <div className="text-xs text-stone-500 font-mono mt-1 uppercase">Day {envInfo.day} · {envInfo.time}</div>
           </div>
           <div>
             <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Atmosphere Scan</h3>
             <p className="text-sm text-stone-600 leading-6 italic font-serif border-l-2 border-stone-300 pl-4">“{envInfo.desc}”</p>
           </div>
        </aside>

        {/* Middle: Logs */}
        <main className="flex-1 bg-[#e5e5e5] flex flex-col min-w-0 relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-3 scroll-smooth">
            {[...logs].reverse().map((log, index) => {
              const realIndex = logs.length - index;
              const isNewest = index === 0;
              return (
                <div key={realIndex} className={`flex gap-3 ${isNewest ? 'opacity-100' : 'opacity-60 hover:opacity-100 transition-opacity'}`}>
                   <div className="text-[10px] font-mono text-stone-400 pt-3 w-8 text-right">#{String(realIndex).padStart(2,'0')}</div>
                   <div className={`flex-1 p-4 rounded-lg border ${isNewest ? 'bg-white border-stone-300 shadow-md' : 'bg-[#ececec] border-stone-200'}`}>
                     <p className="text-[15px] leading-7 text-stone-800 font-serif text-justify">{log}</p>
                   </div>
                </div>
              );
            })}
            <div className="h-12"></div>
          </div>
        </main>

        {/* Right: Survivors List (Compact View) */}
        <aside className="w-80 bg-[#f5f5f5] border-l border-stone-300 flex flex-col z-20">
          <div className="p-3 border-b border-stone-200 bg-[#f5f5f5] text-[10px] font-bold text-stone-400 uppercase text-center tracking-widest">
            Personnel ({agents.length})
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {agents.map(agent => (
              <div 
                key={agent.id} 
                onClick={() => setSelectedAgent(agent)}
                className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-stone-400 cursor-pointer transition-all group active:scale-95"
              >
                <div className="flex items-center gap-3">
                  {/* 小头像 */}
                  <div className="relative w-10 h-10 rounded bg-stone-100 overflow-hidden border border-stone-200 shrink-0">
                    <Image 
                      src={agent.avatarUrl || getFallbackAvatar(agent.name)} 
                      alt={agent.name} fill className="object-cover" unoptimized={true}
                    />
                  </div>

                  {/* 简要信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-stone-800">{agent.name}</span>
                      <span className="text-[10px] text-stone-400 uppercase">{agent.job}</span>
                    </div>
                    {/* 迷你血条 */}
                    <div className="h-1 bg-stone-100 rounded-full overflow-hidden w-full">
                       <div className={`h-full ${agent.hp > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                    </div>
                  </div>
                </div>
                
                {/* 简短气泡 (最新动作) */}
                <div className="mt-2 text-[10px] text-stone-500 truncate italic pl-1 border-l-2 border-stone-100 group-hover:border-stone-300">
                  {agent.actionLog}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* --- 详情弹窗 (Modal) --- */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedAgent(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" 
            onClick={e => e.stopPropagation()} // 防止点击内容关闭弹窗
          >
            {/* Modal Header */}
            <div className="bg-stone-50 p-6 border-b border-stone-100 flex gap-5 items-center relative">
               <div className="relative w-20 h-20 rounded-lg bg-white border-2 border-white shadow-lg overflow-hidden shrink-0 transform -rotate-2">
                 <Image 
                    src={selectedAgent.avatarUrl || getFallbackAvatar(selectedAgent.name)} 
                    alt={selectedAgent.name} fill className="object-cover" unoptimized={true}
                 />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-stone-800">{selectedAgent.name}</h2>
                 <p className="text-sm text-stone-500 uppercase tracking-widest font-bold">{selectedAgent.job}</p>
                 <div className="flex items-center gap-1 mt-2 text-xs text-stone-400">
                   <span>📍</span>
                   <span>{selectedAgent.locationName}</span>
                 </div>
               </div>
               <button onClick={() => setSelectedAgent(null)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-800">
                 ✕
               </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              
              {/* 状态数值 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                   <span className="w-8 text-xs font-bold text-stone-400">HP</span>
                   <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className={`h-full ${selectedAgent.hp > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${selectedAgent.hp}%`}}></div>
                   </div>
                   <span className="text-xs font-mono text-stone-600 w-8 text-right">{selectedAgent.hp}</span>
                </div>
                <div className="flex items-center gap-3">
                   <span className="w-8 text-xs font-bold text-stone-400">SAT</span>
                   <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400" style={{width: `${Math.max(0, 100 - selectedAgent.hunger)}%`}}></div>
                   </div>
                   <span className="text-xs font-mono text-stone-600 w-8 text-right">{100 - selectedAgent.hunger}</span>
                </div>
              </div>

              {/* 背包物品 */}
              <div>
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Inventory</h3>
                <div className="grid grid-cols-4 gap-2">
                   {selectedAgent.inventory.length > 0 ? (
                     selectedAgent.inventory.map((item, i) => (
                       <div key={i} className="aspect-square bg-stone-50 border border-stone-200 rounded flex flex-col items-center justify-center p-1 text-center hover:bg-stone-100 hover:border-stone-300 transition-colors">
                          <span className="text-lg">📦</span>
                          <span className="text-[9px] text-stone-600 truncate w-full">{item}</span>
                       </div>
                     ))
                   ) : (
                     <div className="col-span-4 text-center py-4 text-xs text-stone-300 italic bg-stone-50 rounded border border-dashed border-stone-200">
                       Empty Backpack
                     </div>
                   )}
                </div>
              </div>

              {/* 完整日志 */}
              <div>
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Latest Action</h3>
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-100 text-sm text-stone-700 italic">
                  “{selectedAgent.actionLog}”
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}