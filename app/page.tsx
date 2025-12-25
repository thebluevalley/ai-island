'use client';
import { useState, useEffect } from 'react';

// --- 类型定义 ---
type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Building = { type: string; name: string; status: string; progress: number; maxProgress: number; x: number; y: number; };
type Resources = { wood: number; stone: number; food: number; medicine: number; };

// --- 静态配置 ---
const BUILD_OPTIONS = [
  { type: "House", name: "居住屋", cost: "木50" },
  { type: "Warehouse", name: "大仓库", cost: "木80 石20" },
  { type: "Clinic", name: "诊所", cost: "木100 石50" },
  { type: "Kitchen", name: "厨房", cost: "木60 石30" },
  { type: "Tower", name: "瞭望塔", cost: "木120 石80" }
];

// 战术头像
const TacticalAvatar = ({ name, job }: { name: string, job: string }) => {
  const colors = ['bg-blue-600','bg-emerald-600','bg-amber-600','bg-rose-600','bg-violet-600'];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`w-10 h-10 ${colors[index]} rounded flex flex-col items-center justify-center text-white shadow-sm shrink-0`}>
      <span className="font-bold text-sm leading-none mt-0.5">{name ? name[0] : "?"}</span>
      <span className="text-[8px] uppercase opacity-80 scale-75">{job ? job.slice(0,2) : "UN"}</span>
    </div>
  );
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  
  // 视图控制
  const [rightTab, setRightTab] = useState<'ai' | 'npc'>('ai'); // 右侧栏内部切换
  const [mobileView, setMobileView] = useState<'map' | 'control' | 'roster'>('map'); // 手机端主视图切换

  const fetchData = async () => {
    if (loading || paused) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tick', { method: 'POST' });
      const data = await res.json();
      if (data.success) setWorldData(data.world);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ 警告：这将清除所有进度并生成10名新角色。确认重置？")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => {
    alert(`指令已下达：建造【${type}】\n资源充足时，议会或NPC将自动响应。`);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { const t = setInterval(() => { if(!paused) fetchData(); }, 12000); return () => clearInterval(t); }, [paused]);

  if (!worldData) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#e5e5e5] text-stone-500 gap-4">
      <div className="w-8 h-8 border-4 border-stone-300 border-t-stone-600 rounded-full animate-spin"></div>
      <div className="font-mono text-xs tracking-widest">CONNECTING TO SATELLITE...</div>
    </div>
  );

  const { agents, npcs, buildings, globalResources, logs, weather } = worldData;

  // --- 组件化：左侧栏 (控制 & 资源) ---
  const ControlPanel = () => (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* 资源列表 (紧凑版) */}
      <div className="p-4 bg-white border-b border-stone-200">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Resources</h2>
        <div className="space-y-2">
           <div className="flex justify-between items-center text-sm border-b border-stone-100 pb-1">
             <span className="text-stone-600">🪵 木材</span> <span className="font-mono font-bold text-blue-600">{globalResources.wood}</span>
           </div>
           <div className="flex justify-between items-center text-sm border-b border-stone-100 pb-1">
             <span className="text-stone-600">🪨 石料</span> <span className="font-mono font-bold text-stone-600">{globalResources.stone}</span>
           </div>
           <div className="flex justify-between items-center text-sm border-b border-stone-100 pb-1">
             <span className="text-stone-600">🍞 食物</span> <span className="font-mono font-bold text-emerald-600">{globalResources.food}</span>
           </div>
           <div className="flex justify-between items-center text-sm">
             <span className="text-stone-600">💊 药品</span> <span className="font-mono font-bold text-red-500">{globalResources.medicine}</span>
           </div>
        </div>
      </div>

      {/* 建设菜单 */}
      <div className="flex-1 p-4 overflow-y-auto bg-[#fafaf9]">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Construction</h2>
        <div className="space-y-2">
          {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-full bg-white p-2.5 rounded border border-stone-300 shadow-sm active:scale-95 transition-all text-left group">
              <div className="flex justify-between items-center mb-0.5">
                <span className="font-bold text-stone-700 text-sm">{opt.name}</span>
                <span className="text-[9px] bg-stone-100 px-1 rounded text-stone-400">T1</span>
              </div>
              <div className="text-[10px] text-stone-400 font-mono">{opt.cost}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* 重置按钮 */}
      <div className="p-4 border-t border-stone-200 bg-stone-100 mt-auto">
        <button onClick={handleReset} className="w-full py-3 bg-red-50 text-red-600 rounded border border-red-200 font-bold active:bg-red-100 text-xs tracking-wider">
          ☢ REBOOT SYSTEM
        </button>
      </div>
    </div>
  );

  // --- 组件化：右侧栏 (人员名单) ---
  const RosterPanel = () => (
    <div className="flex flex-col h-full bg-white shadow-xl">
      <div className="flex border-b border-stone-200 shrink-0">
         <button onClick={()=>setRightTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='ai'?'bg-white text-blue-600 border-b-2 border-blue-600':'bg-stone-50 text-stone-400'}`}>
           Elites ({agents.length})
         </button>
         <button onClick={()=>setRightTab('npc')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='npc'?'bg-white text-emerald-600 border-b-2 border-emerald-600':'bg-stone-50 text-stone-400'}`}>
           Drones ({npcs.length})
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 bg-stone-50 space-y-2">
         {rightTab === 'ai' ? agents.map((agent: Agent) => (
           <div key={agent.id} className="bg-white p-2.5 rounded border border-stone-200 shadow-sm flex gap-3">
              <TacticalAvatar name={agent.name} job={agent.job} />
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-sm text-stone-800">{agent.name}</span>
                    <span className="text-[9px] bg-stone-100 px-1 rounded text-stone-500 font-bold">{agent.job}</span>
                 </div>
                 <div className="h-1 bg-stone-100 rounded-full overflow-hidden w-full mb-1">
                    <div className={`h-full ${agent.hp>50?'bg-emerald-500':'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                 </div>
                 <div className="text-[10px] text-stone-500 truncate italic">“{agent.actionLog}”</div>
              </div>
           </div>
         )) : npcs.map((npc: NPC) => (
           <div key={npc.id} className="bg-white p-3 rounded border border-stone-200 flex justify-between items-center">
              <div>
                 <div className="font-bold text-xs text-stone-700">{npc.name}</div>
                 <div className="text-[10px] text-stone-400 uppercase font-bold">{npc.role}</div>
              </div>
              <div className="text-[10px] font-mono bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-emerald-700">
                 {npc.currentTask}
              </div>
           </div>
         ))}
         {/* 底部留白防止手机端被导航栏遮挡 */}
         <div className="h-16 md:hidden"></div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-[#e5e5e5] text-stone-800 font-sans overflow-hidden">
      
      {/* 1. 顶部状态栏 (通用) */}
      <header className="shrink-0 h-12 bg-stone-800 text-stone-200 flex items-center px-4 justify-between shadow-md z-20">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
           <span className="font-bold tracking-widest uppercase text-xs md:text-sm">Island Sim v3.5</span>
        </div>
        <div className="flex gap-4 text-[10px] md:text-xs font-mono opacity-80">
          <span>DAY {String(worldData.turn).padStart(3,'0')}</span>
          <span className="text-amber-400 hidden md:inline">{weather}</span>
          <span>{agents.length} AGENTS</span>
        </div>
      </header>

      {/* 2. 桌面端三栏布局 / 移动端单视图 */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* 左栏：桌面端常驻 / 移动端 Tab 1 */}
        <aside className={`
          ${mobileView === 'control' ? 'flex' : 'hidden'} 
          md:flex md:w-64 border-r border-stone-300 w-full z-10
        `}>
          <ControlPanel />
        </aside>

        {/* 中栏：桌面端常驻 / 移动端 Tab 2 */}
        <main className={`
          ${mobileView === 'map' ? 'flex' : 'hidden'} 
          md:flex flex-1 flex-col min-w-0 bg-[#e5e5e5] relative z-0
        `}>
          {/* 九宫格地图 */}
          <div className="p-4 bg-stone-200 border-b border-stone-300 shadow-inner">
             <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto aspect-[3/1.2]">
                {['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'].map((loc, i) => {
                   const x = Math.floor(i / 3);
                   const y = i % 3;
                   const b = buildings.find((b: Building) => b.x === x && b.y === y);
                   const count = agents.filter((a: Agent) => a.locationName?.includes(loc)).length;
                   
                   return (
                     <div key={i} className="bg-stone-300 rounded border border-stone-400/30 flex flex-col items-center justify-center relative active:bg-white transition-colors">
                        <span className="text-[10px] font-bold text-stone-500 z-10">{loc}</span>
                        {b && (
                          <div className="absolute bottom-1 w-3/4 h-1 bg-stone-400/50 rounded-full overflow-hidden">
                             <div className={`h-full ${b.status==='active'?'bg-emerald-500':'bg-amber-400'}`} style={{width: `${(b.progress/b.maxProgress)*100}%`}}></div>
                          </div>
                        )}
                        {count > 0 && <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-[9px] rounded-full flex items-center justify-center shadow-sm border border-[#e5e5e5]">{count}</div>}
                     </div>
                   )
                })}
             </div>
          </div>

          {/* 日志 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20 md:pb-4">
             {logs.slice().reverse().map((log: string, i: number) => (
               <div key={i} className={`p-3.5 rounded border ${i===0 ? 'bg-white shadow-sm border-stone-300' : 'bg-[#efefef] border-stone-200 opacity-80'}`}>
                  <p className="text-sm leading-6 text-stone-800 font-serif text-justify">{log}</p>
               </div>
             ))}
          </div>
        </main>

        {/* 右栏：桌面端常驻 / 移动端 Tab 3 */}
        <aside className={`
          ${mobileView === 'roster' ? 'flex' : 'hidden'} 
          md:flex md:w-72 border-l border-stone-300 w-full z-10
        `}>
          <div className="flex-1 w-full">
            <RosterPanel />
          </div>
        </aside>

      </div>

      {/* 3. 移动端底部导航栏 (仅手机显示) */}
      <nav className="md:hidden h-14 bg-white border-t border-stone-200 flex justify-around items-center shrink-0 z-50 pb-safe">
        <button onClick={() => setMobileView('control')} className={`flex flex-col items-center gap-1 p-2 ${mobileView==='control'?'text-blue-600':'text-stone-400'}`}>
          <span className="text-lg">🛠</span>
          <span className="text-[10px] font-bold">建设</span>
        </button>
        <button onClick={() => setMobileView('map')} className={`flex flex-col items-center gap-1 p-2 ${mobileView==='map'?'text-blue-600':'text-stone-400'}`}>
          <span className="text-lg">🗺</span>
          <span className="text-[10px] font-bold">概览</span>
        </button>
        <button onClick={() => setMobileView('roster')} className={`flex flex-col items-center gap-1 p-2 ${mobileView==='roster'?'text-blue-600':'text-stone-400'}`}>
          <span className="text-lg">👥</span>
          <span className="text-[10px] font-bold">人员</span>
        </button>
      </nav>

    </div>
  );
}
