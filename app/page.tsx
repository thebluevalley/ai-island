'use client';
import { useState, useEffect, useRef } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, FileText, Users, Construction, RefreshCw, Activity } from 'lucide-react';
import GameMap from './components/GameMap';

// --- 类型定义 ---
type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };
type NPC = { id: string; name: string; role: string; currentTask: string; };
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
    let color = "bg-stone-300";
    if (job.includes("消防") || job.includes("保安")) { Icon = Shield; color = "bg-blue-400"; }
    else if (job.includes("医生") || job.includes("护士")) { Icon = Stethoscope; color = "bg-rose-400"; }
    else if (job.includes("建筑") || job.includes("工")) { Icon = Hammer; color = "bg-amber-400"; }
    else if (job.includes("厨")) { Icon = Utensils; color = "bg-orange-400"; }
    else if (job.includes("学") || job.includes("记录")) { Icon = Book; color = "bg-indigo-400"; }
    else if (job.includes("商")) { Icon = Coins; color = "bg-emerald-500"; }
    else if (job.includes("斥候")) { Icon = Search; color = "bg-violet-400"; }
    else if (job.includes("占卜")) { Icon = Zap; color = "bg-purple-400"; }
    return (
      <div title={name} className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center text-white shadow-sm shrink-0`}>
        <Icon size={16} strokeWidth={2.5} />
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
    if (!confirm("⚠️ 确定要重置世界吗？所有进度将丢失。")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => {
    alert(`指令已发送：建造 ${type}`);
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
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-stone-50 text-stone-400 gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-stone-200 border-t-blue-400 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <Activity size={24} className="text-blue-400 animate-pulse"/>
        </div>
      </div>
      <div className="font-mono text-xs tracking-[0.2em] text-stone-500 uppercase">System Initializing</div>
    </div>
  );

  const { agents, npcs, globalResources, logs } = worldData;

  // --- 悬浮 UI ---
  const FloatingResources = () => (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur-md px-6 py-2 rounded-full shadow-lg border border-white/50 flex gap-6 items-center">
       <div className="flex flex-col items-center gap-0.5 min-w-[3rem]">
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Wood</span>
          <span className="text-sm font-bold text-amber-600 leading-none">{globalResources.wood}</span>
       </div>
       <div className="w-px h-6 bg-stone-200"></div>
       <div className="flex flex-col items-center gap-0.5 min-w-[3rem]">
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Stone</span>
          <span className="text-sm font-bold text-stone-600 leading-none">{globalResources.stone}</span>
       </div>
       <div className="w-px h-6 bg-stone-200"></div>
       <div className="flex flex-col items-center gap-0.5 min-w-[3rem]">
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Food</span>
          <span className="text-sm font-bold text-emerald-600 leading-none">{globalResources.food}</span>
       </div>
       <div className="w-px h-6 bg-stone-200"></div>
       <div className="flex flex-col items-center gap-0.5 min-w-[3rem]">
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Meds</span>
          <span className="text-sm font-bold text-rose-500 leading-none">{globalResources.medicine}</span>
       </div>
    </div>
  );

  const FloatingBuildMenu = () => (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
        {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="group relative w-10 h-10 bg-white rounded-xl shadow-md border border-stone-200 hover:border-blue-400 hover:scale-110 transition-all flex items-center justify-center text-stone-400 hover:text-blue-500 hover:shadow-lg">
                <Construction size={18} />
                <div className="absolute left-full ml-3 bg-stone-800 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    <div className="font-bold mb-0.5">{opt.name}</div>
                    <div className="text-stone-400 text-[10px]">{opt.cost}</div>
                </div>
            </button>
        ))}
        <div className="h-px w-6 bg-stone-300 mx-auto my-2"></div>
        <button onClick={handleReset} className="group relative w-10 h-10 bg-white rounded-xl shadow-md border border-stone-200 hover:border-red-400 hover:bg-red-50 hover:scale-110 transition-all flex items-center justify-center text-stone-400 hover:text-red-500">
             <RefreshCw size={16} />
        </button>
    </div>
  );

  return (
    // 使用 h-screen w-screen overflow-hidden 锁死整个页面，防止出现滚动条
    <div className="h-screen w-screen bg-stone-100 overflow-hidden flex font-sans text-stone-800 p-4 gap-4">
      
      {/* --- 左侧：地图区域 (70%) --- */}
      {/* flex-1 确保它占满剩余空间，relative 用于定位悬浮UI */}
      <div className="flex-[7] relative bg-[#f0f2f5] rounded-2xl shadow-xl overflow-hidden border border-white/50">
         <FloatingResources />
         <FloatingBuildMenu />
         <div className="w-full h-full">
            <GameMap worldData={worldData} />
         </div>
      </div>

      {/* --- 右侧：日志区域 (30%) --- */}
      <div className="flex-[3] flex flex-col min-w-[320px] max-w-[450px] bg-white rounded-2xl shadow-xl overflow-hidden border border-white/50">
        
        {/* Header */}
        <div className="h-14 border-b border-stone-100 flex items-center px-4 justify-between shrink-0 bg-white/80 backdrop-blur">
            <div className="flex gap-1 bg-stone-50 p-1 rounded-lg">
                <button onClick={() => setSidebarTab('logs')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${sidebarTab==='logs' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}>
                    <FileText size={12}/> Logs
                </button>
                <button onClick={() => setSidebarTab('team')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${sidebarTab==='team' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Users size={12}/> Team
                </button>
            </div>
            
            <div className="relative w-6 h-6 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-stone-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path className="text-blue-500 transition-all duration-1000 ease-linear" strokeDasharray={`${((45-nextRefresh)/45)*100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
            </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-stone-50/30">
            {sidebarTab === 'logs' && (
                <div className="p-4 space-y-4">
                    {logs.slice().reverse().map((log: string, i: number) => {
                        const isLatest = i === 0;
                        return (
                            <div key={i} className={`relative pl-4 border-l-2 ${isLatest ? 'border-blue-400' : 'border-stone-200'} pb-2`}>
                                <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${isLatest ? 'bg-blue-400 ring-4 ring-blue-50' : 'bg-stone-200'}`}></div>
                                <div className="text-[10px] font-mono text-stone-400 mb-1 uppercase tracking-wider flex justify-between">
                                    <span>#{String(logs.length - i).padStart(3,'0')}</span>
                                    {isLatest && <span className="text-blue-500 font-bold">NEW</span>}
                                </div>
                                <p className={`text-sm leading-relaxed ${isLatest ? 'text-stone-800 font-medium' : 'text-stone-500'}`}>
                                    {log}
                                </p>
                            </div>
                        )
                    })}
                    <div ref={logsEndRef} />
                </div>
            )}

            {sidebarTab === 'team' && (
                <div className="p-4 space-y-2">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">Agents</div>
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-white p-2 rounded-xl border border-stone-100 shadow-sm flex gap-3 hover:border-blue-200 transition-colors">
                            <SymbolAvatar name={agent.name} job={agent.job} />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <span className="font-bold text-sm text-stone-700">{agent.name}</span>
                                    <span className="text-[9px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500">{agent.job}</span>
                                </div>
                                <div className="h-1 bg-stone-100 rounded-full overflow-hidden w-full mb-1">
                                    <div className={`h-full ${agent.hp>50?'bg-emerald-400':'bg-red-400'}`} style={{width: `${agent.hp}%`}}></div>
                                </div>
                                <div className="text-[10px] text-stone-400 truncate">
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