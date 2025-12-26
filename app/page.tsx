'use client';
import { useState, useEffect, useRef } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, FileText, Users, Construction, RefreshCw, Activity, Terminal } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Resources = { wood: number; stone: number; food: number; medicine: number; };

const BUILD_OPTIONS = [
  { type: "House", name: "House", cost: "50 Wood" },
  { type: "Warehouse", name: "Storage", cost: "80 Wood" },
  { type: "Clinic", name: "Clinic", cost: "100 Wood" },
  { type: "Kitchen", name: "Kitchen", cost: "60 Wood" },
  { type: "Tower", name: "Tower", cost: "120 Wood" }
];

const SymbolAvatar = ({ name, job }: { name?: string, job: string }) => {
    let color = "bg-stone-400";
    if (job.includes("建筑")) color = "bg-amber-500";
    else if (job.includes("医")) color = "bg-rose-500";
    else if (job.includes("领袖")) color = "bg-blue-500";
    else color = "bg-emerald-500";
    
    return (
      <div className={`w-7 h-7 ${color} rounded-md flex items-center justify-center text-white text-[10px] font-bold shadow-sm shrink-0 border border-white/20`}>
        {job[0]}
      </div>
    );
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(45);
  const [sidebarTab, setSidebarTab] = useState<'logs' | 'team'>('logs');

  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (loading) return;
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
    if (!confirm("Reset Simulation?")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => alert(`Order: ${type}`);

  useEffect(() => { fetchData(); }, []);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) { fetchData(); return 45; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (sidebarTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [worldData, sidebarTab]);

  if (!worldData) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-stone-50 text-stone-400 gap-4">
      <Activity className="animate-spin text-blue-400" size={32} />
      <div className="text-xs font-mono tracking-widest">CONNECTING TO ISLAND...</div>
    </div>
  );

  const { agents, globalResources, logs } = worldData;

  // --- UI 组件 ---
  const ResourceItem = ({ label, value, color }: any) => (
    <div className="flex flex-col items-center min-w-[3rem]">
       <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">{label}</span>
       <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#f3f4f6] overflow-hidden flex font-sans text-stone-600 p-3 gap-3">
      
      {/* --- 左侧：全屏地图 --- */}
      <div className="flex-[3] relative bg-white rounded-xl overflow-hidden shadow-lg border border-white">
         
         {/* 顶部资源条 */}
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur px-6 py-2 rounded-full shadow-xl border border-stone-100 flex gap-6 items-center">
            <ResourceItem label="Wood" value={globalResources.wood} color="text-amber-600" />
            <div className="w-px h-6 bg-stone-200"></div>
            <ResourceItem label="Stone" value={globalResources.stone} color="text-stone-500" />
            <div className="w-px h-6 bg-stone-200"></div>
            <ResourceItem label="Food" value={globalResources.food} color="text-emerald-600" />
            <div className="w-px h-6 bg-stone-200"></div>
            <ResourceItem label="Meds" value={globalResources.medicine} color="text-rose-500" />
         </div>

         {/* 左侧建造栏 */}
         <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
            {BUILD_OPTIONS.map(opt => (
                <button key={opt.type} onClick={() => handleBuild(opt.type)} className="group relative w-10 h-10 bg-white rounded-lg shadow-md border border-stone-200 hover:border-blue-400 hover:scale-110 transition-all flex items-center justify-center text-stone-400 hover:text-blue-500">
                    <Construction size={18} />
                    <div className="absolute left-full ml-2 bg-stone-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                        {opt.name} <span className="text-stone-400">({opt.cost})</span>
                    </div>
                </button>
            ))}
            <div className="h-px w-6 bg-stone-200 mx-auto my-1"></div>
            <button onClick={handleReset} className="w-10 h-10 bg-white text-red-400 border border-red-100 rounded-lg shadow hover:bg-red-50 hover:text-red-600 flex items-center justify-center">
                 <RefreshCw size={16} />
            </button>
         </div>

         <GameMap worldData={worldData} />
      </div>

      {/* --- 右侧：信息栏 --- */}
      <div className="flex-1 flex flex-col min-w-[320px] max-w-[400px] bg-white rounded-xl overflow-hidden shadow-lg border border-white">
        <div className="h-12 border-b border-stone-100 flex items-center px-4 justify-between bg-stone-50/50">
            <div className="flex gap-1 bg-stone-100 p-1 rounded-md">
                <button onClick={() => setSidebarTab('logs')} className={`px-3 py-1 text-[10px] font-bold rounded flex gap-1 items-center transition-all ${sidebarTab==='logs'?'bg-white shadow text-stone-800':'text-stone-400'}`}><Terminal size={12}/> LOGS</button>
                <button onClick={() => setSidebarTab('team')} className={`px-3 py-1 text-[10px] font-bold rounded flex gap-1 items-center transition-all ${sidebarTab==='team'?'bg-white shadow text-stone-800':'text-stone-400'}`}><Users size={12}/> UNITS</button>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400">
               NEXT TICK <span className="text-blue-500 font-bold">{nextRefresh}s</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white p-0 relative">
            {sidebarTab === 'logs' && (
                <div className="p-4 space-y-4">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`relative pl-4 border-l-2 ${i===0?'border-blue-500':'border-stone-100'} pb-1`}>
                            <div className="text-[9px] font-mono text-stone-300 mb-1 flex justify-between">
                                <span>#{String(logs.length - i).padStart(3,'0')}</span>
                                {i===0 && <span className="text-blue-500 font-bold animate-pulse">NEW</span>}
                            </div>
                            <p className={`text-xs leading-5 ${i===0?'text-stone-800 font-medium':'text-stone-400'}`}>{log}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'team' && (
                <div className="p-3 space-y-2">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg border border-stone-100 hover:border-blue-200 bg-stone-50/30 transition-colors">
                            <SymbolAvatar name={agent.name} job={agent.job} />
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-stone-700">{agent.name}</span>
                                    <span className="text-[9px] text-stone-400 uppercase bg-white px-1 rounded border border-stone-100">{agent.job}</span>
                                </div>
                                <div className="text-[10px] text-stone-400 truncate mt-1 flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${agent.actionLog ? 'bg-emerald-400 animate-pulse' : 'bg-stone-300'}`}></div>
                                    {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'') : 'Idle'}
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