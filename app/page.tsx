'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Radio, Map } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<'LOG' | 'ENT'>('LOG');
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
    if (sidebarTab === 'LOG' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [worldData, sidebarTab]);

  if (!worldData) return (
    <div className="h-screen w-screen bg-[#000] text-[#0f0] font-mono flex flex-col items-center justify-center">
      <div className="animate-pulse tracking-widest">INITIALIZING_ASCII_RENDERER...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-[#cccccc] font-mono flex overflow-hidden p-1 gap-1">
      
      {/* 左侧：主地图 */}
      <div className="flex-[4] border border-[#333] flex flex-col relative bg-[#111]">
         
         {/* 顶部状态栏 */}
         <div className="h-6 border-b border-[#333] flex items-center justify-between px-2 text-[10px] bg-[#1a1a1a]">
             <div className="flex gap-4">
                 <span className="flex items-center gap-1 text-[#00e676]"><Terminal size={10}/> SYS: ONLINE</span>
                 <span className="flex items-center gap-1"><Map size={10}/> MAP: 100x50</span>
             </div>
             <div className="flex gap-4">
                 <span>TICK: {tick}</span>
                 <span className="text-[#42a5f5]">POP: {agents.length}</span>
             </div>
         </div>

         {/* 核心地图区 */}
         <div className="flex-1 relative overflow-hidden flex items-center justify-center">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* 右侧：数据面板 */}
      <div className="flex-1 min-w-[280px] border border-[#333] flex flex-col bg-[#0f0f0f]">
        
        {/* Tab */}
        <div className="flex border-b border-[#333] text-[10px]">
            <button onClick={() => setSidebarTab('LOG')} className={`flex-1 py-1.5 hover:bg-[#222] ${sidebarTab==='LOG'?'bg-[#222] text-[#fff]':'text-[#666]'}`}>
                [1] LOGS
            </button>
            <button onClick={() => setSidebarTab('ENT')} className={`flex-1 py-1.5 hover:bg-[#222] ${sidebarTab==='ENT'?'bg-[#222] text-[#fff]':'text-[#666]'}`}>
                [2] ENTITIES
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 text-[10px] leading-relaxed custom-scrollbar">
            {sidebarTab === 'LOG' && (
                <div className="space-y-1">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className="break-words border-l-2 border-[#333] pl-2 hover:border-[#555]">
                            <span className="text-[#444] mr-2">[{String(logs.length - i).padStart(3,'0')}]</span>
                            <span className="text-[#aaa]">{log}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'ENT' && (
                <div className="space-y-1">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="border border-[#222] p-1.5 hover:bg-[#1a1a1a] cursor-pointer flex justify-between items-center group">
                            <div>
                                <span className="text-[#00e676] font-bold block">{agent.name}</span>
                                <span className="text-[#555] group-hover:text-[#777]">&gt; {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'').substring(0,20)+'...' : 'IDLE'}</span>
                            </div>
                            <span className="text-[#333] text-[9px]">{agent.job.substring(0,1)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}