'use client';
import { useState, useEffect } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, Map as MapIcon, FileText, Users, Construction, RefreshCw } from 'lucide-react';
// 引入新的游戏地图
import GameMap from './components/GameMap';

// ... 类型定义保持不变 ...
type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Building = { type: string; name: string; status: string; progress: number; maxProgress: number; x: number; y: number; desc?: string; };
type Resources = { wood: number; stone: number; food: number; medicine: number; };

// ... BUILD_OPTIONS 保持不变 ...
const BUILD_OPTIONS = [
  { type: "House", name: "居住屋", cost: "木50" },
  { type: "Warehouse", name: "大仓库", cost: "木80 石20" },
  { type: "Clinic", name: "诊所", cost: "木100 石50" },
  { type: "Kitchen", name: "厨房", cost: "木60 石30" },
  { type: "Tower", name: "瞭望塔", cost: "木120 石80" }
];

// ... SymbolAvatar 保持不变 ...
const SymbolAvatar = ({ name, job }: { name?: string, job: string }) => {
    // ... 代码不变 ...
    let Icon = Users;
    let color = "bg-stone-400";
    if (job.includes("消防") || job.includes("保安")) { Icon = Shield; color = "bg-blue-600"; }
    else if (job.includes("医生") || job.includes("护士")) { Icon = Stethoscope; color = "bg-rose-500"; }
    else if (job.includes("建筑") || job.includes("工")) { Icon = Hammer; color = "bg-amber-600"; }
    else if (job.includes("厨")) { Icon = Utensils; color = "bg-orange-500"; }
    else if (job.includes("学") || job.includes("记录")) { Icon = Book; color = "bg-indigo-500"; }
    else if (job.includes("商")) { Icon = Coins; color = "bg-emerald-600"; }
    else if (job.includes("斥候")) { Icon = Search; color = "bg-violet-600"; }
    else if (job.includes("占卜")) { Icon = Zap; color = "bg-purple-600"; }
    return (
      <div title={name} className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center text-white shadow-sm shrink-0 border border-white/20`}>
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
    if (!confirm("⚠️ 警告：系统将完全重置。确认？")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => {
    alert(`指令已下达：建造【${type}】`);
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
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#111] text-stone-500 gap-4">
      <div className="w-12 h-12 border-4 border-stone-700 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="font-mono text-xs tracking-widest text-blue-500">ESTABLISHING UPLINK...</div>
    </div>
  );

  const { agents, npcs, buildings, globalResources, logs } = worldData;

  // --- 面板组件 ---
  const ControlPanel = () => (
    <div className="flex flex-col h-full bg-[#1a1a1a] border-r border-[#333] text-stone-300">
       <div className="p-4 border-b border-[#333]">
        <h2 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3">Resources</h2>
        <div className="grid grid-cols-2 gap-2">
           <div className="flex justify-between text-xs p-2 bg-[#252525] rounded border border-[#333]"><span className="text-stone-500">Wood</span> <span className="font-bold text-amber-500">{globalResources.wood}</span></div>
           <div className="flex justify-between text-xs p-2 bg-[#252525] rounded border border-[#333]"><span className="text-stone-500">Stone</span> <span className="font-bold text-stone-400">{globalResources.stone}</span></div>
           <div className="flex justify-between text-xs p-2 bg-[#252525] rounded border border-[#333]"><span className="text-stone-500">Food</span> <span className="font-bold text-green-500">{globalResources.food}</span></div>
           <div className="flex justify-between text-xs p-2 bg-[#252525] rounded border border-[#333]"><span className="text-stone-500">Meds</span> <span className="font-bold text-red-500">{globalResources.medicine}</span></div>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <h2 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3">Construction</h2>
        <div className="space-y-2">
          {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-full bg-[#252525] p-3 rounded hover:bg-[#333] border border-[#333] transition-all text-left flex justify-between items-center group">
              <div>
                <div className="font-bold text-stone-300 text-sm group-hover:text-white">{opt.name}</div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">{opt.cost}</div>
              </div>
              <Construction size={16} className="text-stone-600 group-hover:text-blue-500" />
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-[#333]">
        <button onClick={handleReset} className="w-full py-2 bg-red-900/20 text-red-500 rounded border border-red-900/50 hover:bg-red-900/40 text-xs font-bold flex items-center justify-center gap-2">
          <RefreshCw size={14} /> RESET
        </button>
      </div>
    </div>
  );

  const LogPanel = () => (
    <div className="flex flex-col h-full bg-[#f5f5f5] text-stone-800">
      <div className="h-10 border-b border-stone-200 flex items-center px-4 justify-between bg-white shrink-0">
         <span className="font-bold text-xs text-stone-600 uppercase">System Logs</span>
         <span className="text-[10px] font-mono text-stone-400">TURN {worldData.turn}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-serif">
         {logs.slice().reverse().map((log: string, i: number) => (
           <div key={i} className={`p-4 rounded border ${i===0 ? 'bg-white shadow-sm border-blue-200' : 'bg-[#fafafa] border-transparent text-stone-500'}`}>
              <div className="flex justify-between items-start mb-1">
                 <span className="text-[9px] font-mono text-stone-400">#{String(logs.length - i).padStart(3,'0')}</span>
              </div>
              <p className="text-sm leading-relaxed text-justify">{log}</p>
           </div>
         ))}
      </div>
    </div>
  );

  const RosterPanel = () => (
    <div className="flex flex-col h-full bg-[#1a1a1a] border-l border-[#333] text-stone-300">
       <div className="flex border-b border-[#333] shrink-0">
         <button onClick={()=>setRightTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='ai'?'text-blue-400 bg-[#252525]':'text-stone-600'}`}>Agents</button>
         <button onClick={()=>setRightTab('npc')} className={`flex-1 py-3 text-xs font-bold uppercase ${rightTab==='npc'?'text-emerald-400 bg-[#252525]':'text-stone-600'}`}>NPCs</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
         {rightTab === 'ai' ? agents.map((agent: Agent) => (
           <div key={agent.id} className="bg-[#252525] p-3 rounded border border-[#333] flex gap-3 hover:border-stone-500 transition-colors">
              <SymbolAvatar name={agent.name} job={agent.job} />
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-sm text-stone-200">{agent.name}</span>
                    <span className="text-[9px] bg-[#333] px-1.5 py-0.5 rounded text-stone-400">{agent.job}</span>
                 </div>
                 <div className="h-1 bg-[#333] rounded-full overflow-hidden w-full mb-1">
                    <div className={`h-full ${agent.hp>50?'bg-emerald-600':'bg-red-600'}`} style={{width: `${agent.hp}%`}}></div>
                 </div>
                 <div className="text-[10px] text-stone-500 truncate">{agent.actionLog?.replace(/[“|”]/g,'') || 'Idle'}</div>
              </div>
           </div>
         )) : npcs.map((npc: NPC) => (
           <div key={npc.id} className="bg-[#252525] p-3 rounded border border-[#333] flex justify-between items-center">
              <div>
                 <div className="font-bold text-xs text-stone-300">{npc.name}</div>
                 <div className="text-[10px] text-stone-600 uppercase">{npc.role}</div>
              </div>
              <div className="text-[10px] font-mono bg-emerald-900/30 text-emerald-500 px-2 py-1 rounded border border-emerald-900/50">{npc.currentTask}</div>
           </div>
         ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-[#111] overflow-hidden font-sans">
      
      {/* 桌面端布局 */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-56 z-20"><ControlPanel /></aside>
        
        <main className="flex-1 flex flex-col min-w-0 bg-[#000] z-0">
           {/* 地图区域：高度增加，背景深色 */}
           <div className="flex-1 relative overflow-hidden border-b border-[#333]">
              <GameMap worldData={worldData} />
           </div>
           {/* 日志区域：底部固定高度 */}
           <div className="h-48 relative z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.2)]"><LogPanel /></div>
        </main>
        
        <aside className="w-64 z-20"><RosterPanel /></aside>
      </div>

      {/* 移动端布局 */}
      <div className="md:hidden flex-1 overflow-hidden relative bg-[#111]">
        {mobileView === 'logs' && <LogPanel />}
        {mobileView === 'map' && <GameMap worldData={worldData} />}
        {mobileView === 'control' && <ControlPanel />}
        {mobileView === 'roster' && <RosterPanel />}
      </div>

      {/* 移动端导航 (深色) */}
      <nav className="md:hidden h-14 bg-[#1a1a1a] border-t border-[#333] flex justify-around items-center shrink-0 z-50 relative text-stone-400">
        <div className="absolute top-0 left-0 h-0.5 bg-blue-600 transition-all duration-1000 ease-linear" style={{width: `${((20-nextRefresh)/20)*100}%`}}></div>
        <button onClick={() => setMobileView('logs')} className={`flex flex-col items-center justify-center w-14 h-full ${mobileView==='logs'?'text-white':'text-stone-600'}`}><FileText size={18} /><span className="text-[9px] font-bold mt-0.5">LOGS</span></button>
        <button onClick={() => setMobileView('map')} className={`flex flex-col items-center justify-center w-14 h-full ${mobileView==='map'?'text-white':'text-stone-600'}`}><MapIcon size={18} /><span className="text-[9px] font-bold mt-0.5">MAP</span></button>
        <button onClick={() => setMobileView('control')} className={`flex flex-col items-center justify-center w-14 h-full ${mobileView==='control'?'text-white':'text-stone-600'}`}><Construction size={18} /><span className="text-[9px] font-bold mt-0.5">BUILD</span></button>
        <button onClick={() => setMobileView('roster')} className={`flex flex-col items-center justify-center w-14 h-full ${mobileView==='roster'?'text-white':'text-stone-600'}`}><Users size={18} /><span className="text-[9px] font-bold mt-0.5">TEAM</span></button>
      </nav>

    </div>
  );
}