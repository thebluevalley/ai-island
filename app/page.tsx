'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Terminal, Users, Building2, LayoutGrid } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#cfd8dc] text-stone-500 gap-4">
      <div className="w-12 h-12 border-4 border-white border-t-blue-500 rounded-full animate-spin"></div>
      <div className="text-xs font-bold uppercase tracking-widest">Loading AI Town...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#b0bec5] overflow-hidden flex font-sans text-stone-600">
      
      {/* 左侧：全景地图 */}
      <div className="flex-1 relative flex flex-col min-w-0 bg-[#dcedc8] m-2 rounded-xl shadow-lg border border-white overflow-hidden">
         
         {/* 顶部 HUD */}
         <div className="absolute top-4 left-4 right-4 h-12 bg-white/90 backdrop-blur rounded-lg border border-stone-100 flex items-center justify-between px-4 shadow-sm z-10">
             <div className="flex items-center gap-2">
                 <div className="bg-blue-600 text-white font-bold px-2 py-1 rounded text-xs flex gap-1 items-center">
                    <Building2 size={12}/> AI TOWN
                 </div>
                 <div className="text-xs font-mono text-stone-400 pl-2 border-l border-stone-200">
                    FULL PANORAMA VIEW
                 </div>
             </div>
             <div className="flex gap-2">
                 <button className="p-1.5 hover:bg-stone-100 rounded text-stone-400"><Play size={16}/></button>
                 <button className="p-1.5 hover:bg-stone-100 rounded text-stone-400"><Pause size={16}/></button>
             </div>
         </div>

         {/* 地图组件 */}
         <div className="flex-1 relative">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* 右侧：面板 */}
      <div className="w-[300px] bg-white border-l border-stone-200 flex flex-col z-20 my-2 mr-2 rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b border-stone-100 p-1 bg-stone-50">
            <button onClick={() => setSidebarTab('logs')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded transition-all ${sidebarTab==='logs'?'bg-white shadow text-stone-800':'text-stone-400'}`}>Events</button>
            <button onClick={() => setSidebarTab('team')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded transition-all ${sidebarTab==='team'?'bg-white shadow text-stone-800':'text-stone-400'}`}>Agents</button>
        </div>

        <div className="flex-1 overflow-y-auto p-0 font-mono text-xs bg-stone-50/30">
            {sidebarTab === 'logs' && (
                <div className="p-3 space-y-2">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`p-2 rounded border-l-2 bg-white shadow-sm ${i===0?'border-blue-400 text-stone-800':'border-stone-200 text-stone-500'}`}>
                            <span className="opacity-50 text-[9px] block mb-1">#{String(logs.length - i).padStart(3,'0')}</span>
                            {log}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            {sidebarTab === 'team' && (
                <div className="p-2 space-y-1">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-white p-2 rounded border border-stone-100 hover:border-blue-300 transition-colors cursor-pointer shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-stone-700">{agent.name}</span>
                                <span className="text-[9px] bg-stone-100 px-1.5 rounded">{agent.job}</span>
                            </div>
                            <div className="text-[10px] text-stone-400 truncate">{agent.actionLog ? `${agent.actionLog.replace(/[“|”]/g,'')}` : 'Idle'}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}