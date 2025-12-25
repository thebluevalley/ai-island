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

// 备用头像生成
const getFallbackAvatar = (seed: string) => {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "--", time: "--", desc: "连接中...", news: "...", day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // 选中的角色
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
         
         // 实时更新弹窗数据
         if (selectedAgent) {
            const updated = data.world.agents.find((a: Agent) => a.id === selectedAgent.id);
            if (updated) setSelectedAgent(updated);
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
  }, [isPaused, selectedAgent]);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#f0f0f0] text-stone-800 font-sans overflow-hidden">
      
      {/* 顶部栏 */}
      <header className="shrink-0 h-14 bg-white border-b border-stone-300 px-6 flex justify-between items-center z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-stone-900 text-white px-3 py-1 rounded font-bold tracking-wider">LOG</div>
          <div>
            <h1 className="font-bold text-stone-800 text-sm uppercase tracking-widest">Survival Protocol</h1>
            <p className="text-[10px] text-stone-400">STATUS: {loading ? 'SYNCING...' : 'ONLINE'}</p>
          </div>
        </div>
        <div className="flex-1 mx-8 hidden md:flex items-center bg-stone-50 rounded-full px-4 py-1.5 border border-stone-200">
           <span className="text-[10px] font-bold text-red-500 mr-3 uppercase tracking-wider">News</span>
           <span className="text-xs text-stone-600 truncate">{envInfo.news}</span>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsPaused(!isPaused)} className="px-3 py-1 rounded border border-stone-300 bg-white text-xs hover:bg-stone-50">
             {isPaused ? "▶ Resume" : "⏸ Pause"}
           </button>
           <button onClick={handleReset} className="px-3 py-1 rounded border border-red-200 bg-red-50 text-red-500 text-xs hover:bg-red-100">
             Reset
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* 左栏：环境 */}
        <aside className="w-64 bg-[#fcfcfc] border-r border-stone-200 hidden md:flex flex-col p-6 space-y-6">
           <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm text-center">
             <div className="text-5xl mb-2">🌤</div>
             <div className="text-xl font-bold text-stone-700">{envInfo.weather}</div>
             <div className="text-xs text-stone-400 font-mono mt-1 uppercase">Day {envInfo.day} · {envInfo.time}</div>
           </div>
           <div>
             <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Report</h3>
             <p className="text-sm text-stone-600 leading-6 italic font-serif border-l-2 border-stone-200 pl-4">“{envInfo.desc}”</p>
           </div>
        </aside>

        {/* 中栏：日志 */}
        <main className="flex-1 bg-[#f0f0f0] flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
            {[...logs].reverse().map((log, index) => {
              const realIndex = logs.length - index;
              const isNewest = index === 0;
              return (
                <div key={realIndex} className={`flex gap-4 ${isNewest ? 'opacity-100' : 'opacity-70 hover:opacity-100 transition-opacity'}`}>
                   <div className="text-[10px] font-mono text-stone-400 pt-3 w-8 text-right">#{realIndex}</div>
                   <div className={`flex-1 p-5 rounded-xl border ${isNewest ? 'bg-white border-stone-300 shadow-md' : 'bg-[#e5e5e5] border-stone-200'}`}>
                     <p className="text-[15px] leading-7 text-stone-700 font-serif text-justify">{log}</p>
                   </div>
                </div>
              );
            })}
            <div className="h-12"></div>
          </div>
        </main>

        {/* 右栏：人物列表 (紧凑版) */}
        <aside className="w-80 bg-white border-l border-stone-200 flex flex-col z-20 shadow-lg">
          <div className="p-4 border-b border-stone-100 bg-white sticky top-0 z-10 flex justify-between items-center">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Survivors</h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 font-bold">{agents.length} Online</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#fafaf9]">
            {agents.map(agent => (
              <div 
                key={agent.id} 
                onClick={() => setSelectedAgent(agent)}
                className="bg-white border border-stone-200 rounded-xl p-3 shadow-[0_2px_5px_rgba(0,0,0,0.02)] hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex items-center gap-3 group"
              >
                {/* 1. 头像 (常驻) */}
                <div className="relative w-12 h-12 rounded-lg bg-stone-100 overflow-hidden border border-stone-100 shrink-0">
                  <Image 
                    src={agent.avatarUrl || getFallbackAvatar(agent.name)} 
                    alt={agent.name} fill className="object-cover" unoptimized={true}
                  />
                </div>

                {/* 2. 核心信息 (名字+状态条) */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-sm text-stone-800 group-hover:text-blue-600 transition-colors">{agent.name}</span>
                    <span className="text-[10px] text-stone-400 uppercase">{agent.job}</span>
                  </div>
                  
                  {/* 双条显示 */}
                  <div className="flex gap-1">
                    <div className="h-1.5 flex-1 bg-stone-100 rounded-full overflow-hidden" title="Health">
                       <div className={`h-full ${agent.hp > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                    </div>
                    <div className="h-1.5 flex-1 bg-stone-100 rounded-full overflow-hidden" title="Hunger">
                       <div className="h-full bg-amber-400" style={{width: `${Math.max(0, 100 - agent.hunger)}%`}}></div>
                    </div>
                  </div>
                </div>

                {/* 箭头提示 */}
                <div className="text-stone-300 group-hover:text-blue-400">›</div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* --- 详情弹窗 (修复重叠问题) --- */}
      {selectedAgent && (
        // 外层：全屏遮罩，黑色半透明 (bg-black/50)，z-index 设为 50 保证在最上层
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedAgent(null)}>
          
          {/* 弹窗主体：纯白背景 (bg-white)，阻挡底部文字 */}
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()} 
          >
            {/* 弹窗头部 */}
            <div className="bg-stone-50 p-6 border-b border-stone-100 flex gap-5 items-center">
               <div className="relative w-20 h-20 rounded-xl bg-white border-2 border-white shadow-lg overflow-hidden shrink-0 rotate-1">
                 <Image 
                    src={selectedAgent.avatarUrl || getFallbackAvatar(selectedAgent.name)} 
                    alt={selectedAgent.name} fill className="object-cover" unoptimized={true}
                 />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-stone-800">{selectedAgent.name}</h2>
                 <p className="text-sm text-stone-500 uppercase tracking-widest font-bold">{selectedAgent.job}</p>
                 <div className="flex items-center gap-1 mt-2 text-xs text-stone-400 font-mono">
                   <span>LOC:</span>
                   <span className="text-stone-600 font-bold">{selectedAgent.locationName}</span>
                 </div>
               </div>
               <button onClick={() => setSelectedAgent(null)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 p-2">
                 ✕
               </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 space-y-6">
              
              {/* 核心：把原本显示在侧边栏的“动作日志”移到这里，作为重点展示 */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Latest Activity</h3>
                <div className="bg-[#fcfcfc] p-4 rounded-xl border border-stone-200 text-stone-700 italic relative">
                  <span className="absolute -left-2 top-4 w-4 h-4 bg-[#fcfcfc] border-t border-l border-stone-200 transform -rotate-45"></span>
                  “{selectedAgent.actionLog}”
                </div>
              </div>

              {/* 状态数值 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-stone-500">
                    <span>Health</span>
                    <span>{selectedAgent.hp}%</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full ${selectedAgent.hp > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${selectedAgent.hp}%`}}></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-stone-500">
                    <span>Satiety</span>
                    <span>{100 - selectedAgent.hunger}%</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{width: `${Math.max(0, 100 - selectedAgent.hunger)}%`}}></div>
                  </div>
                </div>
              </div>

              {/* 背包 */}
              <div>
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Inventory</h3>
                <div className="grid grid-cols-4 gap-2">
                   {selectedAgent.inventory.length > 0 ? (
                     selectedAgent.inventory.map((item, i) => (
                       <div key={i} className="aspect-square bg-stone-50 border border-stone-100 rounded-lg flex flex-col items-center justify-center p-1 text-center hover:bg-white hover:shadow-md transition-all">
                          <span className="text-xl">📦</span>
                          <span className="text-[9px] text-stone-600 truncate w-full mt-1">{item}</span>
                       </div>
                     ))
                   ) : (
                     <div className="col-span-4 text-center py-4 text-xs text-stone-300 italic bg-stone-50 rounded-lg border border-dashed border-stone-200">
                       Empty
                     </div>
                   )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}