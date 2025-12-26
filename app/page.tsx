'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Terminal, Users, Construction, Map, Clock } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

const RESOURCES = [
  { name: 'Funds', value: '$12,500', color: 'text-stone-600' },
  { name: 'Pop', value: '128', color: 'text-stone-600' },
  { name: 'Happiness', value: '98%', color: 'text-emerald-500' },
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
    const timer = setInterval(() => { fetchData(); }, 2000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sidebarTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [worldData, sidebarTab]);

  if (!worldData) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fafafa] text-stone-300 gap-4 font-sans">
      <div className="w-12 h-12 border-4 border-stone-200 border-t-emerald-300 rounded-full animate-spin"></div>
      <div className="text-xs tracking-widest text-stone-400 uppercase">Loading Metropolis...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#f5f5f5] overflow-hidden flex font-sans text-stone-600">
      
      {/* 左侧：主视窗 */}
      <div className="flex-1 relative flex flex-col min-w-0 bg-white m-3 rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
         
         {/* 顶部 HUD (悬浮式) */}
         <div className="absolute top-4 left-4 right-4 h-14 bg-white/90 backdrop-blur-md rounded-xl border border-stone-100 flex items-center justify-between px-6 shadow-sm z-10">
             <div className="flex items-center gap-3">
                 <div className="bg-stone-800 text-white font-bold px-3 py-1 rounded-lg text-sm flex gap-2 items-center">
                    <Map size={14}/> AI CITY
                 </div>
                 <div className="flex items-center gap-1 text-xs text-stone-400 font-mono border-l border-stone-200 pl-3">
                    <Clock size={12}/> DAY {Math.floor(tick / 24) + 1}
                 </div>
             </div>

             <div className="flex gap-8 font-medium text-sm">
                 {RESOURCES.map(r => (
                     <div key={r.name} className="flex gap-2 items-center">
                         <span className="text-stone-400 text-xs uppercase font-bold">{r.name}</span>
                         <span className={`${r.color}`}>{r.value}</span>
                     </div>
                 ))}
             </div>

             <div className="flex gap-2">
                 <button className="p-2 hover:bg-stone-100 rounded-lg text-stone-400"><Play size={18} fill="currentColor" /></button>
                 <button className="p-2 hover:bg-stone-100 rounded-lg text-stone-400"><Pause size={18} fill="currentColor" /></button>
             </div>
         </div>

         {/* 核心地图 */}
         <div className="flex-1 relative bg-[#fcfcfc]">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* 右侧：信息面板 */}
      <div className="w-[340px] bg-white border-l border-stone-100 flex flex-col z-20 my-3 mr-3 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Tab Header */}
        <div className="flex border-b border-stone-100 p-2 gap-2">
            <button 
                onClick={() => setSidebarTab('logs')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${sidebarTab==='logs'?'bg-stone-100 text-stone-800':'text-stone-400 hover:bg-stone-50'}`}
            >
                <Terminal size={14} /> EVENTS
            </button>
            <button 
                onClick={() => setSidebarTab('team')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${sidebarTab==='team'?'bg-stone-100 text-stone-800':'text-stone-400 hover:bg-stone-50'}`}
            >
                <Users size={14} /> CITIZENS
            </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-0 font-mono text-xs">
            {sidebarTab === 'logs' && (
                <div className="p-4 space-y-3">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`p-3 rounded-xl border ${i===0?'bg-emerald-50/50 border-emerald-100 text-emerald-800':'border-stone-100 text-stone-500'}`}>
                            <div className="flex justify-between mb-1 opacity-40 text-[10px]">
                                <span>SEQ #{String(logs.length - i).padStart(4,'0')}</span>
                                {i===0 && <span>LIVE</span>}
                            </div>
                            <p className="leading-relaxed">{log}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'team' && (
                <div className="p-3 space-y-2">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-white p-3 rounded-xl flex items-center gap-3 border border-stone-100 hover:border-stone-300 transition-colors cursor-pointer shadow-sm">
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold shadow-sm ${agent.job.includes('建筑') ? 'bg-[#ffcc80]' : agent.job.includes('领袖') ? 'bg-[#90caf9]' : 'bg-[#a5d6a7]'}`}>
                                {agent.name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-stone-700">{agent.name}</span>
                                    <span className="text-[9px] bg-stone-100 px-2 py-0.5 rounded-full text-stone-400">{agent.job}</span>
                                </div>
                                <div className="text-[10px] text-stone-400 truncate mt-1">
                                    {agent.actionLog ? `> ${agent.actionLog.replace(/[“|”]/g,'')}` : '> Resting...'}
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