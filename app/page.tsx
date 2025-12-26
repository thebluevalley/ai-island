'use client';
import { useState, useEffect, useRef } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, FileText, Users, Construction, RefreshCw, Activity, Terminal, Map as MapIcon } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Resources = { wood: number; stone: number; food: number; medicine: number; };

const BUILD_OPTIONS = [
  { type: "House", name: "House", cost: "Wood:50" },
  { type: "Warehouse", name: "Warehouse", cost: "Wood:80 Stone:20" },
  { type: "Clinic", name: "Clinic", cost: "Wood:100 Stone:50" },
  { type: "Kitchen", name: "Kitchen", cost: "Wood:60 Stone:30" },
  { type: "Tower", name: "Tower", cost: "Wood:120 Stone:80" }
];

const SymbolAvatar = ({ name, job }: { name?: string, job: string }) => {
    let Icon = Users;
    let color = "bg-stone-600";
    if (job.includes("消防") || job.includes("保安")) { Icon = Shield; color = "bg-blue-600"; }
    else if (job.includes("医生") || job.includes("护士")) { Icon = Stethoscope; color = "bg-rose-600"; }
    else if (job.includes("建筑") || job.includes("工")) { Icon = Hammer; color = "bg-amber-600"; }
    else if (job.includes("厨")) { Icon = Utensils; color = "bg-orange-600"; }
    else if (job.includes("学") || job.includes("记录")) { Icon = Book; color = "bg-indigo-600"; }
    else if (job.includes("商")) { Icon = Coins; color = "bg-emerald-700"; }
    else if (job.includes("斥候")) { Icon = Search; color = "bg-violet-600"; }
    else if (job.includes("占卜")) { Icon = Zap; color = "bg-purple-600"; }
    return (
      <div title={name} className={`w-7 h-7 ${color} rounded-md flex items-center justify-center text-white shadow-sm shrink-0 border border-black/20`}>
        <Icon size={14} strokeWidth={2.5} />
      </div>
    );
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(45);
  const [sidebarTab, setSidebarTab] = useState<'logs' | 'team'>('logs');

  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (loading || paused) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tick', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setWorldData(data.world);
        setNextRefresh(45);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ RESET SYSTEM?")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => {
    alert(`System: Order placed for ${type}`);
  };

  useEffect(() => { fetchData(); }, []);
  
  useEffect(() => {
    const timer = setInterval(() => {
      if (!paused && !loading) {
        setNextRefresh(prev => {
          if (prev <= 1) { fetchData(); return 45; }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, loading]);

  useEffect(() => {
    if (sidebarTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [worldData, sidebarTab]);

  if (!worldData) return (
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-[#111] text-stone-500 gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-stone-800 border-t-emerald-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
           <Activity size={24} />
        </div>
      </div>
      <div className="font-mono text-xs tracking-[0.2em] text-stone-600 uppercase">Connecting to Island Node...</div>
    </div>
  );

  const { agents, npcs, globalResources, logs } = worldData;

  // --- 悬浮资源栏 (黑色半透明) ---
  const FloatingResources = () => (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur text-white px-5 py-2.5 rounded-lg shadow-2xl border border-stone-700 flex gap-6 items-center">
       {Object.entries(globalResources).map(([key, val]: any) => (
         <div key={key} className="flex flex-col items-center gap-0.5 min-w-[2.5rem]">
            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wide">{key.slice(0,4)}</span>
            <span className={`text-sm font-mono font-bold leading-none ${key==='wood'?'text-amber-500':key==='food'?'text-emerald-500':key==='stone'?'text-stone-400':'text-rose-500'}`}>{val}</span>
         </div>
       ))}
    </div>
  );

  const FloatingBuildMenu = () => (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
        {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="group relative w-11 h-11 bg-stone-800/90 rounded-lg shadow-lg border border-stone-700 hover:border-blue-500 hover:scale-105 transition-all flex items-center justify-center text-stone-400 hover:text-white backdrop-blur">
                <Construction size={20} />
                <div className="absolute left-full ml-3 bg-black text-white text-xs py-2 px-3 rounded border border-stone-800 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    <div className="font-bold mb-0.5 text-blue-400">{opt.name}</div>
                    <div className="text-stone-500 text-[10px] font-mono">{opt.cost}</div>
                </div>
            </button>
        ))}
        <div className="h-px w-6 bg-stone-700 mx-auto my-2"></div>
        <button onClick={handleReset} className="w-11 h-11 bg-red-900/50 text-red-500 border border-red-900 rounded-lg shadow-md hover:bg-red-900 hover:text-white flex items-center justify-center transition-colors">
             <RefreshCw size={18} />
        </button>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#111] overflow-hidden flex font-sans text-stone-300 p-2 gap-2">
      
      {/* --- 左侧：游戏画面 (Map) --- */}
      <div className="flex-[3] relative bg-[#0a0a0a] rounded-lg overflow-hidden border border-stone-800 shadow-2xl">
         <div className="absolute top-4 left-4 z-40 text-stone-600 font-black text-6xl opacity-10 pointer-events-none select-none">ISLAND_OS</div>
         <FloatingResources />
         <FloatingBuildMenu />
         {/* 容器宽高100%，让 GameMap 的 Auto-Fit 生效 */}
         <div className="w-full h-full">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* --- 右侧：终端日志 (Logs) --- */}
      <div className="flex-1 flex flex-col min-w-[320px] max-w-[420px] bg-[#1a1a1a] rounded-lg overflow-hidden border border-stone-800">
        
        {/* Header */}
        <div className="h-12 border-b border-stone-800 flex items-center px-4 justify-between shrink-0 bg-[#222]">
            <div className="flex gap-1 bg-[#111] p-1 rounded-md border border-stone-800">
                <button onClick={() => setSidebarTab('logs')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-2 transition-all ${sidebarTab==='logs' ? 'bg-stone-700 text-white shadow' : 'text-stone-500 hover:text-stone-400'}`}>
                    <Terminal size={12}/> LOGS
                </button>
                <button onClick={() => setSidebarTab('team')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-2 transition-all ${sidebarTab==='team' ? 'bg-stone-700 text-white shadow' : 'text-stone-500 hover:text-stone-400'}`}>
                    <Users size={12}/> UNITS
                </button>
            </div>
            
            {/* 倒计时条 */}
            <div className="flex items-center gap-2">
                <div className="text-[9px] font-mono text-stone-600">REFRESH</div>
                <div className="w-12 h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 transition-all duration-1000 ease-linear shadow-[0_0_5px_#059669]" style={{width: `${((45-nextRefresh)/45)*100}%`}}></div>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#1a1a1a] relative custom-scrollbar">
            {sidebarTab === 'logs' && (
                <div className="p-4 space-y-4">
                    {logs.slice().reverse().map((log: string, i: number) => {
                        const isLatest = i === 0;
                        return (
                            <div key={i} className={`relative pl-3 border-l-2 ${isLatest ? 'border-emerald-500' : 'border-stone-800'} pb-1`}>
                                <div className="text-[9px] font-mono text-stone-600 mb-0.5 flex justify-between">
                                    <span>#{String(logs.length - i).padStart(4,'0')}</span>
                                    {isLatest && <span className="text-emerald-500 font-bold animate-pulse">LIVE</span>}
                                </div>
                                <p className={`text-xs leading-relaxed font-mono ${isLatest ? 'text-stone-300' : 'text-stone-500'}`}>
                                    {log}
                                </p>
                            </div>
                        )
                    })}
                    <div ref={logsEndRef} />
                </div>
            )}

            {sidebarTab === 'team' && (
                <div className="p-3 space-y-2">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-[#222] p-2 rounded border border-stone-800 shadow-sm flex gap-3 items-center group hover:border-stone-600 transition-colors">
                            <SymbolAvatar name={agent.name} job={agent.job} />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-bold text-xs text-stone-300 group-hover:text-white">{agent.name}</span>
                                    <span className="text-[9px] font-mono text-stone-600 uppercase">{agent.job}</span>
                                </div>
                                <div className="h-1 bg-stone-900 rounded-full overflow-hidden w-full my-1">
                                    <div className={`h-full ${agent.hp>50?'bg-emerald-600':'bg-red-600'}`} style={{width: `${agent.hp}%`}}></div>
                                </div>
                                <div className="text-[9px] text-stone-500 truncate font-mono">
                                    {agent.actionLog ? `> ${agent.actionLog.replace(/[“|”]/g,'')}` : '> STANDBY'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}