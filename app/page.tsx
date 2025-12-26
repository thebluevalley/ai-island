'use client';
import { useState, useEffect } from 'react';
// 引入图标
import { Hammer, Shield, Stethoscope, Book, Coins, Utensils, Search, Zap, Map as MapIcon, FileText, Users, Construction, RefreshCw } from 'lucide-react';
// 引入我们刚写的地图组件
import FlatMap from './components/FlatMap';

// --- 类型定义 ---
type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Building = { type: string; name: string; status: string; progress: number; maxProgress: number; x: number; y: number; desc?: string; };

// --- 静态配置 ---
const BUILD_OPTIONS = [
  { type: "House", name: "居住屋", cost: "木50" },
  { type: "Warehouse", name: "大仓库", cost: "木80 石20" },
  { type: "Clinic", name: "诊所", cost: "木100 石50" },
  { type: "Kitchen", name: "厨房", cost: "木60 石30" },
  { type: "Tower", name: "瞭望塔", cost: "木120 石80" }
];

// --- 头像组件 (RosterPanel 使用) ---
const SymbolAvatar = ({ name, job }: { name?: string, job: string }) => {
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
    <div title={name} className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white shadow-sm shrink-0 border border-white/20`}>
      <Icon size={20} strokeWidth={2.5} />
    </div>
  );
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(20); 
  const [rightTab, setRightTab] = useState<'ai' | 'npc'>('ai');
  const [mobileView, setMobileView] = useState<'logs' | 'map' | 'control' | 'roster'>('map'); // 默认看地图

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
    if (!confirm("⚠️ 警告：系统将完全重置，生成新的岛屿和居民。是否确认？")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  const handleBuild = (type: string) => {
    alert(`指令已下达：建造【${type}】\n资源充足时，议会或NPC将自动响应。`);
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
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#e5e5e5] text-stone-500 gap-4">
      <div className="w-8 h-8 border-4 border-stone-300 border-t-stone-600 rounded-full animate-spin"></div>
      <div className="font-mono text-xs tracking-widest">INITIALIZING MATRIX...</div>
    </div>
  );

  const { agents, npcs, buildings, globalResources, logs } = worldData;

  // --- 子组件定义 ---
  const ControlPanel = () => (
    <div className="flex flex-col h-full bg-[#f8f8f8]">
      <div className="p-5 bg-white border-b border-gray-200">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Storage</h2>
        <div className="grid grid-cols-2 gap-3">
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-md border border-stone-100"><span className="text-stone-500">木材</span> <span className="font-bold text-stone-800">{globalResources.wood}</span></div>
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-md border border-stone-100"><span className="text-stone-500">石料</span> <span className="font-bold text-stone-800">{globalResources.stone}</span></div>
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-md border border-stone-100"><span className="text-stone-500">食物</span> <span className="font-bold text-stone-800">{globalResources.food}</span></div>
           <div className="flex justify-between text-xs p-2.5 bg-stone-50 rounded-md border border-stone-100"><span className="text-stone-500">药品</span> <span className="font-bold text-stone-800">{globalResources.medicine}</span></div>
        </div>
      </div>
      <div className="flex-1 p-5 overflow-y-auto bg-[#fafaf9]">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Blueprints</h2>
        <div className="space-y-3">
          {BUILD_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-full bg-white p-3 rounded-lg border border-gray-200 shadow-sm active:scale-95 transition-all text-left flex justify-between items-center group hover:border-blue-400">
              <div>
                <div className="font-bold text-gray-700 text-sm group-hover:text-blue-600">{opt.name}</div>
                <div className="text-[10px] text-gray-400 font-mono mt-1">{opt.cost}</div>
              </div>
              <Construction size={18} className="text-gray-300 group-hover:text-blue-500" />
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 border-t border-gray-200 bg-gray-50 mt-auto">
        <button onClick={handleReset} className="w-full py-3 bg-white text-red-500 rounded border border-red-100 font-bold hover:bg-red-50 active:bg-red-100 text-xs tracking-wider flex items-center justify-center gap-2 transition-colors">
          <RefreshCw size={14} /> REBOOT WORLD
        </button>
      </div>
    </div>
  );

  const LogPanel = () => (
    <div className="flex flex-col h-full bg-[#f0f0f0]">
      <div className="h-10 bg-white border-b border-gray-200 flex items-center px-4 justify-between shrink-0 shadow-sm z-10">
         <span className="font-bold text-xs text-gray-700 uppercase tracking-wide">Narrative Log</span>
         <span className="text-[10px] font-mono text-gray-400">TURN {worldData.turn}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
         {logs.slice().reverse().map((log: string, i: number) => (
           <div key={i} className={`p-5 rounded-xl border leading-relaxed ${i===0 ? 'bg-white shadow-md border-blue-200' : 'bg-[#f7f7f5] border-transparent text-gray-500'}`}>
              <div className="flex justify-between items-start mb-2">
                 <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Log entry #{String(logs.length - i).padStart(4,'0')}</span>
                 {i===0 && <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">LATEST</span>}
              </div>
              <p className="text-sm text-gray-800 font-serif text-justify break-all whitespace-pre-wrap">{log}</p>
           </div>
         ))}
      </div>
    </div>
  );

  const RosterPanel = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-gray-200 shrink-0">
         <button onClick={()=>setRightTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide ${rightTab==='ai'?'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50':'text-gray-400 hover:bg-gray-50'}`}>Agents</button>
         <button onClick={()=>setRightTab('npc')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide ${rightTab==='npc'?'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50':'text-gray-400 hover:bg-gray-50'}`}>Workers</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
         {rightTab === 'ai' ? agents.map((agent: Agent) => (
           <div key={agent.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex gap-3 group hover:border-blue-300 transition-colors">
              <SymbolAvatar name={agent.name} job={agent.job} />
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-sm text-gray-800">{agent.name}</span>
                    <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{agent.job}</span>
                 </div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full mb-1.5">
                    <div className={`h-full ${agent.hp>50?'bg-emerald-500':'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                 </div>
                 <div className="text-[10px] text-gray-400 truncate font-medium">
                   {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'') : 'Standby'}
                 </div>
              </div>
           </div>
         )) : npcs.map((npc: NPC) => (
           <div key={npc.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
              <div>
                 <div className="font-bold text-xs text-gray-700">{npc.name}</div>
                 <div className="text-[10px] text-gray-400 uppercase">{npc.role}</div>
              </div>
              <div className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">{npc.currentTask}</div>
           </div>
         ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-[#e5e5e5] text-stone-800 font-sans overflow-hidden">
      
      {/* 桌面端布局 (Web优先体验) */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* 左侧控制栏 */}
        <aside className="w-64 border-r border-gray-300 z-10 shadow-lg"><ControlPanel /></aside>
        
        {/* 中间主区域 */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#f0f0f0] z-0">
           {/* 地图区域：给予足够高度 */}
           <div className="h-[600px] border-b border-gray-300 relative bg-white shadow-sm z-10">
              <FlatMap worldData={worldData} />
           </div>
           {/* 日志区域 */}
           <div className="flex-1 relative min-h-0"><LogPanel /></div>
        </main>
        
        {/* 右侧人员栏 */}
        <aside className="w-72 border-l border-gray-300 z-10 shadow-lg"><RosterPanel /></aside>
      </div>

      {/* 移动端布局 */}
      <div className="md:hidden flex-1 overflow-hidden relative bg-[#f0f0f0]">
        {mobileView === 'logs' && <LogPanel />}
        {mobileView === 'map' && <FlatMap worldData={worldData} />}
        {mobileView === 'control' && <ControlPanel />}
        {mobileView === 'roster' && <RosterPanel />}
      </div>

      {/* 移动端底部导航 */}
      <nav className="md:hidden h-16 bg-white border-t border-gray-200 flex justify-around items-center shrink-0 z-50 pb-safe shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] relative">
        {/* 倒计时进度条 */}
        <div className="absolute top-0 left-0 h-0.5 bg-blue-500 transition-all duration-1000 ease-linear" style={{width: `${((20-nextRefresh)/20)*100}%`}}></div>
        
        <button onClick={() => setMobileView('logs')} className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${mobileView==='logs'?'text-blue-600':'text-gray-400'}`}>
          <FileText size={20} />
          <span className="text-[10px] font-bold mt-1">LOGS</span>
        </button>
        <button onClick={() => setMobileView('map')} className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${mobileView==='map'?'text-blue-600':'text-gray-400'}`}>
          <MapIcon size={20} />
          <span className="text-[10px] font-bold mt-1">MAP</span>
        </button>
        <button onClick={() => setMobileView('control')} className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${mobileView==='control'?'text-blue-600':'text-gray-400'}`}>
          <Construction size={20} />
          <span className="text-[10px] font-bold mt-1">BUILD</span>
        </button>
        <button onClick={() => setMobileView('roster')} className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${mobileView==='roster'?'text-blue-600':'text-gray-400'}`}>
          <Users size={20} />
          <span className="text-[10px] font-bold mt-1">TEAM</span>
        </button>
      </nav>

    </div>
  );
}