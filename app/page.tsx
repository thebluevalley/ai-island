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
    <div className="h-screen w-screen bg-[#23242a] text-[#8abeb7] font-mono flex flex-col items-center justify-center">
      <div className="animate-pulse tracking-widest">CONNECTING TO MATRIX...</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#1e1f24] text-[#c5c8c6] font-mono flex overflow-hidden p-1 gap-1">
      
      {/* Left: Main Map */}
      <div className="flex-[4] border border-[#2b2d35] flex flex-col relative bg-[#23242a]">
         
         <div className="h-8 border-b border-[#2b2d35] flex items-center justify-between px-3 text-xs bg-[#282a30]">
             <div className="flex gap-4">
                 <span className="text-[#8abeb7] font-bold flex items-center gap-1"><Terminal size={12}/> ASCII_CITY</span>
                 <span className="text-[#5c6370] flex items-center gap-1"><Map size={12}/> 120x70</span>
             </div>
             <div className="text-[#5c6370]">TICK: {tick}</div>
         </div>

         <div className="flex-1 relative overflow-hidden flex items-center justify-center">
             <GameMap worldData={worldData} />
         </div>
      </div>

      {/* Right: Sidebar */}
      <div className="flex-1 min-w-[280px] border border-[#2b2d35] flex flex-col bg-[#23242a]">
        
        <div className="flex border-b border-[#2b2d35] text-[10px]">
            <button onClick={() => setSidebarTab('LOG')} className={`flex-1 py-1.5 hover:bg-[#2b2d35] ${sidebarTab==='LOG'?'bg-[#2b2d35] text-[#fff]':'text-[#5c6370]'}`}>
                LOGS
            </button>
            <button onClick={() => setSidebarTab('INFO')} className={`flex-1 py-1.5 hover:bg-[#2b2d35] ${sidebarTab==='INFO'?'bg-[#2b2d35] text-[#fff]':'text-[#5c6370]'}`}>
                INFO
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-xs font-mono leading-relaxed custom-scrollbar">
            {sidebarTab === 'LOG' && (
                <div className="space-y-2">
                    {(logs || []).slice().reverse().map((log: string, i: number) => (
                        <div key={i} className="break-words border-l border-[#4a505c] pl-2">
                            <span className="text-[#5c6370] mr-2">[{String((logs || []).length - i).padStart(3,'0')}]</span>
                            <span className="text-[#c5c8c6]">{log}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'INFO' && (
                <div className="space-y-4">
                    <div className="border border-[#2b2d35] p-2">
                        <div className="text-[#5c6370] mb-2 border-b border-[#2b2d35] pb-1">LEGEND</div>
                        <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 border border-[#d4b595] text-[#d4b595] flex items-center justify-center">#</div><span>Home</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 border border-[#8abeb7] text-[#8abeb7] flex items-center justify-center">#</div><span>Shop</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 border border-[#b294bb] text-[#b294bb] flex items-center justify-center">#</div><span>Civic</span></div>
                            <div className="flex items-center gap-2"><span className="text-[#68856c]">♣</span><span>Forest</span></div>
                        </div>
                    </div>
                    <div>
                        <div className="text-[#5c6370] mb-2 border-b border-[#2b2d35] pb-1">CITIZENS ({agents.length})</div>
                        <div className="space-y-1">
                            {agents.map((agent: Agent) => (
                                <div key={agent.id} className="flex justify-between items-center text-[#969896] hover:text-[#fff]">
                                    <span>{agent.name}</span>
                                    <span className="text-[#5c6370] text-[9px]">{agent.job}</span>
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