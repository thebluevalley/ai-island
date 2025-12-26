'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Terminal, Users, Map as MapIcon, Clock, Activity } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

const RESOURCES = [
  { name: 'Treasury', value: '$1.2M', color: 'text-stone-600' },
  { name: 'Pop.', value: '1,024', color: 'text-stone-600' },
  { name: 'Rating', value: 'A+', color: 'text-emerald-600' },
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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#dcedc8] text-stone-500 gap-4 font-sans">
      <div className="w-12 h-12 border-4 border-stone-300 border-t-emerald-500 rounded-full animate-spin"></div>
      <div className="text-xs tracking-widest font-bold uppercase">Generating World...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#eceff1] overflow-hidden flex font-sans text-stone-600">
      
      {/* 左侧：游戏全景 */}
      <div className="flex-1 relative flex flex-col min-w-0 bg-white m-2 rounded-xl shadow-sm border border-white overflow-hidden">
         
         {/* 顶部 HUD */}
         <div className="absolute top-4 left-4 right-4 h-12 bg-white/95 backdrop-blur rounded-lg border border-stone-100 flex items-center justify-between px-4 shadow-sm z-10">
             <div className="flex items-center gap-2">
                 <div className="bg-emerald-500 text-white font-bold px-2 py-1 rounded text-xs flex gap-1 items-center shadow-sm">
                    <MapIcon size={12}/> SMALLVILLE
                 </div>
                 <div className="flex items-center gap-1 text-xs text-stone-400 font-mono border-l border-stone-200 pl-2">
                    <Clock size={12}/> DAY {Math.floor(tick / 24) + 1}
                 </div>
             </div>

             <div className="flex gap-6 font-medium text-sm">
                 {RESOURCES.map(r => (
                     <div key={r.name} className="flex gap-2 items-center">
                         <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">{r.name}</span>
                         <span className={`${r.color} font-bold`}>{r.value}</span>
                     </div>
                 ))}
             </div>

             <div className="flex gap-1">
                 <button className="w-8 h-8 flex items-center justify-center hover:bg-stone-50 rounded text-stone-400"><Play size={14} fill="currentColor" /></button>
                 <button className="w-8 h-8 flex items-center justify-center hover:bg-stone-50 rounded text-stone-400"><Pause size={14} fill="currentColor" /></button>
             </div>
         </div>

         {/* 核心地图 */}
         <div className="flex-1 relative bg-[#dcedc8]">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* 右侧：信息面板 */}
      <div className="w-[300px] bg-white border-l border-stone-200 flex flex-col z-20 my-2 mr-2 rounded-xl shadow-sm overflow-hidden">
        
        {/* Tab Header */}
        <div className="flex border-b border-stone-100 p-1 bg-stone-50/50">
            <button 
                onClick={() => setSidebarTab('logs')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${sidebarTab==='logs'?'bg-white shadow-sm text-stone-800':'text-stone-400 hover:text-stone-600'}`}
            >
                Activity
            </button>
            <button 
                onClick={() => setSidebarTab('team')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${sidebarTab==='team'?'bg-white shadow-sm text-stone-800':'text-stone-400 hover:text-stone-600'}`}
            >
                Residents
            </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-0 font-mono text-xs bg-stone-50/30">
            {sidebarTab === 'logs' && (
                <div className="p-3 space-y-2">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`p-2 rounded border-l-2 bg-white shadow-sm ${i===0?'border-emerald-400 text-stone-800':'border-stone-200 text-stone-500'}`}>
                            <div className="flex justify-between mb-0.5 opacity-40 text-[9px]">
                                <span>LOG #{String(logs.length - i).padStart(4,'0')}</span>
                            </div>
                            <p className="leading-snug">{log}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'team' && (
                <div className="p-2 space-y-1">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-white p-2 rounded border border-stone-100 hover:border-emerald-300 transition-colors cursor-pointer shadow-sm group">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${agent.job.includes('建筑') ? 'bg-orange-400' : 'bg-blue-400'}`}></div>
                                    <span className="font-bold text-stone-700">{agent.name}</span>
                                </div>
                                <span className="text-[9px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-400">{agent.job}</span>
                            </div>
                            <div className="text-[10px] text-stone-400 truncate pl-4 group-hover:text-stone-600">
                                {agent.actionLog ? `${agent.actionLog.replace(/[“|”]/g,'')}` : 'Idle'}
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