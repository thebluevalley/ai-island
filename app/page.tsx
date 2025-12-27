'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Zap, User, MessageSquare, Clock, Cpu } from 'lucide-react';
import GameMap from './components/GameMap';

// --- Simulation Types ---
type AgentState = 'IDLE' | 'MOVING' | 'WORKING' | 'TALKING' | 'SLEEPING' | 'DECIDING';

interface Agent {
    id: number; name: string; job: string;
    x: number; y: number;
    targetX: number; targetY: number;
    homeId: number; workId: number;
    mood: string; energy: number; state: AgentState;
    speech: string | null; lastDecision: number;
}

const INITIAL_AGENTS: Agent[] = [
    { id: 1, name: "Alice", job: "Citizen", x: 20, y: 15, targetX: 20, targetY: 15, homeId: -1, workId: -1, mood: "Relaxed", energy: 90, state: 'IDLE', speech: null, lastDecision: 0 },
    { id: 2, name: "Bob", job: "Mayor", x: 90, y: 40, targetX: 90, targetY: 40, homeId: -1, workId: -1, mood: "Responsible", energy: 70, state: 'IDLE', speech: null, lastDecision: 0 },
    { id: 3, name: "Charlie", job: "Guard", x: 50, y: 20, targetX: 50, targetY: 20, homeId: -1, workId: -1, mood: "Vigilant", energy: 95, state: 'IDLE', speech: null, lastDecision: 0 },
    { id: 4, name: "Diana", job: "Doctor", x: 130, y: 60, targetX: 130, targetY: 60, homeId: -1, workId: -1, mood: "Caring", energy: 80, state: 'IDLE', speech: null, lastDecision: 0 },
    { id: 5, name: "Eve", job: "Shopkeeper", x: 160, y: 30, targetX: 160, targetY: 30, homeId: -1, workId: -1, mood: "Friendly", energy: 60, state: 'IDLE', speech: null, lastDecision: 0 },
];

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
  const [worldTime, setWorldTime] = useState(8 * 60); // 8:00 AM
  const [pois, setPois] = useState<any[]>([]); 
  const [logs, setLogs] = useState<string[]>(["Neural Matrix online.", "Waiting for POI discovery..."]);
  
  // Semaphore to limit concurrent API calls (We have 11 APIs, so we can do ~3-4 concurrent)
  const activeRequestsRef = useRef(0); 

  // --- 1. Time Loop (Physics) ---
  useEffect(() => {
    if (pois.length === 0) return;

    const timer = setInterval(() => {
        setWorldTime(prev => (prev + 1) % 1440); // 1 tick = 1 minute
        
        setAgents(prev => prev.map(a => {
            // Energy Management
            let newEnergy = a.energy;
            if (a.state === 'SLEEPING') newEnergy = Math.min(100, newEnergy + 0.2);
            else if (a.state === 'MOVING') newEnergy = Math.max(0, newEnergy - 0.05);
            
            // Movement State Logic
            let newState = a.state;
            const dist = Math.abs(a.x - a.targetX) + Math.abs(a.y - a.targetY);
            
            if (dist < 2) {
                // Arrived
                if (a.state === 'MOVING') newState = 'IDLE'; 
            } else {
                newState = 'MOVING';
            }

            return { ...a, energy: newEnergy, state: newState };
        }));
    }, 200); 

    return () => clearInterval(timer);
  }, [pois]);

  // --- 2. Map Init ---
  const handleMapReady = (mapPois: any[]) => {
    setPois(mapPois);
    const homes = mapPois.filter(p => p.type === 'RES');
    const civics = mapPois.filter(p => p.type === 'CIV');
    const shops = mapPois.filter(p => p.type === 'COM' || p.type === 'CAFE');

    setAgents(prev => prev.map((a, idx) => {
        const home = homes[idx % homes.length] || homes[0];
        let work = home;
        if (a.job === 'Mayor' || a.job === 'Doctor') work = civics[idx % civics.length] || home;
        if (a.job === 'Shopkeeper') work = shops[0] || home;
        return { ...a, homeId: home.id, workId: work.id, x: home.x, y: home.y, targetX: home.x, targetY: home.y };
    }));
    setLogs(prev => ["Map POIs Registered. Brains activating...", ...prev]);
  };

  // --- 3. The Neural Loop (Distributed LLM Control) ---
  useEffect(() => {
    if (pois.length === 0) return;

    const brainInterval = setInterval(() => {
        // If we are already saturating the 11 APIs, wait
        if (activeRequestsRef.current >= 3) return;

        // Find an agent who needs to make a decision
        // Criteria: IDLE for > 5s OR hasn't decided in 20s (stuck?)
        const now = Date.now();
        const candidate = agents.find(a => 
            (a.state === 'IDLE' && now - a.lastDecision > 5000) || 
            (now - a.lastDecision > 30000)
        );

        if (candidate) {
            triggerDecision(candidate);
        }

    }, 1000); // Check every second

    return () => clearInterval(brainInterval);
  }, [agents, pois, worldTime]);

  const triggerDecision = async (agent: Agent) => {
      activeRequestsRef.current++;
      
      // Visual indicator
      setAgents(prev => prev.map(a => a.id === agent.id ? {...a, state: 'DECIDING', speech: "🤔..."} : a));

      try {
          const hour = Math.floor(worldTime / 60);
          const timeStr = `${String(hour).padStart(2,'0')}:${String(worldTime%60).padStart(2,'0')}`;
          
          const context = `Time: ${timeStr}. Location: [${Math.floor(agent.x)}, ${Math.floor(agent.y)}]. Home ID: ${agent.homeId}, Work ID: ${agent.workId}.`;

          const res = await fetch('/api/agent-brain', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ 
                  agent, 
                  taskType: 'DECISION', 
                  context,
                  poiList: pois.map(p => ({id: p.id, type: p.type})) // Send abbreviated POI list
              })
          });

          const data = await res.json();
          const decision = data.result;

          if (data.success && decision.action === 'MOVE' && typeof decision.targetId === 'number') {
              // EXECUTE DECISION
              const targetPOI = pois.find(p => p.id === decision.targetId) || pois[0];
              
              setAgents(prev => prev.map(a => a.id === agent.id ? {
                  ...a,
                  targetX: targetPOI.x,
                  targetY: targetPOI.y,
                  speech: decision.reason || "Going...",
                  lastDecision: Date.now(),
                  state: 'MOVING'
              } : a));
              
              setLogs(prev => [`[${data.workerId}] ${agent.name}: ${decision.reason} -> POI#${decision.targetId}`, ...prev.slice(0, 10)]);
          
          } else {
              // Wait / Error
              setAgents(prev => prev.map(a => a.id === agent.id ? {
                  ...a, 
                  lastDecision: Date.now(), 
                  state: 'IDLE',
                  speech: null 
              } : a));
          }

      } catch (e) {
          console.error(e);
      } finally {
          activeRequestsRef.current--;
      }
  };

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
                 <span className="text-[#8abeb7] font-bold flex items-center gap-2"><Terminal size={14}/> NEURAL TOWN</span>
                 <span className="text-[#e5c07b] flex items-center gap-2 font-bold"><Clock size={14}/> {formatTime(worldTime)}</span>
             </div>
             <div className="flex gap-4">
                 <span className="text-[#5c6370] flex items-center gap-1"><Cpu size={12}/> BRAINS: {11} NODES</span>
                 <span className="text-[#98c379] animate-pulse">● LIVE</span>
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
                            <MessageSquare size={12}/> Current Thought
                        </div>
                        <div className="text-white text-sm font-medium leading-relaxed">"{selectedAgent.speech || "..."}"</div>
                    </div>
                    <div className="text-[10px] text-[#5c6370] font-mono mt-4 pt-4 border-t border-[#2b2d35]">
                        STATUS: <span className="text-[#61afef]">{selectedAgent.state}</span><br/>
                        HOME ID: {selectedAgent.homeId} | WORK ID: {selectedAgent.workId}
                    </div>
                </div>
                <button onClick={()=>setSelectedAgent(null)} className="m-4 p-2 bg-[#3e4451] text-white text-xs hover:bg-[#4b5263]">CLOSE</button>
            </div>
        ) : (
            <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-[#2b2d35] text-xs font-bold text-[#5c6370]">DECISION LOGS</div>
                <div className="flex-1 overflow-y-auto p-3 text-xs font-mono leading-relaxed custom-scrollbar opacity-80">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-2 break-words border-l-2 border-[#5c6370] pl-2">
                            <span className="text-[#5c6370] mr-2">{String(logs.length-i).padStart(2,'0')}</span>
                            <span className="text-[#c5c8c6]">{log}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}