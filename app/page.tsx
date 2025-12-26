'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Terminal, Users, Construction, RefreshCw } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

const RESOURCES = [
  { name: 'Wood', value: 500, color: 'text-amber-300' },
  { name: 'Stone', value: 200, color: 'text-stone-300' },
  { name: 'Food', value: 80, color: 'text-emerald-300' },
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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e293b] text-stone-400 gap-4 font-mono">
      <div className="w-12 h-12 border-4 border-stone-600 border-t-emerald-500 rounded-full animate-spin"></div>
      <div className="text-xs tracking-widest uppercase">Initializing Town...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#0f172a] overflow-hidden flex font-sans text-stone-300">
      
      {/* 左侧主视窗 */}
      <div className="flex-1 relative flex flex-col min-w-0">
         
         {/* 顶部状态栏 */}
         <div className="h-12 bg-[#1e293b] border-b border-black/30 flex items-center justify-between px-4 shadow-md z-10 shrink-0">
             <div className="flex items-center gap-3">
                 <div className="font-black text-white tracking-wider text-lg">AI TOWN</div>
                 <div className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 font-mono">LIVE</div>
             </div>

             <div className="flex gap-6 font-mono text-xs">
                 {RESOURCES.map(r => (
                     <div key={r.name} className="flex gap-2 items-center">
                         <span className="text-stone-500 font-bold">{r.name}</span>
                         <span className={`font-bold ${r.color}`}>{r.value}</span>
                     </div>
                 ))}
             </div>

             <div className="text-xs font-mono text-stone-500">TICK: <span className="text-white">{tick}</span></div>
         </div>

         {/* 游戏地图 */}
         <div className="flex-1 relative bg-black overflow-hidden">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* 右侧边栏 */}
      <div className="w-[340px] bg-[#1e293b] border-l border-black/30 flex flex-col shadow-2xl z-20">
        
        {/* Tab 栏 */}
        <div className="flex border-b border-black/20 bg-[#0f172a]">
            <button 
                onClick={() => setSidebarTab('logs')}
                className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${sidebarTab==='logs'?'bg-[#1e293b] text-white border-t-2 border-emerald-500':'text-stone-500 hover:text-stone-300'}`}
            >
                <Terminal size={14} /> System Logs
            </button>
            <button 
                onClick={() => setSidebarTab('team')}
                className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${sidebarTab==='team'?'bg-[#1e293b] text-white border-t-2 border-blue-500':'text-stone-500 hover:text-stone-300'}`}
            >
                <Users size={14} /> Residents
            </button>
        </div>

        {/* 内容列表 */}
        <div className="flex-1 overflow-y-auto p-0 font-mono text-xs custom-scrollbar">
            {sidebarTab === 'logs' && (
                <div className="p-3 space-y-2">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className={`p-2 rounded border-l-2 ${i===0?'bg-emerald-500/10 border-emerald-500 text-emerald-200':'border-stone-700 text-stone-400'}`}>
                            <div className="text-[10px] opacity-50 mb-1">#{String(logs.length - i).padStart(4,'0')}</div>
                            <p className="leading-relaxed">{log}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'team' && (
                <div className="p-3 space-y-2">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="bg-[#0f172a] p-2 rounded flex items-center gap-3 border border-stone-800 hover:border-stone-600 transition-colors">
                            <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center text-white font-bold ${agent.job.includes('建筑') ? 'bg-orange-600' : agent.job.includes('领袖') ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                                {agent.name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-stone-200">{agent.name}</span>
                                    <span className="text-[9px] bg-stone-800 px-1.5 rounded text-stone-400">{agent.job}</span>
                                </div>
                                <div className="text-[10px] text-stone-500 truncate mt-1">
                                    {agent.actionLog ? `> ${agent.actionLog.replace(/[“|”]/g,'')}` : '> Sleeping...'}
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