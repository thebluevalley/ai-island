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

  const handleBuild = (type: string) => alert(`Construction: ${type}`);

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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f0f4f8] text-stone-400 gap-4 font-mono">
      <div className="w-12 h-12 border-4 border-stone-200 border-t-blue-400 rounded-full animate-spin"></div>
      <div className="text-xs tracking-widest">LOADING AI TOWN...</div>
    </div>
  );

  const { agents, globalResources, logs } = worldData;

  const ResourcePill = ({ label, value, color }: any) => (
    <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
       <span className="text-[10px] font-bold text-stone-400 uppercase">{label}</span>
       <span className={`text-xs font-bold font-mono ${color}`}>{value}</span>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#e8eef2] overflow-hidden flex font-sans text-stone-600 p-4 gap-4">
      
      {/* --- 左侧：游戏世界 (RPG Style) --- */}
      <div className="flex-[3] relative bg-white rounded-2xl overflow-hidden shadow-xl border-4 border-white">
         
         {/* 顶部状态栏 */}
         <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-start pointer-events-none">
             <div className="flex gap-2 pointer-events-auto">
                <ResourcePill label="Wood" value={globalResources.wood} color="text-amber-600" />
                <ResourcePill label="Food" value={globalResources.food} color="text-emerald-600" />
                <ResourcePill label="Meds" value={globalResources.medicine} color="text-rose-500" />
             </div>
             
             <div className="flex gap-2 pointer-events-auto">
                 {/* 修正点：这里原来写成了 BUILDINGS.map，现改为正确的 BUILD_OPTIONS.map */}
                 {BUILD_OPTIONS.map((opt:any) => (
                    <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-9 h-9 bg-white rounded-lg shadow-md border border-stone-200 flex items-center justify-center text-stone-400 hover:text-blue-500 hover:scale-110 transition-all">
                        <Construction size={16} />
                    </button>
                 ))}
                 <button onClick={handleReset} className="w-9 h-9 bg-red-50 text-red-400 border border-red-100 rounded-lg shadow-md flex items-center justify-center hover:bg-red-100 transition-all">
                     <RefreshCw size={16} />
                 </button>
             </div>
         </div>

         {/* 核心地图 */}
         <GameMap worldData={worldData} />
         
         {/* 底部水印 */}
         <div className="absolute bottom-3 left-4 text-[10px] font-bold text-stone-300 pointer-events-none tracking-widest">
            AI TOWN SIMULATION v1.0
         </div>
      </div>

      {/* --- 右侧：侧边栏 --- */}
      <div className="flex-1 flex flex-col min-w-[300px] max-w-[360px] bg-white rounded-2xl overflow-hidden shadow-xl border-4 border-white">
        
        {/* Tab 切换 */}
        <div className="h-14 border-b border-stone-100 flex items-center px-4 justify-between bg-stone-50/50">
            <div className="flex bg-stone-200/50 p-1 rounded-lg">
                <button onClick={() => setSidebarTab('logs')} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${sidebarTab==='logs'?'bg-white shadow-sm text-stone-800':'text-stone-400 hover:text-stone-500'}`}>LOGS</button>
                <button onClick={() => setSidebarTab('team')} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${sidebarTab==='team'?'bg-white shadow-sm text-stone-800':'text-stone-400 hover:text-stone-500'}`}>AGENTS</button>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[8px] font-bold text-stone-400">NEXT TICK</span>
                <span className="text-sm font-black text-blue-500 font-mono">{nextRefresh}s</span>
            </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto bg-stone-50/30 p-0 relative">
            {sidebarTab === 'logs' && (
                <div className="p-4 space-y-3">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`p-3 rounded-xl border ${i===0?'bg-white border-blue-200 shadow-sm':'bg-white/50 border-stone-100'} transition-all`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${i===0?'text-blue-500':'text-stone-300'}`}>Event #{String(logs.length - i).padStart(3,'0')}</span>
                                {i===0 && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>}
                            </div>
                            <p className={`text-[11px] leading-relaxed ${i===0?'text-stone-700':'text-stone-400'}`}>{log}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'team' && (
                <div className="p-4 space-y-3">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                                {agent.name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-xs font-bold text-stone-700">{agent.name}</span>
                                    <span className="text-[9px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{agent.job}</span>
                                </div>
                                <div className="text-[10px] text-stone-500 truncate">
                                    {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'') : 'Thinking...'}
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