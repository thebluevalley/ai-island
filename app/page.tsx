'use client';
import { useState, useEffect, useRef } from 'react';
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, Map as MapIcon, FileText, Users, Construction, RefreshCw, Box, Activity } from 'lucide-react';
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
  const [nextRefresh, setNextRefresh] = useState(45); // 改为 45 秒刷新一次
  const [sidebarTab, setSidebarTab] = useState<'logs' | 'team'>('logs'); // 侧边栏Tab

  // 引用日志容器以便自动滚动
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (loading || paused) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tick', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setWorldData(data.world);
        setNextRefresh(45); // 重置为 45 秒
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

  // 自动滚动日志
  useEffect(() => {
    if (sidebarTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [worldData, sidebarTab]);

  if (!worldData) return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-stone-50 text-stone-400 gap-6">
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

  // --- 悬浮资源栏 (在地图上方) ---
  const FloatingResources = () => (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border border-white/50 flex gap-6 items-center">
       <div className="flex flex-col items-center gap-1 min-w-[3rem]">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Wood</span>
          <span className="text-lg font-bold text-amber-600 leading-none">{globalResources.wood}</span>
       </div>
       <div className="w-px h-8 bg-stone-200"></div>
       <div className="flex flex-col items-center gap-1 min-w-[3rem]">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Stone</span>
          <span className="text-lg font-bold text-stone-600 leading-none">{globalResources.stone}</span>
       </div>
       <div className="w-px h-8 bg-stone-200"></div>
       <div className="flex flex-col items-center gap-1 min-w-[3rem]">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Food</span>
          <span className="text-lg font-bold text-emerald-600 leading-none">{globalResources.food}</span>
       </div>
       <div className="w-px h-8 bg-stone-200"></div>
       <div className="flex flex-col items-center gap-1 min-w-[3rem]">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Meds</span>
          <span className="text-lg font-bold text-rose-500 leading-none">{globalResources.medicine}</span>
       </div>
    </div>
  );

  // --- 悬浮建造栏 (在地图左侧) ---
  const FloatingBuildMenu = () => (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
        {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="group relative w-12 h-12 bg-white rounded-xl shadow-md border border-stone-200 hover:border-blue-400 hover:scale-110 transition-all flex items-center justify-center text-stone-400 hover:text-blue-500 hover:shadow-lg">
                <Construction size={20} />
                {/* Tooltip */}
                <div className="absolute left-full ml-3 bg-stone-800 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    <div className="font-bold mb-0.5">{opt.name}</div>
                    <div className="text-stone-400 text-[10px]">{opt.cost}</div>
                </div>
            </button>
        ))}
        <div className="h-px w-8 bg-stone-300 mx-auto my-2"></div>
        <button onClick={handleReset} className="group relative w-12 h-12 bg-white rounded-xl shadow-md border border-stone-200 hover:border-red-400 hover:bg-red-50 hover:scale-110 transition-all flex items-center justify-center text-stone-400 hover:text-red-500">
             <RefreshCw size={18} />
             <div className="absolute left-full ml-3 bg-red-600 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Reset World
            </div>
        </button>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-stone-200 overflow-hidden font-sans text-stone-800">
      
      {/* --- 左侧：大地图区域 (70%) --- */}
      <div className="flex-[7] relative flex flex-col min-w-0 bg-[#f0f2f5] m-4 mr-0 rounded-2xl shadow-xl overflow-hidden border border-white/50">
         <FloatingResources />
         <FloatingBuildMenu />
         
         <div className="flex-1 relative overflow-hidden">
            <GameMap worldData={worldData} />
         </div>
      </div>

      {/* --- 右侧：宽侧边栏 (30%) --- */}
      <div className="flex-[3] flex flex-col min-w-[350px] max-w-[500px] m-4 bg-white rounded-2xl shadow-xl overflow-hidden border border-white/50">
        
        {/* 侧边栏 Header & Tabs */}
        <div className="h-16 border-b border-stone-100 flex items-center px-6 justify-between shrink-0 bg-white/80 backdrop-blur">
            <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
                <button onClick={() => setSidebarTab('logs')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${sidebarTab==='logs' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}>
                    <FileText size={14}/> Logs
                </button>
                <button onClick={() => setSidebarTab('team')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${sidebarTab==='team' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Users size={14}/> Team
                </button>
            </div>
            
            {/* 倒计时圆环 */}
            <div className="relative w-8 h-8 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-stone-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path className="text-blue-500 transition-all duration-1000 ease-linear" strokeDasharray={`${((45-nextRefresh)/45)*100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
                <div className="absolute text-[8px] font-bold text-blue-500">{nextRefresh}</div>
            </div>
        </div>

        {/* 侧边栏内容区域 */}
        <div className="flex-1 overflow-y-auto bg-stone-50/30 relative">
            
            {/* 内容 1: 日志 */}
            {sidebarTab === 'logs' && (
                <div className="p-6 space-y-6">
                    {logs.slice().reverse().map((log: string, i: number) => {
                        const isLatest = i === 0;
                        return (
                            <div key={i} className={`relative pl-6 border-l-2 ${isLatest ? 'border-blue-400' : 'border-stone-200'} pb-2`}>
                                <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${isLatest ? 'bg-blue-400 ring-4 ring-blue-100' : 'bg-stone-200'}`}></div>
                                <div className="text-[10px] font-mono text-stone-400 mb-1 uppercase tracking-wider flex justify-between">
                                    <span>Log #{String(logs.length - i).padStart(3,'0')}</span>
                                    {isLatest && <span className="text-blue-500 font-bold">LIVE</span>}
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

            {/* 内容 2: 团队名单 */}
            {sidebarTab === 'team' && (
                <div className="p-4 space-y-3">
                    {/* Agents */}
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2">Agents</div>
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm flex gap-3 hover:border-blue-200 transition-colors">
                            <SymbolAvatar name={agent.name} job={agent.job} />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-bold text-sm text-stone-700">{agent.name}</span>
                                    <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500">{agent.job}</span>
                                </div>
                                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden w-full mb-1.5">
                                    <div className={`h-full ${agent.hp>50?'bg-emerald-400':'bg-red-400'}`} style={{width: `${agent.hp}%`}}></div>
                                </div>
                                <div className="text-[10px] text-stone-400 truncate flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${agent.actionLog ? 'bg-emerald-400 animate-pulse' : 'bg-stone-300'}`}></div>
                                    {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'') : 'Idle'}
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {/* NPCs */}
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2 mt-6">Civilian Workers</div>
                    {npcs.map((npc: NPC) => (
                        <div key={npc.id} className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm flex justify-between items-center opacity-80">
                            <div>
                                <div className="font-bold text-xs text-stone-600">{npc.name}</div>
                                <div className="text-[10px] text-stone-400 uppercase">{npc.role}</div>
                            </div>
                            <div className="text-[10px] font-mono bg-stone-50 text-stone-500 px-2 py-1 rounded border border-stone-100">{npc.currentTask}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}