'use client';
import { useState, useEffect, useRef } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, FileText, Users, Construction, RefreshCw, Activity, Terminal } from 'lucide-react';
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
    let color = "bg-stone-300";
    if (job.includes("消防") || job.includes("保安")) { Icon = Shield; color = "bg-blue-500"; }
    else if (job.includes("医生") || job.includes("护士")) { Icon = Stethoscope; color = "bg-rose-500"; }
    else if (job.includes("建筑") || job.includes("工")) { Icon = Hammer; color = "bg-amber-500"; }
    else if (job.includes("厨")) { Icon = Utensils; color = "bg-orange-500"; }
    else if (job.includes("学") || job.includes("记录")) { Icon = Book; color = "bg-indigo-500"; }
    else if (job.includes("商")) { Icon = Coins; color = "bg-emerald-600"; }
    else if (job.includes("斥候")) { Icon = Search; color = "bg-violet-500"; }
    else if (job.includes("占卜")) { Icon = Zap; color = "bg-purple-500"; }
    return (
      <div title={name} className={`w-7 h-7 ${color} rounded-md flex items-center justify-center text-white shadow-sm shrink-0 border border-black/10`}>
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
    if (!confirm("⚠️ RESET WORLD? All progress will be lost.")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => {
    alert(`Command sent: Build ${type}`);
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
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-[#1e1e1e] text-stone-500 gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-stone-700 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
      <div className="font-mono text-xs tracking-[0.2em] text-stone-500 uppercase">Loading Assets...</div>
    </div>
  );

  const { agents, npcs, globalResources, logs } = worldData;

  // --- 悬浮资源栏 (像素风) ---
  const FloatingResources = () => (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#1e1e1e] text-white px-4 py-2 rounded-lg shadow-xl border border-stone-700 flex gap-6 items-center">
       {Object.entries(globalResources).map(([key, val]: any) => (
         <div key={key} className="flex flex-col items-center gap-0.5 min-w-[2.5rem]">
            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wide">{key.slice(0,4)}</span>
            <span className={`text-sm font-bold leading-none ${key==='wood'?'text-amber-500':key==='food'?'text-emerald-500':key==='stone'?'text-stone-400':'text-rose-500'}`}>{val}</span>
         </div>
       ))}
    </div>
  );

  const FloatingBuildMenu = () => (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
        {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="group relative w-10 h-10 bg-white rounded-lg shadow-md border-2 border-stone-200 hover:border-blue-500 hover:scale-105 transition-all flex items-center justify-center text-stone-500 hover:text-blue-600">
                <Construction size={18} />
                <div className="absolute left-full ml-3 bg-[#1e1e1e] text-white text-xs py-1.5 px-3 rounded border border-stone-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    <div className="font-bold mb-0.5 text-blue-400">{opt.name}</div>
                    <div className="text-stone-400 text-[10px] font-mono">{opt.cost}</div>
                </div>
            </button>
        ))}
        <div className="h-px w-6 bg-stone-600 mx-auto my-2"></div>
        <button onClick={handleReset} className="w-10 h-10 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 flex items-center justify-center">
             <RefreshCw size={16} />
        </button>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#2d2d2d] overflow-hidden flex font-sans text-stone-800 p-2 gap-2">
      
      {/* --- 左侧：游戏画面 (75%) --- */}
      <div className="flex-[3] relative bg-black rounded-lg overflow-hidden border-2 border-[#1e1e1e] shadow-2xl">
         <FloatingResources />
         <FloatingBuildMenu />
         <GameMap worldData={worldData} />
      </div>

      {/* --- 右侧：终端日志 (25%) --- */}
      <div className="flex-1 flex flex-col min-w-[300px] max-w-[400px] bg-[#f5f5f4] rounded-lg overflow-hidden border-2 border-[#1e1e1e]">
        
        {/* Header */}
        <div className="h-12 border-b border-stone-200 flex items-center px-4 justify-between shrink-0 bg-white">
            <div className="flex gap-1 bg-stone-100 p-1 rounded-md">
                <button onClick={() => setSidebarTab('logs')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 ${sidebarTab==='logs' ? 'bg-white shadow text-black' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Terminal size={12}/> SYSTEM
                </button>
                <button onClick={() => setSidebarTab('team')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 ${sidebarTab==='team' ? 'bg-white shadow text-black' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Users size={12}/> UNITS
                </button>
            </div>
            
            {/* 倒计时条 */}
            <div className="flex items-center gap-2">
                <div className="text-[10px] font-mono text-stone-400">NEXT TICK</div>
                <div className="w-10 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-1000 ease-linear" style={{width: `${((45-nextRefresh)/45)*100}%`}}></div>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#fafafa] relative">
            {sidebarTab === 'logs' && (
                <div className="p-4 space-y-4">
                    {logs.slice().reverse().map((log: string, i: number) => {
                        const isLatest = i === 0;
                        return (
                            <div key={i} className={`relative pl-3 border-l-2 ${isLatest ? 'border-emerald-500' : 'border-stone-200'} pb-1`}>
                                <div className="text-[9px] font-mono text-stone-400 mb-0.5 flex justify-between">
                                    <span>SEQ_{String(logs.length - i).padStart(4,'0')}</span>
                                    {isLatest && <span className="text-emerald-600 font-bold animate-pulse">LIVE</span>}
                                </div>
                                <p className={`text-xs leading-relaxed font-mono ${isLatest ? 'text-stone-900' : 'text-stone-500'}`}>
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
                        <div key={agent.id} className="bg-white p-2 rounded border border-stone-200 shadow-sm flex gap-3 items-center">
                            <SymbolAvatar name={agent.name} job={agent.job} />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-bold text-xs text-stone-800">{agent.name}</span>
                                    <span className="text-[9px] font-mono text-stone-400 uppercase">{agent.job}</span>
                                </div>
                                <div className="h-1 bg-stone-100 rounded-full overflow-hidden w-full my-1">
                                    <div className={`h-full ${agent.hp>50?'bg-emerald-500':'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                                </div>
                                <div className="text-[9px] text-stone-500 truncate font-mono">
                                    {agent.actionLog ? `> ${agent.actionLog.replace(/[“|”]/g,'')}` : '> IDLE'}
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