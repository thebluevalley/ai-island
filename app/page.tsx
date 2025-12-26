'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Map, Users } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<'LOG' | 'INFO'>('LOG');
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
    const timer = setInterval(() => { fetchData(); }, 1000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sidebarTab === 'LOG' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [worldData, sidebarTab]);

  if (!worldData) return (
    <div className="h-screen w-screen bg-[#0f0f0f] text-[#333] font-mono flex flex-col items-center justify-center">
      <div className="text-[#2e7d32] animate-pulse">GENERATING_ASCII_WORLD...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#000] text-[#ccc] font-mono flex overflow-hidden">
      
      {/* 主地图区域 */}
      <div className="flex-1 flex flex-col relative border-r border-[#222]">
         
         <div className="h-8 border-b border-[#222] flex items-center justify-between px-3 text-xs bg-[#111]">
             <div className="flex gap-4">
                 <span className="text-[#2e7d32] font-bold flex items-center gap-1"><Terminal size={12}/> MATRIX_TOWN</span>
                 <span className="text-[#555] flex items-center gap-1"><Map size={12}/> 120x60</span>
             </div>
             <div className="text-[#555]">TICK: {tick}</div>
         </div>

         <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#0f0f0f]">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* 右侧边栏 */}
      <div className="w-[300px] flex flex-col bg-[#050505]">
        
        <div className="flex border-b border-[#222] text-xs">
            <button onClick={() => setSidebarTab('LOG')} className={`flex-1 py-2 hover:bg-[#111] ${sidebarTab==='LOG'?'bg-[#1a1a1a] text-[#fff]':'text-[#555]'}`}>
                LOGS
            </button>
            <button onClick={() => setSidebarTab('INFO')} className={`flex-1 py-2 hover:bg-[#111] ${sidebarTab==='INFO'?'bg-[#1a1a1a] text-[#fff]':'text-[#555]'}`}>
                INFO
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-xs font-mono leading-relaxed custom-scrollbar">
            {sidebarTab === 'LOG' && (
                <div className="space-y-2">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className="break-words border-l border-[#333] pl-2">
                            <span className="text-[#444] mr-2">[{String(logs.length - i).padStart(3,'0')}]</span>
                            <span className="text-[#aaa]">{log}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'INFO' && (
                <div className="space-y-4">
                    {/* Legend */}
                    <div className="border border-[#222] p-2">
                        <div className="text-[#555] mb-2 border-b border-[#222] pb-1">BUILDING CODES</div>
                        <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#000] border border-[#d84315] text-[#d84315] flex items-center justify-center">#</div>
                                <span>Residential</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#000] border border-[#0277bd] text-[#0277bd] flex items-center justify-center">#</div>
                                <span>Commercial</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#000] border border-[#9c27b0] text-[#9c27b0] flex items-center justify-center">#</div>
                                <span>Civic/Gov</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[#2e7d32]">♣</span>
                                <span>Forest</span>
                            </div>
                        </div>
                    </div>

                    {/* Agents */}
                    <div>
                        <div className="text-[#555] mb-2 border-b border-[#222] pb-1">POPULATION ({agents.length})</div>
                        <div className="space-y-1">
                            {agents.map((agent: Agent) => (
                                <div key={agent.id} className="flex justify-between items-center text-[#888] hover:text-[#fff] cursor-default">
                                    <span className={agent.job.includes('建筑')?'text-[#d84315]':'text-[#0277bd]'}>{agent.name}</span>
                                    <span className="text-[#333] text-[9px]">{agent.job}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}