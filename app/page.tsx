'use client';
import { useState, useEffect, useRef } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, FileText, Users, Construction, RefreshCw, Activity, Map as MapIcon } from 'lucide-react';
import GameMap from './components/GameMap';

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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f0f2f5] text-stone-500 gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-stone-200 border-t-emerald-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
           <Activity size={24} />
        </div>
      </div>
      <div className="font-mono text-xs tracking-widest text-stone-400 uppercase">System Initializing...</div>
    </div>
  );

  const { agents, npcs, globalResources, logs } = worldData;

  // --- 悬浮资源栏 ---
  const FloatingResources = () => (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur text-stone-700 px-5 py-2.5 rounded-full shadow-lg border border-white/50 flex gap-6 items-center">
       {Object.entries(globalResources).map(([key, val]: any) => (
         <div key={key} className="flex flex-col items-center gap-0.5 min-w-[2.5rem]">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">{key.slice(0,4)}</span>
            <span className={`text-sm font-bold leading-none ${key==='wood'?'text-amber-600':key==='food'?'text-emerald-600':key==='stone'?'text-stone-500':'text-rose-500'}`}>{val}</span>
         </div>
       ))}
    </div>
  );

  const FloatingBuildMenu = () => (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
        {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="group relative w-12 h-12 bg-white rounded-xl shadow-md border border-stone-200 hover:border-blue-400 hover:scale-110 transition-all flex items-center justify-center text-stone-400 hover:text-blue-500">
                <Construction size={20} />
                <div className="absolute left-full ml-3 bg-stone-800 text-white text-xs py-2 px-3 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    <div className="font-bold mb-0.5 text-blue-300">{opt.name}</div>
                    <div className="text-stone-400 text-[10px]">{opt.cost}</div>
                </div>
            </button>
        ))}
        <div className="h-px w-6 bg-stone-300 mx-auto"></div>
        <button onClick={handleReset} className="w-12 h-12 bg-white border border-red-200 text-red-400 rounded-xl shadow-md hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors">
             <RefreshCw size={20} />
        </button>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#e5e7eb] overflow-hidden flex font-sans text-stone-700 p-4 gap-4">
      
      {/* --- 左侧：游戏画面 (Flex-1 自适应) --- */}
      <div className="flex-[3] relative bg-stone-100 rounded-2xl overflow-hidden shadow-xl border border-white">
         <FloatingResources />
         <FloatingBuildMenu />
         <div className="w-full h-full">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* --- 右侧：日志 (固定宽) --- */}
      <div className="flex-1 flex flex-col min-w-[320px] max-w-[420px] bg-white rounded-2xl overflow-hidden shadow-xl border border-white">
        
        {/* Header */}
        <div className="h-14 border-b border-stone-100 flex items-center px-5 justify-between shrink-0 bg-white">
            <div className="flex gap-2 bg-stone-100 p-1 rounded-lg">
                <button onClick={() => setSidebarTab('logs')} className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${sidebarTab==='logs' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}>
                    <FileText size={14}/> 日志
                </button>
                <button onClick={() => setSidebarTab('team')} className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${sidebarTab==='team' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Users size={14}/> 成员
                </button>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="text-[10px] font-mono text-stone-400 uppercase">Next Tick</div>
                <div className="w-10 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{width: `${((45-nextRefresh)/45)*100}%`}}></div>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#fafafa] relative">
            {sidebarTab === 'logs' && (
                <div className="p-5 space-y-5">
                    {logs.slice().reverse().map((log: string, i: number) => {
                        const isLatest = i === 0;
                        return (
                            <div key={i} className={`relative pl-4 border-l-2 ${isLatest ? 'border-blue-500' : 'border-stone-200'} pb-1`}>
                                <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${isLatest?'bg-blue-500 ring-4 ring-blue-100':'bg-stone-300'}`}></div>
                                <div className="text-[10px] font-mono text-stone-400 mb-1 flex justify-between">
                                    <span>#{String(logs.length - i).padStart(3,'0')}</span>
                                    {isLatest && <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded">NEW</span>}
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
                <div className="p-4 space-y-3">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm flex gap-3 items-center hover:border-blue-200 transition-colors">
                            <SymbolAvatar name={agent.name} job={agent.job} />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-bold text-sm text-stone-700">{agent.name}</span>
                                    <span className="text-[10px] bg-stone-50 px-1.5 py-0.5 rounded text-stone-400">{agent.job}</span>
                                </div>
                                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden w-full mb-1">
                                    <div className={`h-full ${agent.hp>50?'bg-emerald-400':'bg-red-400'}`} style={{width: `${agent.hp}%`}}></div>
                                </div>
                                <div className="text-[10px] text-stone-400 truncate flex items-center gap-1">
                                   {agent.actionLog ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> : <div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div>}
                                   {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'') : '空闲中'}
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