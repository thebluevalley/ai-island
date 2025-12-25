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
  avatarUrl?: string; // 可能是空的
};

// 备用头像生成器 (如果数据库里没有URL，就用这个临时生成)
const getFallbackAvatar = (name: string, seed: string) => {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=e5e7eb`;
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "--",
    time: "--",
    desc: "正在读取生存记录...",
    news: "...", 
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
           news: data.world.socialNews || "无特别新闻",
           day: Math.floor((data.world.turn - 1) / 6) + 1
         });
       }
     } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ 确定要重置世界吗？进度将丢失。")) return;
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
    // 全局：浅色背景 (Stone-100)，文字深灰 (Stone-800)
    <div className="flex flex-col h-[100dvh] w-full bg-[#f5f5f4] text-stone-800 font-sans overflow-hidden">
      
      {/* --- 顶部导航栏 (干净的白色) --- */}
      <header className="shrink-0 h-16 bg-white border-b border-stone-200 px-6 flex justify-between items-center z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-stone-800 text-white rounded-lg flex items-center justify-center font-bold font-serif text-lg">AI</div>
          <div>
            <h1 className="font-bold tracking-wider text-stone-800 text-lg leading-none uppercase">Island Log</h1>
            <p className="text-[10px] text-stone-400 font-mono tracking-widest mt-0.5">SURVIVAL SIMULATOR</p>
          </div>
        </div>

        {/* 顶部新闻条 */}
        <div className="flex-1 mx-8 hidden md:flex items-center bg-stone-50 rounded-full px-5 py-2 border border-stone-100 shadow-inner">
           <span className="text-[10px] font-bold text-amber-600 mr-3 shrink-0 tracking-widest uppercase">Latest News</span>
           <span className="text-xs text-stone-600 truncate font-medium">{envInfo.news}</span>
        </div>

        <div className="flex items-center gap-3">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors ${loading ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-stone-200 text-stone-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-ping' : 'bg-emerald-400'}`}></div>
              {loading ? "SYNCING..." : "ONLINE"}
           </div>
           
           <button onClick={() => setIsPaused(!isPaused)} className="h-9 px-4 rounded-lg bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 text-xs font-bold transition-all shadow-sm">
             {isPaused ? "▶ 继续" : "⏸ 暂停"}
           </button>
           <button onClick={handleReset} className="h-9 w-9 flex items-center justify-center rounded-lg bg-white hover:bg-red-50 border border-stone-200 hover:border-red-200 text-red-500 transition-all shadow-sm" title="重置世界">
             ↺
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* --- 左栏：环境信息 (HUD) --- */}
        <aside className="w-72 bg-[#fafaf9] border-r border-stone-200 hidden md:flex flex-col z-10">
           <div className="p-6 space-y-8">
             {/* 天气卡片 */}
             <div className="bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-stone-100">
               <div className="flex justify-between items-start mb-2">
                 <span className="text-4xl">🌤</span>
                 <div className="text-right">
                   <div className="text-2xl font-bold text-stone-800">{envInfo.weather}</div>
                   <div className="text-xs font-mono text-stone-400 uppercase tracking-widest">Day {envInfo.day} · {envInfo.time}</div>
                 </div>
               </div>
             </div>
             
             {/* 环境描写 - 引用风格 */}
             <div>
               <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                 <span className="w-1 h-3 bg-stone-300 block"></span>
                 Current Atmosphere
               </h3>
               <div className="relative pl-4 border-l-2 border-stone-200 py-1">
                 <p className="text-sm text-stone-600 leading-7 font-serif italic">
                   “{envInfo.desc}”
                 </p>
               </div>
             </div>

             {/* 装饰性信息 */}
             <div className="mt-auto pt-6 border-t border-stone-200">
                <div className="flex justify-between text-[10px] text-stone-400 font-mono mb-1">
                  <span>SIGNAL STRENGTH</span>
                  <span>100%</span>
                </div>
                <div className="w-full bg-stone-200 h-1 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full w-full"></div>
                </div>
             </div>
           </div>
        </aside>

        {/* --- 中栏：日志流 (倒序 + 浅色卡片) --- */}
        <main className="flex-1 bg-[#f5f5f4] relative flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
            {logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-2">
                <div className="animate-spin text-2xl">⏳</div>
                <div className="font-mono text-sm">LOADING HISTORY...</div>
              </div>
            )}

            {/* 倒序渲染：最新的在最上面 */}
            {[...logs].reverse().map((log, index) => {
              const realIndex = logs.length - index;
              const isNewest = index === 0;
              
              return (
                <article key={realIndex} className={`flex gap-4 group transition-all duration-500 ${isNewest ? 'translate-y-0 opacity-100' : 'opacity-80'}`}>
                   {/* 序号 */}
                   <div className="flex flex-col items-center pt-1 min-w-[3rem]">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isNewest ? 'text-amber-700 bg-amber-100' : 'text-stone-400 bg-stone-200'}`}>
                        #{String(realIndex).padStart(3, '0')}
                      </span>
                      <div className="w-px h-full bg-stone-300 my-2 group-last:hidden opacity-50"></div>
                   </div>
                   
                   {/* 内容卡片 */}
                   <div className={`flex-1 p-6 rounded-xl border ${
                     isNewest 
                       ? 'bg-white border-amber-200 shadow-[0_4px_20px_rgba(251,191,36,0.1)]' 
                       : 'bg-white border-stone-200 shadow-sm'
                   }`}>
                     <p className="text-[15px] leading-8 text-stone-700 font-serif text-justify">
                       {log}
                     </p>
                   </div>
                </article>
              );
            })}
            
            <div className="h-12"></div>
          </div>
        </main>

        {/* --- 右栏：幸存者 (带头像) --- */}
        <aside className="w-80 bg-white border-l border-stone-200 flex flex-col z-20 shadow-lg">
          <div className="p-4 border-b border-stone-100 bg-white/95 sticky top-0 z-10 flex justify-between items-center">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Survivors</h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold border border-emerald-100">
              {agents.length} ONLINE
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafaf9]">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white border border-stone-200 rounded-xl p-3 hover:shadow-md hover:border-amber-200 transition-all duration-300 group">
                
                <div className="flex items-start gap-3 mb-3">
                  {/* 头像容器：增加前端强制 fallback 逻辑 */}
                  <div className="relative w-12 h-12 rounded-lg bg-stone-100 overflow-hidden border border-stone-100 shadow-sm shrink-0">
                    <Image 
                      // 优先用数据库里的 URL，如果没有，就用前端临时生成的 URL
                      src={agent.avatarUrl || getFallbackAvatar(agent.name, `${agent.name}-${agent.job}`)} 
                      alt={agent.name}
                      fill
                      className="object-cover"
                      unoptimized={true} // 必须开启，允许外部链接
                      onError={(e) => {
                        // 如果 DiceBear 加载失败，回退到名字
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* 图片加载失败时的文字保底 */}
                    <div className="absolute inset-0 flex items-center justify-center text-stone-300 font-bold text-lg -z-10">
                      {agent.name[0]}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-stone-800 text-sm truncate">{agent.name}</h3>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${agent.hp > 50 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        HP {agent.hp}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-0.5 truncate">{agent.job}</p>
                    
                    {/* 饥饿度 */}
                    <div className="w-full h-1 bg-stone-100 rounded-full mt-2 overflow-hidden">
                       <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.max(0, 100 - agent.hunger)}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* 底部信息 */}
                <div className="bg-stone-50 rounded-lg p-2.5 space-y-1.5 border border-stone-100">
                   <div className="flex items-center gap-1.5 text-[9px] text-stone-400 uppercase font-bold tracking-wider">
                     <span>📍 {agent.locationName}</span>
                   </div>
                   <div className="text-[10px] text-stone-600 italic leading-tight">
                     “{agent.actionLog}”
                   </div>
                   
                   {agent.inventory.length > 0 && (
                     <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-stone-200/50">
                       {agent.inventory.map((item, idx) => (
                         <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-500 shadow-sm">
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