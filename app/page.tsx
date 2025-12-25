'use client';
import { useState, useEffect } from 'react';

// --- 类型定义 ---
type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Building = { type: string; name: string; status: string; progress: number; maxProgress: number; x: number; y: number; desc?: string; };
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
  
  // 倒计时状态
  const [nextRefresh, setNextRefresh] = useState(20); 
  
  // 视图控制
  const [rightTab, setRightTab] = useState<'ai' | 'npc'>('ai');
  const [mobileView, setMobileView] = useState<'logs' | 'map' | 'control' | 'roster'>('logs');

  const fetchData = async () => {
    if (loading || paused) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tick', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setWorldData(data.world);
        setNextRefresh(20); // 重置倒计时
      }
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

  // 定时器逻辑：改为每秒减少倒计时，归零时刷新
  useEffect(() => {
    const timer = setInterval(() => {
      if (!paused && !loading) {
        setNextRefresh(prev => {
          if (prev <= 1) {
            fetchData();
            return 20; // 重置为 20秒 (安全间隔)
          }
          return prev - 1;
        });
      }
    }, 1000); // 每秒执行一次
    return () => clearInterval(timer);
  }, [paused, loading]);

  if (!worldData) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#e5e5e5] text-stone-500 gap-4">
      <div className="w-8 h-8 border-4 border-stone-300 border-t-stone-600 rounded-full animate-spin"></div>
      <div className="font-mono text-xs tracking-widest">CONNECTING TO SATELLITE...</div>
    </div>
  );

  const { agents, npcs, buildings, globalResources, logs, weather } = worldData;

  // --- 数据计算 ---
  const pendingBuilds = buildings.filter((b: Building) => b.status === 'blueprint');
  const activeBuilds = buildings.filter((b: Building) => b.status === 'active');
  const busyNpcs = npcs.filter((n: NPC) => n.currentTask && n.currentTask !== '等待指令');

  // --- 组件：建设控制面板 ---
  const ControlPanel = () => (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="p-4 bg-white border-b border-stone-200">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Warehouse</h2>
        <div className="grid grid-cols-2 gap-3">
           <div className="flex justify-between text-sm border-b border-stone-100 pb-1"><span className="text-stone-600">🪵 木材</span> <span className="font-mono font-bold text-blue-600">{globalResources.wood}</span></div>
           <div className="flex justify-between text-sm border-b border-stone-100 pb-1"><span className="text-stone-600">🪨 石料</span> <span className="font-mono font-bold text-stone-600">{globalResources.stone}</span></div>
           <div className="flex justify-between text-sm border-b border-stone-100 pb-1"><span className="text-stone-600">🍞 食物</span> <span className="font-mono font-bold text-emerald-600">{globalResources.food}</span></div>
           <div className="flex justify-between text-sm"><span className="text-stone-600">💊 药品</span> <span className="font-mono font-bold text-red-500">{globalResources.medicine}</span></div>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto bg-[#fafaf9]">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Blueprint Menu</h2>
        <div className="space-y-2">
          {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-full bg-white p-3 rounded border border-stone-300 shadow-sm active:scale-95 transition-all text-left group">
              <div className="flex justify-between items-center mb-0.5">
                <span className="font-bold text-stone-700 text-sm group-hover:text-blue-600">{opt.name}</span>
                <span className="text-[9px] bg-stone-100 px-1 rounded text-stone-400">T1</span>
              </div>
              <div className="text-[10px] text-stone-400 font-mono">{opt.cost}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-stone-200 bg-stone-100 mt-auto">
        <button onClick={handleReset} className="w-full py-3 bg-red-50 text-red-600 rounded border border-red-200 font-bold active:bg-red-100 text-xs tracking-wider">☢ REBOOT SYSTEM</button>
      </div>
    </div>
  );

  // --- 组件：地图与指令面板 ---
  const MapDashboard = () => (
    <div className="flex flex-col h-full bg-[#e5e5e5]">
      <div className="bg-stone-800 text-stone-300 p-4 shadow-md shrink-0">
        <div className="flex justify-between items-center mb-3">
           <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest animate-pulse">System Command</h2>
           <span className="text-[10px] font-mono bg-stone-700 px-2 py-0.5 rounded text-stone-400">Turn {worldData.turn}</span>
        </div>
        <div className="space-y-2 text-xs font-mono">
           <div className="flex gap-2">
              <span className="text-stone-500">PHASE:</span>
              <span className="text-stone-200">{pendingBuilds.length > 0 ? "CONSTRUCTION" : "IDLE / GATHERING"}</span>
           </div>
           <div className="flex gap-2 items-start">
              <span className="text-stone-500">QUEUE:</span>
              <div className="flex-1">
                 {pendingBuilds.length === 0 && busyNpcs.length === 0 && <span className="text-stone-500 italic">No pending commands.</span>}
                 {pendingBuilds.map((b: Building, i: number) => (
                    <div key={i} className="text-blue-400">Build [{b.name}] @ {b.x},{b.y}</div>
                 ))}
                 {busyNpcs.slice(0, 3).map((n: NPC, i: number) => (
                    <div key={i} className="text-emerald-400">{n.name}: {n.currentTask}</div>
                 ))}
                 {busyNpcs.length > 3 && <div className="text-stone-500">...and {busyNpcs.length - 3} more</div>}
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
         <div className="bg-stone-300 p-1 rounded shadow-inner">
           <div className="grid grid-cols-3 gap-1 aspect-square">
              {['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'].map((loc, i) => {
                 const x = Math.floor(i / 3);
                 const y = i % 3;
                 const b = buildings.find((b: Building) => b.x === x && b.y === y);
                 const count = agents.filter((a: Agent) => a.locationName?.includes(loc)).length;
                 
                 return (
                   <div key={i} className="bg-stone-200 rounded border border-stone-300 flex flex-col items-center justify-center relative active:bg-white transition-colors">
                      <span className="text-[10px] font-bold text-stone-500 z-10">{loc}</span>
                      {b && (
                        <div className="absolute bottom-2 w-3/4 flex flex-col items-center gap-0.5 z-10">
                           <span className="text-[8px] leading-none font-bold text-stone-600 bg-white/80 px-1 rounded scale-90">{b.name}</span>
                           <div className="h-1 w-full bg-stone-400/50 rounded-full overflow-hidden">
                              <div className={`h-full ${b.status==='active'?'bg-emerald-500':'bg-amber-400'}`} style={{width: `${(b.progress/b.maxProgress)*100}%`}}></div>
                           </div>
                        </div>
                      )}
                      {count > 0 && <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white">{count}</div>}
                   </div>
                 )
              })}
           </div>
         </div>
         
         <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="bg-white p-3 rounded border border-stone-200 shadow-sm">
               <div className="text-[10px] text-stone-400 uppercase">Active Buildings</div>
               <div className="text-lg font-bold text-stone-700">{activeBuilds.length}</div>
            </div>
            <div className="bg-white p-3 rounded border border-stone-200 shadow-sm">
               <div className="text-[10px] text-stone-400 uppercase">Blueprints</div>
               <div className="text-lg font-bold text-blue-600">{pendingBuilds.length}</div>
            </div>
         </div>
      </div>
    </div>
  );

  // --- 组件：日志列表 ---
  const LogPanel = () => (
    <div className="flex flex-col h-full bg-[#e5e5e5]">
      <div className="h-12 bg-white border-b border-stone-200 flex items-center px-4 justify-between shrink-0 shadow-sm">
         <span className="font-bold text-sm text-stone-700 uppercase">System Logs</span>
         <span className="text-[10px] font-mono text-stone-400">LATEST TOP</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
         {logs.slice().reverse().map((log: string, i: number) => (
           <div key={i} className={`p-4 rounded border ${i===0 ? 'bg-white shadow-md border-l-4 border-l-blue-500 border-y-stone-200 border-r-stone-200' : 'bg-[#efefef] border-stone-200 text-stone-600'}`}>
              <div className="flex justify-between items-start mb-1">
                 <span className="text-[9px] font-mono text-stone-400">LOG #{String(logs.length - i).padStart(3,'0')}</span>
                 {i===0 && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold">NEW</span>}
              </div>
              <p className="text-sm leading-6 text-stone-800 font-serif text-justify">{log}</p>
           </div>
         ))}
      </div>
    </div>
  );

  // --- 组件：人员名单 ---
  const RosterPanel = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-stone-200 shrink-0">
         <button onClick={()=>setRightTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='ai'?'bg-white text-blue-600 border-b-2 border-blue-600':'bg-stone-50 text-stone-400'}`}>Elites</button>
         <button onClick={()=>setRightTab('npc')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='npc'?'bg-white text-emerald-600 border-b-2 border-emerald-600':'bg-stone-50 text-stone-400'}`}>Drones</button>
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
              <div className="text-[10px] font-mono bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-emerald-700">{npc.currentTask}</div>
           </div>
         ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-[#e5e5e5] text-stone-800 font-sans overflow-hidden">
      
      {/* 桌面端布局 */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-stone-300 z-10"><ControlPanel /></aside>
        <main className="flex-1 flex flex-col min-w-0 bg-[#e5e5e5] z-0">
           <div className="h-72 border-b border-stone-300"><MapDashboard /></div>
           <div className="flex-1 relative"><LogPanel /></div>
        </main>
        <aside className="w-72 border-l border-stone-300 z-10"><RosterPanel /></aside>
      </div>

      {/* 移动端布局 */}
      <div className="md:hidden flex-1 overflow-hidden relative bg-[#e5e5e5]">
        {mobileView === 'logs' && <LogPanel />}
        {mobileView === 'map' && <MapDashboard />}
        {mobileView === 'control' && <ControlPanel />}
        {mobileView === 'roster' && <RosterPanel />}
      </div>

      {/* 底部导航栏 (带进度条) */}
      <nav className="md:hidden h-14 bg-white border-t border-stone-200 flex justify-around items-center shrink-0 z-50 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)] relative">
        {/* 顶部微型进度条 */}
        <div className="absolute top-0 left-0 h-0.5 bg-blue-500 transition-all duration-1000 ease-linear" style={{width: `${((20-nextRefresh)/20)*100}%`}}></div>
        
        <button onClick={() => setMobileView('logs')} className={`flex flex-col items-center gap-0.5 p-2 w-16 transition-colors ${mobileView==='logs'?'text-blue-600':'text-stone-400'}`}>
          <span className="text-lg">📄</span>
          <span className="text-[10px] font-bold">日志</span>
        </button>
        <button onClick={() => setMobileView('map')} className={`flex flex-col items-center gap-0.5 p-2 w-16 transition-colors ${mobileView==='map'?'text-blue-600':'text-stone-400'}`}>
          <span className="text-lg">🗺️</span>
          <span className="text-[10px] font-bold">地图</span>
        </button>
        <button onClick={() => setMobileView('control')} className={`flex flex-col items-center gap-0.5 p-2 w-16 transition-colors ${mobileView==='control'?'text-blue-600':'text-stone-400'}`}>
          <span className="text-lg">🛠️</span>
          <span className="text-[10px] font-bold">建设</span>
        </button>
        <button onClick={() => setMobileView('roster')} className={`flex flex-col items-center gap-0.5 p-2 w-16 transition-colors ${mobileView==='roster'?'text-blue-600':'text-stone-400'}`}>
          <span className="text-lg">👥</span>
          <span className="text-[10px] font-bold">人员</span>
        </button>
      </nav>

    </div>
  );
}
