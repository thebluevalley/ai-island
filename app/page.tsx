'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Map, Users } from 'lucide-react';
import GameMap from './components/GameMap';

type Agent = { id: number; name: string; job: string; hp: number; hunger: number; actionLog: string; locationName?: string; x: number; y: number };

// --- 默认演示数据 (防止黑屏) ---
const DEFAULT_DATA = {
    agents: [
        { id: 1, name: "Builder", job: "Construct", x: 15, y: 15, actionLog: "Surveying land..." },
        { id: 2, name: "Mayor", job: "Civic", x: 64, y: 40, actionLog: "Reviewing plans..." },
        { id: 3, name: "Citizen", job: "Living", x: 100, y: 60, actionLog: "Walking home..." }
    ],
    logs: [
        "System initialized.",
        "Map generation complete.",
        "Waiting for AI backend connection..."
    ]
};

export default function Home() {
  const [worldData, setWorldData] = useState<any>(null); // 初始为空
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<'LOG' | 'INFO'>('LOG');
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tick', { method: 'POST' });
      // 如果 API 返回 401 或 500，这里会抛错或 parse 失败
      if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setWorldData(data.world);
            setTick(t => t + 1);
          }
      } else {
          console.warn("API Error, using static map");
      }
    } catch (e) { 
        console.error("Fetch failed:", e); 
    } finally { 
        setLoading(false); 
    }
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

  // --- 关键修复：不再返回 Loading 组件，而是使用默认数据渲染 ---
  // 如果 worldData 还没回来，就用 DEFAULT_DATA 顶替
  const activeData = worldData || DEFAULT_DATA;
  const { agents, logs } = activeData;

  return (
    <div className="h-screen w-screen bg-[#1e1f24] text-[#c5c8c6] font-mono flex overflow-hidden p-1 gap-1">
      
      {/* 左侧：主地图 */}
      <div className="flex-[4] border border-[#2b2d35] flex flex-col relative bg-[#23242a]">
         
         {/* 顶部 HUD */}
         <div className="h-8 border-b border-[#2b2d35] flex items-center justify-between px-3 text-xs bg-[#282a30]">
             <div className="flex gap-4">
                 <span className="text-[#8abeb7] font-bold flex items-center gap-1"><Terminal size={12}/> ASCII_METROPOLIS</span>
                 <span className="text-[#5c6370] flex items-center gap-1"><Map size={12}/> 128x80 (NO_SCALE)</span>
             </div>
             <div className="text-[#5c6370]">
                 {worldData ? `LIVE TICK: ${tick}` : "OFFLINE MODE (VIEWER)"}
             </div>
         </div>

         {/* 核心地图区 */}
         <div className="flex-1 relative overflow-hidden flex items-center justify-center">
             {/* 这里的 worldData 即使是 null 也没关系，GameMap 内部有默认处理，或者我们传 activeData */}
             <GameMap worldData={activeData} />
         </div>
      </div>

      {/* 右侧：侧边栏 */}
      <div className="flex-1 min-w-[280px] border border-[#2b2d35] flex flex-col bg-[#23242a]">
        
        <div className="flex border-b border-[#2b2d35] text-[10px]">
            <button onClick={() => setSidebarTab('LOG')} className={`flex-1 py-1.5 hover:bg-[#2b2d35] ${sidebarTab==='LOG'?'bg-[#2b2d35] text-[#fff]':'text-[#5c6370]'}`}>LOGS</button>
            <button onClick={() => setSidebarTab('INFO')} className={`flex-1 py-1.5 hover:bg-[#2b2d35] ${sidebarTab==='INFO'?'bg-[#2b2d35] text-[#fff]':'text-[#5c6370]'}`}>INFO</button>
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
                            <div className="flex items-center gap-2"><span className="text-[#68856c]">♣</span><span>Park</span></div>
                        </div>
                    </div>
                    <div>
                        <div className="text-[#5c6370] mb-2 border-b border-[#2b2d35] pb-1">CITIZENS ({(agents || []).length})</div>
                        <div className="space-y-1">
                            {(agents || []).map((agent: Agent) => (
                                <div key={agent.id} className="flex justify-between items-center text-[#969896] hover:text-[#fff] cursor-default">
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