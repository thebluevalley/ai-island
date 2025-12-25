'use client';
import { useState, useEffect } from 'react';
// 引入 Lucide 图标
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, Map as MapIcon, FileText, Users, Construction, RefreshCw } from 'lucide-react';

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

// --- 符号化头像组件 (修复：添加 name 属性定义) ---
// 增加 name?: string 使得传入 name 不会报错，并将其用于 title 属性
const SymbolAvatar = ({ name, job }: { name?: string, job: string }) => {
  let Icon = Users;
  let color = "bg-stone-400";

  // 根据职业映射图标和颜色
  if (job.includes("消防") || job.includes("保安")) { Icon = Shield; color = "bg-blue-600"; }
  else if (job.includes("医生") || job.includes("护士")) { Icon = Stethoscope; color = "bg-rose-500"; }
  else if (job.includes("建筑") || job.includes("工")) { Icon = Hammer; color = "bg-amber-600"; }
  else if (job.includes("厨")) { Icon = Utensils; color = "bg-orange-500"; }
  else if (job.includes("学") || job.includes("记录")) { Icon = Book; color = "bg-indigo-500"; }
  else if (job.includes("商")) { Icon = Coins; color = "bg-emerald-600"; }
  else if (job.includes("斥候")) { Icon = Search; color = "bg-violet-600"; }
  else if (job.includes("占卜")) { Icon = Zap; color = "bg-purple-600"; }

  return (
    // 添加 title={name}，鼠标悬停时可以看到名字
    <div title={name} className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white shadow-sm shrink-0 border border-white/20`}>
      <Icon size={20} strokeWidth={2.5} />
    </div>
  );
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
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
        setNextRefresh(20);
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
  useEffect(() => {
    const timer = setInterval(() => {
      if (!paused && !loading) {
        setNextRefresh(prev => {
          if (prev <= 1) { fetchData(); return 20; }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, loading]);

  if (!worldData) return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#e5e5e5] text-stone-500 gap-4">
      <div className="w-8 h-8 border-4 border-stone-300 border-t-stone-600 rounded-full animate-spin"></div>
      <div className="font-mono text-xs tracking-widest">CONNECTING TO SATELLITE...</div>
    </div>
  );

  const { agents, npcs, buildings, globalResources, logs, weather } = worldData;
  const pendingBuilds = buildings.filter((b: Building) => b.status === 'blueprint');
  const activeBuilds = buildings.filter((b: Building) => b.status === 'active');

  // --- 面板组件 ---
  
  const ControlPanel = () => (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="p-4 bg-white border-b border-stone-200">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Resources</h2>
        <div className="grid grid-cols-2 gap-3">
           <div className="flex justify-between text-xs p-2 bg-stone-50 rounded border border-stone-100"><span className="text-stone-500">木材</span> <span className="font-bold text-stone-800">{globalResources.wood}</span></div>
           <div className="flex justify-between text-xs p-2 bg-stone-50 rounded border border-stone-100"><span className="text-stone-500">石料</span> <span className="font-bold text-stone-800">{globalResources.stone}</span></div>
           <div className="flex justify-between text-xs p-2 bg-stone-50 rounded border border-stone-100"><span className="text-stone-500">食物</span> <span className="font-bold text-stone-800">{globalResources.food}</span></div>
           <div className="flex justify-between text-xs p-2 bg-stone-50 rounded border border-stone-100"><span className="text-stone-500">药品</span> <span className="font-bold text-stone-800">{globalResources.medicine}</span></div>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto bg-[#fafaf9]">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Construction</h2>
        <div className="space-y-2">
          {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-full bg-white p-3 rounded-lg border border-stone-200 shadow-sm active:scale-95 transition-all text-left flex justify-between items-center">
              <div>
                <div className="font-bold text-stone-700 text-sm">{opt.name}</div>
                <div className="text-[10px] text-stone-400 font-mono mt-0.5">{opt.cost}</div>
              </div>
              <Construction size={16} className="text-stone-300" />
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-stone-200 bg-stone-100 mt-auto">
        <button onClick={handleReset} className="w-full py-3 bg-red-50 text-red-600 rounded border border-red-200 font-bold active:bg-red-100 text-xs tracking-wider flex items-center justify-center gap-2">
          <RefreshCw size={14} /> REBOOT SYSTEM
        </button>
      </div>
    </div>
  );

  const MapDashboard = () => (
    <div className="flex flex-col h-full bg-[#e5e5e5]">
      <div className="bg-stone-800 text-stone-300 p-4 shadow-md shrink-0">
        <div className="flex justify-between items-center mb-3">
           <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest animate-pulse">Command Center</h2>
           <span className="text-[10px] font-mono bg-stone-700 px-2 py-0.5 rounded text-stone-400">Turn {worldData.turn}</span>
        </div>
        <div className="text-xs font-mono text-stone-400 space-y-1">
           <div>Phase: {pendingBuilds.length > 0 ? "CONSTRUCTION" : "IDLE"}</div>
           <div>Queue: {pendingBuilds.length} blueprints</div>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
         <div className="bg-stone-300 p-1 rounded shadow-inner mb-4">
           <div className="grid grid-cols-3 gap-1 aspect-square">
              {['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'].map((loc, i) => {
                 const x = Math.floor(i / 3);
                 const y = i % 3;
                 const b = buildings.find((b: Building) => b.x === x && b.y === y);
                 const count = agents.filter((a: Agent) => a.locationName?.includes(loc)).length;
                 return (
                   <div key={i} className="bg-stone-200 rounded border border-stone-300 flex flex-col items-center justify-center relative active:bg-white transition-colors">
                      <span className="text-[10px] font-bold text-stone-500 z-10 scale-90">{loc}</span>
                      {b && <div className={`absolute bottom-1 w-2 h-2 rounded-full ${b.status==='active'?'bg-emerald-500':'bg-amber-400 animate-pulse'}`}></div>}
                      {count > 0 && <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">{count}</div>}
                   </div>
                 )
              })}
           </div>
         </div>
         <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase">Active Infrastructure</h3>
            {activeBuilds.length === 0 && <div className="text-xs text-stone-400 italic">No buildings yet.</div>}
            {activeBuilds.map((b: Building, i: number) => (
               <div key={i} className="flex justify-between text-xs bg-white p-2 rounded border border-stone-200">
                  <span className="font-bold text-stone-700">{b.name}</span>
                  <span className="text-emerald-600 font-mono">ACTIVE</span>
               </div>
            ))}
         </div>
      </div>
    </div>
  );

  const LogPanel = () => (
    <div className="flex flex-col h-full bg-[#e5e5e5]">
      <div className="h-12 bg-white border-b border-stone-200 flex items-center px-4 justify-between shrink-0 shadow-sm">
         <span className="font-bold text-sm text-stone-700 uppercase">System Logs</span>
         <span className="text-[10px] font-mono text-stone-400">LATEST FIRST</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
         {logs.slice().reverse().map((log: string, i: number) => (
           <div key={i} className={`p-4 rounded border ${i===0 ? 'bg-white shadow-md border-l-4 border-l-blue-500' : 'bg-[#efefef] border-stone-200 text-stone-600'}`}>
              <div className="flex justify-between items-start mb-1">
                 <span className="text-[9px] font-mono text-stone-400">#{String(logs.length - i).padStart(3,'0')}</span>
                 {i===0 && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold">NEW</span>}
              </div>
              <p className="text-sm leading-6 text-stone-800 font-serif text-justify break-all whitespace-pre-wrap">{log}</p>
           </div>
         ))}
      </div>
    </div>
  );

  const RosterPanel = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-stone-200 shrink-0">
         <button onClick={()=>setRightTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='ai'?'text-blue-600 border-b-2 border-blue-600':'text-stone-400'}`}>Elites</button>
         <button onClick={()=>setRightTab('npc')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='npc'?'text-emerald-600 border-b-2 border-emerald-600':'text-stone-400'}`}>Drones</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 bg-stone-50 space-y-2">
         {rightTab === 'ai' ? agents.map((agent: Agent) => (
           <div key={agent.id} className="bg-white p-3 rounded-lg border border-stone-200 shadow-sm flex gap-3">
              <SymbolAvatar name={agent.name} job={agent.job} />
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-sm text-stone-800">{agent.name}</span>
                    <span className="text-[9px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500">{agent.job}</span>
                 </div>
                 <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden w-full mb-1">
                    <div className={`h-full ${agent.hp>50?'bg-emerald-500':'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                 </div>
                 <div className="text-[10px] text-stone-500 truncate italic">“{agent.actionLog}”</div>
              </div>
           </div>
         )) : npcs.map((npc: NPC) => (
           <div key={npc.id} className="bg-white p-3 rounded border border-stone-200 flex justify-between items-center shadow-sm">
              <div>
                 <div className="font-bold text-xs text-stone-700">{npc.name}</div>
                 <div className="text-[10px] text-stone-400 uppercase">{npc.role}</div>
              </div>
              <div className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded">{npc.currentTask}</div>
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
           <div className="h-64 border-b border-stone-300"><MapDashboard /></div>
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

      {/* 移动端底部导航 */}
      <nav className="md:hidden h-14 bg-white border-t border-stone-200 flex justify-around items-center shrink-0 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative">
        <div className="absolute top-0 left-0 h-0.5 bg-blue-500 transition-all duration-1000 ease-linear" style={{width: `${((20-nextRefresh)/20)*100}%`}}></div>
        
        <button onClick={() => setMobileView('logs')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='logs'?'text-blue-600':'text-stone-400'}`}>
          <FileText size={20} />
          <span className="text-[10px] font-bold mt-0.5">日志</span>
        </button>
        <button onClick={() => setMobileView('map')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='map'?'text-blue-600':'text-stone-400'}`}>
          <MapIcon size={20} />
          <span className="text-[10px] font-bold mt-0.5">地图</span>
        </button>
        <button onClick={() => setMobileView('control')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='control'?'text-blue-600':'text-stone-400'}`}>
          <Construction size={20} />
          <span className="text-[10px] font-bold mt-0.5">建设</span>
        </button>
        <button onClick={() => setMobileView('roster')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='roster'?'text-blue-600':'text-stone-400'}`}>
          <Users size={20} />
          <span className="text-[10px] font-bold mt-0.5">人员</span>
        </button>
      </nav>

    </div>
  );
}