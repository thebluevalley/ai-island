'use client';
import { useState, useEffect, useRef } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, FileText, Users, Construction, RefreshCw, Activity, Terminal, MapPin } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };
type Resources = { wood: number; stone: number; food: number; medicine: number; };

const BUILD_OPTIONS = [
  { type: "House", name: "House", cost: "50 W" },
  { type: "Warehouse", name: "Store", cost: "80 W" },
  { type: "Clinic", name: "Clinic", cost: "100 W" },
  { type: "Kitchen", name: "Kitchen", cost: "60 W" },
  { type: "Tower", name: "Tower", cost: "120 W" }
];

const SymbolAvatar = ({ name, job }: { name?: string, job: string }) => {
    let color = "bg-stone-400";
    if (job.includes("建筑")) color = "bg-amber-500";
    else if (job.includes("医")) color = "bg-rose-500";
    else if (job.includes("领袖")) color = "bg-blue-500";
    else color = "bg-emerald-500";
    
    return (
      <div className={`w-6 h-6 ${color} rounded-full flex items-center justify-center text-white text-[8px] font-bold shadow-sm shrink-0 border border-white`}></div>
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
    if (!confirm("Reset?")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => alert(`Building: ${type}`);

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
      <Activity className="animate-spin text-blue-400" size={24} />
      <div className="text-[10px] font-mono tracking-widest uppercase">Initializing...</div>
    </div>
  );

  const { agents, globalResources, logs } = worldData;

  const ResourceItem = ({ label, value, color }: any) => (
    <div className="flex flex-col items-center min-w-[2.5rem]">
       <span className="text-[8px] font-bold text-stone-400 uppercase">{label}</span>
       <span className={`text-xs font-bold font-mono ${color}`}>{value}</span>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#f3f4f6] overflow-hidden flex font-sans text-stone-600 p-3 gap-3">
      
      {/* 左侧：地图 */}
      <div className="flex-[3] relative bg-white rounded-lg overflow-hidden shadow-sm border border-stone-200">
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur px-5 py-1.5 rounded-full shadow-sm border border-stone-100 flex gap-4 items-center">
            <ResourceItem label="Wood" value={globalResources.wood} color="text-amber-600" />
            <div className="w-px h-4 bg-stone-200"></div>
            <ResourceItem label="Food" value={globalResources.food} color="text-emerald-600" />
            <div className="w-px h-4 bg-stone-200"></div>
            <ResourceItem label="Meds" value={globalResources.medicine} color="text-rose-500" />
         </div>

         <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
            {BUILD_OPTIONS.map(opt => (
                <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-8 h-8 bg-white rounded shadow-sm border border-stone-200 hover:border-blue-400 hover:scale-105 transition-all flex items-center justify-center text-stone-400 hover:text-blue-500">
                    <Construction size={14} />
                </button>
            ))}
            <div className="h-px w-4 bg-stone-200 mx-auto"></div>
            <button onClick={handleReset} className="w-8 h-8 bg-white text-red-400 border border-red-100 rounded shadow-sm hover:bg-red-50 flex items-center justify-center">
                 <RefreshCw size={14} />
            </button>
         </div>

         <GameMap worldData={worldData} />
      </div>

      {/* 右侧：面板 */}
      <div className="flex-1 flex flex-col min-w-[280px] max-w-[360px] bg-white rounded-lg overflow-hidden shadow-sm border border-stone-200">
        <div className="h-10 border-b border-stone-100 flex items-center px-3 justify-between bg-stone-50/30">
            <div className="flex gap-1 bg-stone-100 p-0.5 rounded">
                <button onClick={() => setSidebarTab('logs')} className={`px-3 py-0.5 text-[9px] font-bold rounded transition-all ${sidebarTab==='logs'?'bg-white shadow-sm text-stone-800':'text-stone-400'}`}>LOGS</button>
                <button onClick={() => setSidebarTab('team')} className={`px-3 py-0.5 text-[9px] font-bold rounded transition-all ${sidebarTab==='team'?'bg-white shadow-sm text-stone-800':'text-stone-400'}`}>TEAM</button>
            </div>
            <div className="text-[9px] font-mono text-stone-400">
               <span className="text-blue-500 font-bold">{nextRefresh}s</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white p-0 relative">
            {sidebarTab === 'logs' && (
                <div className="p-3 space-y-3">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`relative pl-3 border-l-2 ${i===0?'border-blue-500':'border-stone-100'} pb-0.5`}>
                            <div className="text-[8px] font-mono text-stone-300 mb-0.5">#{String(logs.length - i).padStart(3,'0')}</div>
                            <p className={`text-[10px] leading-relaxed ${i===0?'text-stone-800':'text-stone-400'}`}>{log}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'team' && (
                <div className="p-2 space-y-2">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="flex items-center gap-2 p-2 rounded border border-stone-100 bg-stone-50/50">
                            <SymbolAvatar name={agent.name} job={agent.job} />
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[11px] font-bold text-stone-700">{agent.name}</span>
                                    <span className="text-[8px] text-stone-400 uppercase">{agent.job}</span>
                                </div>
                                <div className="text-[9px] text-stone-400 truncate mt-0.5">
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