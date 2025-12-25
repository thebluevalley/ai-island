'use client';
import { useState, useEffect } from 'react';

// --- 类型定义 ---
type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; };
type NPC = { id: string; name: string; role: string; currentTask: string; };
type Building = { type: string; name: string; status: string; progress: number; maxProgress: number; };
type Resources = { wood: number; stone: number; food: number; medicine: number; };

// --- 静态配置 ---
const BUILD_OPTIONS = [
  { type: "House", name: "居住屋", cost: "木50" },
  { type: "Warehouse", name: "大仓库", cost: "木80 石20" },
  { type: "Clinic", name: "诊所", cost: "木100 石50" },
  { type: "Kitchen", name: "野战厨房", cost: "木60 石30" },
  { type: "Tower", name: "瞭望塔", cost: "木120 石80" }
];

// 战术头像组件
const TacticalAvatar = ({ name, job }: { name: string, job: string }) => {
  const colors = ['bg-blue-600','bg-emerald-600','bg-amber-600','bg-rose-600','bg-violet-600'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-10 h-10 ${color} rounded flex flex-col items-center justify-center text-white shadow-sm shrink-0`}>
      <span className="font-bold text-sm leading-none mt-0.5">{name[0]}</span>
      <span className="text-[8px] uppercase opacity-80 scale-75">{job.slice(0,2)}</span>
    </div>
  );
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'ai' | 'npc'>('ai');
  const [paused, setPaused] = useState(false);

  const fetchData = async () => {
    if (loading || paused) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tick', { method: 'POST' });
      const data = await res.json();
      if (data.success) setWorldData(data.world);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ 警告：文明重启？")) return;
    await fetch('/api/reset', { method: 'POST' });
    window.location.reload();
  };

  // 手动触发建造（未实装完全扣费逻辑，仅为演示UI交互，实际应调用API）
  const handleBuild = (type: string) => {
    alert(`已发布【${type}】建造蓝图！NPC将开始搬运资源。`);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { const t = setInterval(() => { if(!paused) fetchData(); }, 12000); return () => clearInterval(t); }, [paused]);

  if (!worldData) return <div className="h-screen flex items-center justify-center text-stone-500">LOADING WORLD...</div>;

  const { agents, npcs, buildings, globalResources, logs, envDescription, weather } = worldData;

  return (
    <div className="flex h-screen bg-[#e5e5e5] text-stone-800 font-sans overflow-hidden">
      
      {/* --- 左栏：控制与资源 (30%) --- */}
      <aside className="w-80 bg-[#f5f5f5] border-r border-stone-300 flex flex-col">
        {/* 资源面板 */}
        <div className="p-4 bg-white border-b border-stone-200">
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Resources</h2>
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-stone-50 p-2 rounded border border-stone-100 flex justify-between">
               <span className="text-sm">🪵 木材</span> <span className="font-bold">{globalResources.wood}</span>
             </div>
             <div className="bg-stone-50 p-2 rounded border border-stone-100 flex justify-between">
               <span className="text-sm">🪨 石料</span> <span className="font-bold">{globalResources.stone}</span>
             </div>
             <div className="bg-stone-50 p-2 rounded border border-stone-100 flex justify-between">
               <span className="text-sm">🍞 食物</span> <span className="font-bold">{globalResources.food}</span>
             </div>
             <div className="bg-stone-50 p-2 rounded border border-stone-100 flex justify-between">
               <span className="text-sm">💊 药品</span> <span className="font-bold">{globalResources.medicine}</span>
             </div>
          </div>
        </div>

        {/* 建设菜单 */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Construction</h2>
          <div className="space-y-2">
            {BUILD_OPTIONS.map(opt => (
              <button key={opt.type} onClick={() => handleBuild(opt.type)} className="w-full bg-white p-3 rounded border border-stone-300 shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left group">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-stone-700 group-hover:text-blue-600">{opt.name}</span>
                  <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500">T1</span>
                </div>
                <div className="text-xs text-stone-400 font-mono">Cost: {opt.cost}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* 控制按钮 */}
        <div className="p-4 border-t border-stone-200 bg-stone-100">
          <button onClick={handleReset} className="w-full py-2 bg-red-100 text-red-600 rounded border border-red-200 font-bold hover:bg-red-200 transition-colors">
            🔥 REBOOT CIVILIZATION
          </button>
        </div>
      </aside>

      {/* --- 中栏：地图与日志 (40%) --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#e5e5e5]">
        {/* 顶部环境条 */}
        <div className="h-14 bg-stone-800 text-stone-200 flex items-center px-6 justify-between shrink-0 shadow-md z-10">
          <div className="font-bold tracking-widest uppercase">AI Island Sim v3.5</div>
          <div className="flex gap-4 text-xs font-mono">
            <span>DAY {worldData.turn}</span>
            <span className="text-amber-400">{weather}</span>
            <span>{loading ? "SYNCING..." : "LIVE"}</span>
          </div>
        </div>

        {/* 视觉化地图 (九宫格) */}
        <div className="p-6 bg-stone-200 border-b border-stone-300">
           <div className="grid grid-cols-3 gap-2 aspect-[3/1] max-h-40">
              {['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'].map((loc, i) => {
                 const x = Math.floor(i / 3);
                 const y = i % 3;
                 // 查找该格子的建筑
                 const b = buildings.find((b: Building) => b.x === x && b.y === y);
                 // 查找该格子的人数
                 const count = agents.filter((a: Agent) => a.locationName?.includes(loc)).length;
                 
                 return (
                   <div key={i} className="bg-stone-300/50 rounded border border-stone-400/30 flex flex-col items-center justify-center relative hover:bg-white/50 transition-colors">
                      <span className="text-xs font-bold text-stone-600 z-10">{loc}</span>
                      {b && (
                        <div className="absolute bottom-1 w-full px-2">
                           <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
                              <div className={`h-full ${b.status==='active'?'bg-emerald-500':'bg-amber-400'}`} style={{width: `${(b.progress/b.maxProgress)*100}%`}}></div>
                           </div>
                        </div>
                      )}
                      {count > 0 && <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">{count}</div>}
                   </div>
                 )
              })}
           </div>
        </div>

        {/* 日志流 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
           {logs.slice().reverse().map((log: string, i: number) => (
             <div key={i} className={`p-4 rounded-lg border ${i===0 ? 'bg-white shadow-md border-stone-300' : 'bg-[#efefef] border-stone-200 opacity-80'}`}>
                <p className="text-sm leading-7 text-stone-800 font-serif text-justify">{log}</p>
             </div>
           ))}
        </div>
      </main>

      {/* --- 右栏：名册 (30%) --- */}
      <aside className="w-80 bg-white border-l border-stone-300 flex flex-col shadow-xl z-20">
        <div className="flex border-b border-stone-200">
           <button onClick={()=>setTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest ${tab==='ai'?'bg-white text-blue-600 border-b-2 border-blue-600':'bg-stone-50 text-stone-400'}`}>
             AI Elites ({agents.length})
           </button>
           <button onClick={()=>setTab('npc')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest ${tab==='npc'?'bg-white text-emerald-600 border-b-2 border-emerald-600':'bg-stone-50 text-stone-400'}`}>
             Drones ({npcs.length})
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 bg-stone-50 space-y-2">
           {tab === 'ai' ? agents.map((agent: Agent) => (
             <div key={agent.id} className="bg-white p-3 rounded border border-stone-200 shadow-sm flex gap-3">
                <TacticalAvatar name={agent.name} job={agent.job} />
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-baseline mb-1">
                      <span className="font-bold text-sm text-stone-800">{agent.name}</span>
                      <span className="text-[10px] bg-stone-100 px-1 rounded text-stone-500">{agent.job}</span>
                   </div>
                   <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden w-full mb-2">
                      <div className={`h-full ${agent.hp>50?'bg-emerald-500':'bg-red-500'}`} style={{width: `${agent.hp}%`}}></div>
                   </div>
                   <div className="text-[10px] text-stone-500 truncate italic">“{agent.actionLog}”</div>
                </div>
             </div>
           )) : npcs.map((npc: NPC) => (
             <div key={npc.id} className="bg-white p-3 rounded border border-stone-200 flex justify-between items-center">
                <div>
                   <div className="font-bold text-xs text-stone-700">{npc.name}</div>
                   <div className="text-[10px] text-stone-400 uppercase">{npc.role}</div>
                </div>
                <div className="text-[10px] font-mono bg-stone-100 px-2 py-1 rounded text-emerald-600">
                   {npc.currentTask}
                </div>
             </div>
           ))}
        </div>
      </aside>

    </div>
  );
}
