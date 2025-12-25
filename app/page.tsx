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

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "...",
    time: "...",
    desc: "正在建立卫星连接...",
    news: "暂无动态", 
    day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // 获取数据
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
           news: data.world.socialNews || "社会秩序平稳",
           day: Math.floor((data.world.turn - 1) / 6) + 1
         });
       }
     } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ 警告：确定要重置世界吗？进度将丢失。")) return;
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
    <div className="flex flex-col h-[100dvh] w-full bg-stone-200 text-stone-800 font-sans overflow-hidden">
      
      {/* --- 顶部导航栏 --- */}
      <header className="shrink-0 h-16 bg-stone-900 text-stone-200 shadow-md px-6 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center font-bold text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]">AI</div>
          <div>
            <h1 className="font-bold tracking-wider text-lg leading-none">ISLAND SIM</h1>
            <p className="text-[10px] text-stone-500 font-mono tracking-widest">SURVIVAL PROTOCOL</p>
          </div>
        </div>

        {/* 滚动新闻条 */}
        <div className="flex-1 mx-8 hidden md:flex items-center bg-stone-800/50 rounded-full px-4 py-1.5 border border-stone-700/50">
           <span className="text-[10px] font-bold text-amber-500 mr-3 shrink-0 tracking-widest">LATEST NEWS</span>
           <span className="text-xs text-stone-300 truncate animate-pulse font-mono">{envInfo.news}</span>
        </div>

        <div className="flex items-center gap-3">
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border ${loading ? 'bg-blue-900/30 border-blue-800 text-blue-400' : 'bg-stone-800 border-stone-700 text-stone-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-blue-400 animate-ping' : 'bg-emerald-500'}`}></div>
              {loading ? "COMPUTING" : "LIVE"}
           </div>
           
           <button onClick={() => setIsPaused(!isPaused)} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-800 hover:bg-stone-700 transition-colors border border-stone-700 text-stone-300">
             {isPaused ? "▶" : "⏸"}
           </button>
           <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-900/20 hover:bg-red-900/40 transition-colors border border-red-900/50 text-red-500" title="Reset World">
             ↺
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* --- 左栏：环境仪表盘 --- */}
        <aside className="w-72 bg-stone-100 border-r border-stone-300 hidden md:flex flex-col z-10 shadow-lg">
           <div className="p-6 space-y-6">
             {/* 天气卡片 */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
               <div className="flex justify-between items-start mb-2">
                 <span className="text-4xl filter drop-shadow-sm">🌤</span>
                 <div className="text-right">
                   <div className="text-2xl font-bold text-stone-800">{envInfo.weather}</div>
                   <div className="text-xs font-mono text-stone-400 uppercase tracking-widest">Day {envInfo.day} · {envInfo.time}</div>
                 </div>
               </div>
             </div>
             
             {/* 环境描写 */}
             <div className="relative">
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-full"></div>
               <div className="pl-4 py-1">
                 <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Atmosphere</h3>
                 <p className="text-sm text-stone-600 leading-relaxed font-serif italic">
                   “{envInfo.desc}”
                 </p>
               </div>
             </div>

             {/* 装饰性数据块 */}
             <div className="grid grid-cols-2 gap-2 mt-4 opacity-60">
                <div className="bg-stone-200 h-16 rounded-lg animate-pulse"></div>
                <div className="bg-stone-200 h-16 rounded-lg animate-pulse delay-75"></div>
             </div>
           </div>
        </aside>

        {/* --- 中栏：故事流 (倒序显示) --- */}
        <main className="flex-1 bg-stone-200 relative flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
            {logs.length === 0 && (
              <div className="text-center mt-20 text-stone-400 animate-pulse font-mono">
                INITIALIZING WORLD SIMULATION...
              </div>
            )}

            {/* 这里使用了 [...logs].reverse() 来实现最新的在最上面 */}
            {[...logs].reverse().map((log, index) => {
              // 计算原始的序号：总长度 - 当前索引
              const realIndex = logs.length - index;
              return (
                <article key={realIndex} className="max-w-3xl mx-auto group">
                   <div className="flex gap-4">
                     {/* 序号列 */}
                     <div className="flex flex-col items-center pt-2">
                        <span className="text-[10px] font-mono font-bold text-stone-400 bg-stone-200 px-1">
                          #{String(realIndex).padStart(3, '0')}
                        </span>
                        <div className="w-px h-full bg-stone-300 my-2 group-last:hidden"></div>
                     </div>
                     
                     {/* 内容卡片 */}
                     <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-stone-200/60 hover:shadow-md transition-shadow duration-300">
                       <p className="text-lg leading-loose text-stone-800 font-serif text-justify">
                         {log}
                       </p>
                     </div>
                   </div>
                </article>
              );
            })}
            
            {/* 底部垫高 */}
            <div className="h-12"></div>
          </div>
          
          {/* 顶部阴影遮罩，增加纵深感 */}
          <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-stone-200/50 to-transparent pointer-events-none"></div>
        </main>

        {/* --- 右栏：幸存者名单 --- */}
        <aside className="w-80 bg-white border-l border-stone-300 flex flex-col z-20 shadow-xl">
          <div className="p-4 border-b border-stone-200 bg-stone-50/80 backdrop-blur sticky top-0 z-10 flex justify-between items-center">
            <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Survivors</h2>
            <span className="text-[10px] bg-stone-200 px-2 py-0.5 rounded-full text-stone-500 font-mono">
              ONLINE: {agents.length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm hover:border-amber-300 transition-colors group">
                
                {/* 头部：头像与基础信息 */}
                <div className="flex items-start gap-3 mb-3">
                  {/* 头像圈 */}
                  <div className="relative w-12 h-12 rounded-full border-2 border-white shadow-md shrink-0 bg-stone-100 overflow-hidden ring-2 ring-stone-100 group-hover:ring-amber-200 transition-all">
                    {agent.avatarUrl ? (
                      <Image 
                        src={agent.avatarUrl} 
                        alt={agent.name}
                        fill
                        className="object-cover"
                        unoptimized // 必须加这个
                        onError={(e) => {
                           (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300 font-bold text-xl">
                        {agent.name[0]}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-stone-800 truncate">{agent.name}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${agent.hp > 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        HP {agent.hp}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 truncate">{agent.job}</p>
                    
                    {/* 饥饿度条 */}
                    <div className="w-full h-1 bg-stone-100 rounded-full mt-2 overflow-hidden">
                       <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.max(0, 100 - agent.hunger)}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* 底部：位置与动作 */}
                <div className="bg-stone-50 rounded-lg p-2 space-y-1.5">
                   <div className="flex items-center gap-1.5 text-[10px] text-stone-400 uppercase font-bold tracking-wider">
                     <span>📍 {agent.locationName}</span>
                   </div>
                   <div className="text-xs text-stone-600 italic leading-tight">
                     “{agent.actionLog}”
                   </div>
                   
                   {/* 简单的背包展示 */}
                   {agent.inventory.length > 0 && (
                     <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-stone-200/50">
                       {agent.inventory.map((item, idx) => (
                         <span key={idx} className="text-[9px] px-1 py-0.5 bg-white border border-stone-200 rounded text-stone-500">
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