'use client';
import { useState, useEffect } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, Map as MapIcon, FileText, Users, Construction, RefreshCw, Box } from 'lucide-react';
import GameMap from './components/GameMap';

// ... 类型定义 (保持不变) ...
type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Building = { type: string; name: string; status: string; progress: number; maxProgress: number; x: number; y: number; desc?: string; };
type Resources = { wood: number; stone: number; food: number; medicine: number; };

const BUILD_OPTIONS = [
  { type: "House", name: "居住屋", cost: "木50" },
  { type: "Warehouse", name: "大仓库", cost: "木80 石20" },
  { type: "Clinic", name: "诊所", cost: "木100 石50" },
  { type: "Kitchen", name: "厨房", cost: "木60 石30" },
  { type: "Tower", name: "瞭望塔", cost: "木120 石80" }
];

const SymbolAvatar = ({ name, job }: { name?: string, job: string }) => {
    let Icon = Users;
    let color = "bg-stone-400";
    if (job.includes("消防") || job.includes("保安")) { Icon = Shield; color = "bg-blue-500"; }
    else if (job.includes("医生") || job.includes("护士")) { Icon = Stethoscope; color = "bg-rose-500"; }
    else if (job.includes("建筑") || job.includes("工")) { Icon = Hammer; color = "bg-amber-500"; }
    else if (job.includes("厨")) { Icon = Utensils; color = "bg-orange-500"; }
    else if (job.includes("学") || job.includes("记录")) { Icon = Book; color = "bg-indigo-500"; }
    else if (job.includes("商")) { Icon = Coins; color = "bg-emerald-600"; }
    else if (job.includes("斥候")) { Icon = Search; color = "bg-violet-500"; }
    else if (job.includes("占卜")) { Icon = Zap; color = "bg-purple-500"; }
    return (
      <div title={name} className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center text-white shadow-sm shrink-0 border border-white/40`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
    );
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(20); 
  const [rightTab, setRightTab] = useState<'ai' | 'npc'>('ai');
  const [mobileView, setMobileView] = useState<'logs' | 'map' | 'control' | 'roster'>('map');

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
    if (!confirm("⚠️ 确定要重置世界吗？")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => {
    alert(`指令：建造 ${type}`);
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
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-stone-50 text-stone-400 gap-4">
      <div className="w-10 h-10 border-4 border-stone-200 border-t-blue-400 rounded-full animate-spin"></div>
      <div className="font-mono text-xs tracking-widest text-stone-500">LOADING WORLD...</div>
    </div>
  );

  const { agents, npcs, buildings, globalResources, logs } = worldData;

  // --- 面板组件 (浅色版) ---
  const ControlPanel = () => (
    <div className="flex flex-col h-full bg-white border-r border-stone-200 text-stone-600">
       <div className="p-5 border-b border-stone-100">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Box size={12}/> Resources
        </h2>
        <div className="grid grid-cols-2 gap-2">
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-lg border border-stone-100"><span className="text-stone-400">Wood</span> <span className="font-bold text-amber-600">{globalResources.wood}</span></div>
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-lg border border-stone-100"><span className="text-stone-400">Stone</span> <span className="font-bold text-stone-500">{globalResources.stone}</span></div>
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-lg border border-stone-100"><span className="text-stone-400">Food</span> <span className="font-bold text-emerald-600">{globalResources.food}</span></div>
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-lg border border-stone-100"><span className="text-stone-400">Meds</span> <span className="font-bold text-rose-500">{globalResources.medicine}</span></div>
        </div>
      </div>
      <div className="flex-1 p-5 overflow-y-auto">
        <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
           <Construction size={12}/> Construction
        </h2>
        <div className="space-y-2.5">
          {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-full bg-white p-3 rounded-xl hover:bg-stone-50 border border-stone-200 shadow-sm transition-all text-left flex justify-between items-center group hover:border-blue-300">
              <div>
                <div className="font-bold text-stone-700 text-sm group-hover:text-blue-600">{opt.name}</div>
                <div className="text-[10px] text-stone-400 font-mono mt-0.5">{opt.cost}</div>
              </div>
              <Construction size={16} className="text-stone-300 group-hover:text-blue-500" />
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-stone-100 bg-stone-50/50">
        <button onClick={handleReset} className="w-full py-2.5 bg-white text-red-500 rounded-lg border border-red-100 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
          <RefreshCw size={14} /> RESET WORLD
        </button>
      </div>
    </div>
  );

  const LogPanel = () => (
    <div className="flex flex-col h-full bg-stone-50 text-stone-800">
      <div className="h-10 border-b border-stone-200 flex items-center px-4 justify-between bg-white shrink-0 shadow-sm z-10">
         <span className="font-bold text-xs text-stone-600 uppercase flex items-center gap-2"><FileText size={12}/> Event Logs</span>
         <span className="text-[10px] font-mono text-stone-400">T-{worldData.turn}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
         {logs.slice().reverse().map((log: string, i: number) => (
           <div key={i} className={`p-4 rounded-xl border leading-relaxed ${i===0 ? 'bg-white shadow-md border-blue-100 ring-1 ring-blue-50' : 'bg-white border-stone-100 text-stone-500 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-1.5">
                 <span className="text-[9px] font-mono text-stone-300">LOG #{String(logs.length - i).padStart(3,'0')}</span>
              </div>
              <p className="text-sm text-stone-700 leading-6 text-justify">{log}</p>
           </div>
         ))}
      </div>
    </div>
  );

  const RosterPanel = () => (
    <div className="flex flex-col h-full bg-white border-l border-stone-200 text-stone-600">
       <div className="flex border-b border-stone-100 shrink-0 p-1 bg-stone-50 m-4 rounded-lg">
         <button onClick={()=>setRightTab('ai')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${rightTab==='ai'?'bg-white shadow-sm text-blue-600':'text-stone-400 hover:text-stone-600'}`}>Agents</button>
         <button onClick={()=>setRightTab('npc')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${rightTab==='npc'?'bg-white shadow-sm text-emerald-600':'text-stone-400 hover:text-stone-600'}`}>Workers</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
         {rightTab === 'ai' ? agents.map((agent: Agent) => (
           <div key={agent.id} className="bg-white p-2.5 rounded-xl border border-stone-100 shadow-sm flex gap-3 hover:border-blue-200 transition-colors">
              <SymbolAvatar name={agent.name} job={agent.job} />
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-sm text-stone-700">{agent.name}</span>
                    <span className="text-[9px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500">{agent.job}</span>
                 </div>
                 <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden w-full mb-1.5">
                    <div className={`h-full ${agent.hp>50?'bg-emerald-400':'bg-red-400'}`} style={{width: `${agent.hp}%`}}></div>
                 </div>
                 {/* 列表里的状态也截断，保持整洁 */}
                 <div className="text-[10px] text-stone-400 truncate">
                   {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'') : 'Idle'}
                 </div>
              </div>
           </div>
         )) : npcs.map((npc: NPC) => (
           <div key={npc.id} className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm flex justify-between items-center">
              <div>
                 <div className="font-bold text-xs text-stone-600">{npc.name}</div>
                 <div className="text-[10px] text-stone-400 uppercase">{npc.role}</div>
              </div>
              <div className="text-[10px] font-mono bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100">{npc.currentTask}</div>
           </div>
         ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-stone-100 overflow-hidden font-sans text-stone-800">
      
      {/* 桌面端布局 */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-64 z-20 shadow-xl shadow-stone-200/50"><ControlPanel /></aside>
        
        <main className="flex-1 flex flex-col min-w-0 bg-stone-50 z-0">
           {/* 地图区域 */}
           <div className="flex-1 relative overflow-hidden border-b border-stone-200 bg-stone-100">
              <GameMap worldData={worldData} />
           </div>
           {/* 日志区域 */}
           <div className="h-56 relative z-10 bg-white"><LogPanel /></div>
        </main>
        
        <aside className="w-72 z-20 shadow-xl shadow-stone-200/50"><RosterPanel /></aside>
      </div>

      {/* 移动端布局 */}
      <div className="md:hidden flex-1 overflow-hidden relative bg-stone-50">
        {mobileView === 'logs' && <LogPanel />}
        {mobileView === 'map' && <GameMap worldData={worldData} />}
        {mobileView === 'control' && <ControlPanel />}
        {mobileView === 'roster' && <RosterPanel />}
      </div>

      {/* 移动端导航 (白底) */}
      <nav className="md:hidden h-16 bg-white border-t border-stone-200 flex justify-around items-center shrink-0 z-50 relative pb-safe">
        <div className="absolute top-0 left-0 h-0.5 bg-blue-500 transition-all duration-1000 ease-linear" style={{width: `${((20-nextRefresh)/20)*100}%`}}></div>
        <button onClick={() => setMobileView('logs')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='logs'?'text-blue-600':'text-stone-400'}`}><FileText size={20} /><span className="text-[9px] font-bold mt-1">LOGS</span></button>
        <button onClick={() => setMobileView('map')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='map'?'text-blue-600':'text-stone-400'}`}><MapIcon size={20} /><span className="text-[9px] font-bold mt-1">MAP</span></button>
        <button onClick={() => setMobileView('control')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='control'?'text-blue-600':'text-stone-400'}`}><Construction size={20} /><span className="text-[9px] font-bold mt-1">BUILD</span></button>
        <button onClick={() => setMobileView('roster')} className={`flex flex-col items-center justify-center w-16 h-full ${mobileView==='roster'?'text-blue-600':'text-stone-400'}`}><Users size={20} /><span className="text-[9px] font-bold mt-1">TEAM</span></button>
      </nav>

    </div>
  );
}