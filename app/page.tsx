'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Zap, User, MessageSquare, Clock, MapPin } from 'lucide-react';
import GameMap from './components/GameMap';

// --- Simulation Types ---
type AgentState = 'IDLE' | 'MOVING' | 'WORKING' | 'TALKING' | 'SLEEPING' | 'EATING';

interface Agent {
    id: number; name: string; job: string;
    x: number; y: number;
    targetX: number; targetY: number;
    homeId: number; // POI ID for home
    workId: number; // POI ID for work
    mood: string; energy: number; state: AgentState;
    speech: string | null; lastThought: number;
}

// --- Schedule Logic ---
const getScheduleActivity = (job: string, hour: number): 'WORK' | 'HOME' | 'LEISURE' => {
    // Night: 22:00 - 07:00 -> HOME
    if (hour >= 22 || hour < 7) return 'HOME';
    
    // Work: 08:00 - 17:00 (Except Citizens)
    if (hour >= 8 && hour < 17) {
        if (job === 'Citizen') return 'LEISURE'; // Citizens roam
        return 'WORK';
    }
    
    // Evening: 17:00 - 22:00 -> LEISURE
    return 'LEISURE';
};

const INITIAL_AGENTS: Agent[] = [
    { id: 1, name: "Alice", job: "Citizen", x: 20, y: 15, targetX: 20, targetY: 15, homeId: -1, workId: -1, mood: "Relaxed", energy: 90, state: 'IDLE', speech: null, lastThought: 0 },
    { id: 2, name: "Bob", job: "Mayor", x: 90, y: 40, targetX: 90, targetY: 40, homeId: -1, workId: -1, mood: "Busy", energy: 70, state: 'WORKING', speech: null, lastThought: 0 },
    { id: 3, name: "Charlie", job: "Guard", x: 50, y: 20, targetX: 50, targetY: 20, homeId: -1, workId: -1, mood: "Alert", energy: 95, state: 'MOVING', speech: null, lastThought: 0 },
    { id: 4, name: "Diana", job: "Doctor", x: 130, y: 60, targetX: 130, targetY: 60, homeId: -1, workId: -1, mood: "Focused", energy: 80, state: 'WORKING', speech: null, lastThought: 0 },
    { id: 5, name: "Eve", job: "Shopkeeper", x: 160, y: 30, targetX: 160, targetY: 30, homeId: -1, workId: -1, mood: "Friendly", energy: 60, state: 'WORKING', speech: null, lastThought: 0 },
];

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
  // Game State
  const [worldTime, setWorldTime] = useState(7 * 60); // Start at 7:00 AM (in minutes)
  const [pois, setPois] = useState<any[]>([]); // Points of Interest
  const [logs, setLogs] = useState<string[]>(["System initialized.", "Waiting for map structure..."]);
  const processingRef = useRef(false);

  // --- 1. Time & Schedule Loop (Runs every 1s) ---
  useEffect(() => {
    if (pois.length === 0) return; // Wait for map

    const timer = setInterval(() => {
        // Advance Time (1 real sec = 1 game min for fast demo)
        setWorldTime(prev => (prev + 1) % 1440);
        const currentHour = Math.floor((worldTime % 1440) / 60);

        setAgents(prevAgents => prevAgents.map(agent => {
            // A. Determine Goal based on Schedule
            const activity = getScheduleActivity(agent.job, currentHour);
            let targetId = agent.homeId; // Default Home
            let state: AgentState = 'IDLE';

            if (activity === 'WORK') {
                targetId = agent.workId;
                state = 'WORKING';
            } else if (activity === 'LEISURE') {
                // Pick random leisure spot (Park/Cafe) or Home
                const leisureSpots = pois.filter(p => p.type === 'CAFE' || p.type === 'CIV' || p.type === 'COM');
                if (leisureSpots.length > 0 && Math.random() > 0.99) {
                    // 1% chance to change leisure spot per tick
                    targetId = leisureSpots[Math.floor(Math.random() * leisureSpots.length)].id;
                } else if (agent.state !== 'MOVING') {
                    // Keep current target if already moving/there
                    // Find POI closest to current targetX/Y to allow persistence
                    targetId = -2; // Keep current
                }
                state = 'EATING'; // Simplified
            } else {
                state = 'SLEEPING';
            }

            // B. Resolve Target ID to Coords
            let tx = agent.targetX;
            let ty = agent.targetY;

            if (targetId !== -2) {
                const targetPOI = pois.find(p => p.id === targetId);
                if (targetPOI) {
                    tx = targetPOI.x;
                    ty = targetPOI.y;
                }
            }

            // C. Energy Decay/Regen
            let newEnergy = agent.energy;
            if (state === 'SLEEPING') newEnergy = Math.min(100, newEnergy + 0.5);
            else if (state === 'WORKING') newEnergy = Math.max(0, newEnergy - 0.2);
            else newEnergy = Math.max(0, newEnergy - 0.05);

            return {
                ...agent,
                targetX: tx,
                targetY: ty,
                state: (Math.abs(agent.x - tx) > 2) ? 'MOVING' : state,
                energy: newEnergy
            };
        }));

    }, 200); // Update logic 5 times/sec

    return () => clearInterval(timer);
  }, [worldTime, pois]);

  // --- 2. Initialization: Assign Homes & Jobs ---
  const handleMapReady = (mapPois: any[]) => {
    setPois(mapPois);
    setLogs(prev => ["Map scanned. assigning properties...", ...prev]);
    
    const homes = mapPois.filter(p => p.type === 'RES');
    const civics = mapPois.filter(p => p.type === 'CIV');
    const shops = mapPois.filter(p => p.type === 'COM' || p.type === 'CAFE');

    setAgents(prev => prev.map((a, idx) => {
        const home = homes[idx % homes.length];
        let work = home; // Default work from home
        
        if (a.job === 'Mayor' || a.job === 'Doctor') work = civics[idx % civics.length] || home;
        if (a.job === 'Shopkeeper') work = shops[0] || home;
        
        return {
            ...a,
            homeId: home.id,
            workId: work.id,
            x: home.x, // Start at home
            y: home.y,
            targetX: home.x,
            targetY: home.y
        };
    }));
  };

  // --- 3. Brain Loop (LLM) ---
  useEffect(() => {
    const brainTimer = setInterval(async () => {
        if (processingRef.current) return;
        
        const now = Date.now();
        const candidates = agents.filter(a => now - a.lastThought > 15000); // 15s cooldown
        if (candidates.length === 0) return;
        
        const thinker = candidates[Math.floor(Math.random() * candidates.length)];
        processingRef.current = true;

        try {
            // Context Awareness
            const hour = Math.floor(worldTime / 60);
            const timeStr = `${hour}:${String(worldTime%60).padStart(2,'0')}`;
            const context = `Time: ${timeStr}. State: ${thinker.state}. Location: [${Math.floor(thinker.x)}, ${Math.floor(thinker.y)}]. Energy: ${Math.floor(thinker.energy)}.`;

            setAgents(prev => prev.map(a => a.id === thinker.id ? {...a, speech: "💭..."} : a));

            const res = await fetch('/api/agent-brain', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ agent: thinker, taskType: 'CHAT', context })
            });

            const data = await res.json();
            if (data.success) {
                const thought = data.result.content || "...";
                setAgents(prev => prev.map(a => a.id === thinker.id ? { ...a, speech: thought, lastThought: now } : a));
                setLogs(prev => [`[${timeStr}] ${thinker.name}: ${thought}`, ...prev.slice(0, 10)]);
            }
        } catch (e) { console.error(e); } 
        finally { processingRef.current = false; }

    }, 4000); 
    return () => clearInterval(brainTimer);
  }, [agents, worldTime]);

  // Sync selection
  useEffect(() => {
    if (selectedAgent) {
        const fresh = agents.find(a => a.id === selectedAgent.id);
        if (fresh) setSelectedAgent(fresh);
    }
  }, [agents, selectedAgent]);

  // Format Time
  const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  return (
    <div className="h-screen w-screen bg-[#1e1f24] text-[#c5c8c6] font-mono flex overflow-hidden p-1 gap-1">
      {/* Map Area */}
      <div className="flex-[5] border border-[#2b2d35] flex flex-col relative bg-[#23242a]">
         <div className="h-10 border-b border-[#2b2d35] flex items-center justify-between px-4 text-xs bg-[#282a30]">
             <div className="flex gap-6">
                 <span className="text-[#8abeb7] font-bold flex items-center gap-2"><Terminal size={14}/> AI_TOWN LIVE</span>
                 <span className="text-[#e5c07b] flex items-center gap-2 font-bold"><Clock size={14}/> {formatTime(worldTime)}</span>
                 <span className="text-[#5c6370] flex items-center gap-2"><Activity size={14}/> {agents.filter(a=>a.state==='WORKING').length} WORKING</span>
             </div>
             <div className="text-[#98c379] flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-[#98c379] animate-pulse"></span>
                 AUTONOMOUS
             </div>
         </div>
         <div className="flex-1 relative overflow-hidden flex items-center justify-center">
             <GameMap worldData={{ agents }} onSelectAgent={setSelectedAgent} onMapReady={handleMapReady} />
         </div>
      </div>

      {/* Inspector */}
      <div className="w-[320px] border border-[#2b2d35] flex flex-col bg-[#23242a]">
        {selectedAgent ? (
            <div className="flex-1 flex flex-col">
                <div className="p-6 border-b border-[#2b2d35] bg-[#282a30] flex flex-col items-center">
                    <div className="text-5xl mb-3 animate-bounce">
                        {{'Citizen':'🙍','Mayor':'👨‍💼','Guard':'👮','Doctor':'👩‍⚕️','Shopkeeper':'🧑‍🍳'}[selectedAgent.job]||'👤'}
                    </div>
                    <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                    <span className="text-[#5c6370] text-sm tracking-wider">{selectedAgent.job}</span>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-[#2b2d35] p-4 rounded border border-[#3e4451] shadow-inner">
                        <div className="flex items-center gap-2 text-[10px] text-[#e5c07b] uppercase mb-2">
                            <MessageSquare size={12}/> Live Thought
                        </div>
                        <div className="text-white text-sm font-medium leading-relaxed">"{selectedAgent.speech || "..."}"</div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#abb2bf]">
                            <span className="flex items-center gap-1"><Zap size={12}/> ENERGY</span>
                            <span>{Math.floor(selectedAgent.energy)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#2b2d35] rounded-full overflow-hidden"><div className="h-full bg-[#98c379]" style={{width: `${selectedAgent.energy}%`}}></div></div>
                    </div>
                    <div className="text-[10px] text-[#5c6370] font-mono mt-4 pt-4 border-t border-[#2b2d35]">
                        STATE: <span className="text-[#61afef]">{selectedAgent.state}</span><br/>
                        TARGET POI: {selectedAgent.targetX === selectedAgent.x ? "ARRIVED" : "TRAVELLING"}
                    </div>
                </div>
                <button onClick={()=>setSelectedAgent(null)} className="m-4 p-2 bg-[#3e4451] text-white text-xs hover:bg-[#4b5263]">CLOSE</button>
            </div>
        ) : (
            <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-[#2b2d35] text-xs font-bold text-[#5c6370]">TOWN LOGS</div>
                <div className="flex-1 overflow-y-auto p-3 text-xs font-mono leading-relaxed custom-scrollbar opacity-80">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-2 break-words">
                            <span className="text-[#5c6370] mr-2">{String(logs.length-i).padStart(2,'0')}</span>
                            <span className="text-[#98c379]">{log}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}