'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward, Terminal, Users, Map as MapIcon, Box } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

const RESOURCES = [
  { name: 'Wood', value: 320, color: 'text-amber-400' },
  { name: 'Stone', value: 150, color: 'text-stone-400' },
  { name: 'Gold', value: 1200, color: 'text-yellow-400' },
];

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
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
        setTick(t => t + 1);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  
  useEffect(() => {
    const timer = setInterval(() => { fetchData(); }, 2000); // 2秒刷新一次，模拟游戏Tick
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sidebarTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [worldData, sidebarTab]);

  if (!worldData) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#2c3e50] text-stone-300 gap-4 font-mono">
      <div className="w-12 h-12 border-4 border-stone-500 border-t-emerald-400 rounded-full animate-spin"></div>
      <div className="text-xs tracking-widest uppercase">Generating Smallville...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#1a252f] overflow-hidden flex font-sans text-stone-300">
      
      {/* 左侧：游戏视窗 */}
      <div className="flex-1 relative flex flex-col min-w-0">
         
         {/* 顶部 HUD */}
         <div className="h-14 bg-[#2c3e50] border-b border-black/20 flex items-center justify-between px-6 shadow-md z-10 shrink-0">
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="font-bold text-white tracking-wide">AI TOWN</span>
                 <span className="text-xs text-stone-500 ml-2 font-mono">Build v2.1</span>
             </div>

             <div className="flex gap-6 font-mono text-sm">
                 {RESOURCES.map(r => (
                     <div key={r.name} className="flex gap-2">
                         <span className="text-stone-500 uppercase text-xs font-bold mt-0.5">{r.name}</span>
                         <span className={`font-bold ${r.color}`}>{r.value}</span>
                     </div>
                 ))}
             </div>

             <div className="flex gap-2">
                 <button className="p-2 hover:bg-white/10 rounded text-white"><Play size={16} fill="currentColor" /></button>
                 <button className="p-2 hover:bg-white/10 rounded text-stone-400"><Pause size={16} fill="currentColor" /></button>
                 <button className="p-2 hover:bg-white/10 rounded text-stone-400"><FastForward size={16} fill="currentColor" /></button>
             </div>
         </div>

         {/* 核心地图 */}
         <div className="flex-1 relative bg-black">
             <GameMap worldData={worldData} />
             
             {/* 覆盖层信息 */}
             <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
                 <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm font-mono">
                     TICK: {tick}
                 </div>
                 <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm font-mono">
                     AGENTS: {agents.length}
                 </div>
             </div>
         </div>
      </div>

      {/* 右侧：信息面板 */}
      <div className="w-[320px] bg-[#2c3e50] border-l border-black/20 flex flex-col shadow-2xl z-20">
        
        {/* Tab Header */}
        <div className="flex border-b border-black/10">
            <button 
                onClick={() => setSidebarTab('logs')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${sidebarTab==='logs'?'bg-[#34495e] text-white border-b-2 border-emerald-500':'text-stone-500 hover:text-stone-300'}`}
            >
                <Terminal size={14} /> System
            </button>
            <button 
                onClick={() => setSidebarTab('team')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${sidebarTab==='team'?'bg-[#34495e] text-white border-b-2 border-blue-500':'text-stone-500 hover:text-stone-300'}`}
            >
                <Users size={14} /> Agents
            </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-0 font-mono text-xs">
            {sidebarTab === 'logs' && (
                <div className="p-4 space-y-3">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`p-2.5 rounded border-l-2 ${i===0?'bg-emerald-900/20 border-emerald-500 text-emerald-100':'border-stone-600 text-stone-400'}`}>
                            <div className="flex justify-between mb-1 opacity-50 text-[10px]">
                                <span>EVENT #{String(logs.length - i).padStart(3,'0')}</span>
                                {i===0 && <span>NOW</span>}
                            </div>
                            <p className="leading-relaxed">{log}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'team' && (
                <div className="p-2 space-y-2">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-[#34495e] p-2 rounded flex items-start gap-3 border border-transparent hover:border-stone-500 transition-colors cursor-pointer">
                            <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center text-white font-bold shadow-sm ${agent.job.includes('建筑') ? 'bg-[#f1c40f]' : agent.job.includes('领袖') ? 'bg-[#3498db]' : 'bg-[#e74c3c]'}`}>
                                {agent.name[0]}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-stone-200">{agent.name}</span>
                                </div>
                                <div className="text-[10px] text-stone-400 truncate mt-0.5">
                                    {agent.actionLog ? `> ${agent.actionLog.replace(/[“|”]/g,'')}` : '> Idle'}
                                </div>
                                <div className="w-full bg-black/30 h-1 mt-1.5 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full" style={{width: `${agent.hp}%`}}></div>
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