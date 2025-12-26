'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Radio, Hash } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<'LOG' | 'MEM'>('LOG');
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
    <div className="h-screen w-screen bg-black text-green-500 font-mono flex flex-col items-center justify-center">
      <div className="animate-pulse">SYSTEM_BOOT_SEQUENCE...</div>
      <div className="mt-2">[||||||||||        ] 50%</div>
    </div>
  );

  const { agents, logs } = worldData;

  return (
    <div className="h-screen w-screen bg-[#000000] text-[#00ff00] font-mono flex overflow-hidden p-2 gap-2">
      
      {/* 左侧：主屏幕 */}
      <div className="flex-[3] border border-[#333] flex flex-col relative">
         
         {/* 顶部状态栏 */}
         <div className="h-8 border-b border-[#333] flex items-center justify-between px-2 text-xs bg-[#111]">
             <div className="flex gap-4">
                 <span className="flex items-center gap-1"><Terminal size={12}/> TTY_01</span>
                 <span className="flex items-center gap-1"><Cpu size={12}/> MEM: 64K</span>
             </div>
             <div className="flex gap-4">
                 <span>SIM_TICK: {tick}</span>
                 <span><span className="animate-pulse">●</span> ONLINE</span>
             </div>
         </div>

         {/* 纯文本地图区 */}
         <div className="flex-1 relative overflow-hidden bg-black">
             <GameMap worldData={worldData} />
             
             {/* 装饰性 CRT 扫描线 */}
             <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]"></div>
         </div>
      </div>

      {/* 右侧：数据流 */}
      <div className="flex-1 border border-[#333] flex flex-col min-w-[300px]">
        
        {/* Tab */}
        <div className="flex border-b border-[#333] text-xs">
            <button onClick={() => setSidebarTab('LOG')} className={`flex-1 py-2 hover:bg-[#111] ${sidebarTab==='LOG'?'bg-[#222] text-white':''}`}>
                [F1] SYSTEM_LOG
            </button>
            <button onClick={() => setSidebarTab('MEM')} className={`flex-1 py-2 hover:bg-[#111] ${sidebarTab==='MEM'?'bg-[#222] text-white':''}`}>
                [F2] ENTITY_LIST
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 text-xs font-mono custom-scrollbar">
            {sidebarTab === 'LOG' && (
                <div className="space-y-1">
                    {logs.slice().reverse().map((log: string, i: number) => (
                        <div key={i} className="break-words">
                            <span className="text-[#555] mr-2">
                                {String(logs.length - i).padStart(4,'0')}:
                            </span>
                            <span className="text-[#00ff00]">{log}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
            
            {sidebarTab === 'MEM' && (
                <div className="space-y-2">
                    {agents.map((agent: Agent) => (
                        <div key={agent.id} className="border border-[#333] p-1.5 hover:bg-[#111] cursor-pointer">
                            <div className="flex justify-between text-[#ffff00]">
                                <span>ID_{agent.id.toString(16).toUpperCase()} : {agent.name}</span>
                                <span>[{agent.job}]</span>
                            </div>
                            <div className="text-[#555] truncate mt-1">
                                &gt; {agent.actionLog ? agent.actionLog.replace(/[“|”]/g,'') : 'IDLE_STATE'}
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