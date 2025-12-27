'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Zap, User, MessageSquare } from 'lucide-react';
import GameMap from './components/GameMap';

type AgentState = 'IDLE' | 'MOVING' | 'WORKING' | 'TALKING' | 'EATING';

interface Agent {
    id: number;
    name: string;
    job: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    path: {x:number, y:number}[];
    
    // Rich Stats
    mood: string;
    energy: number;
    state: AgentState;
    speech: string | null;
    lastThought: number; // Timestamp
}

const INITIAL_AGENTS: Agent[] = [
    { id: 1, name: "Alice", job: "Citizen", x: 20, y: 15, targetX: 20, targetY: 15, path: [], mood: "Curious", energy: 80, state: 'IDLE', speech: "What a nice day!", lastThought: 0 },
    { id: 2, name: "Bob", job: "Mayor", x: 90, y: 40, targetX: 90, targetY: 40, path: [], mood: "Stressed", energy: 60, state: 'WORKING', speech: null, lastThought: 0 },
    { id: 3, name: "Charlie", job: "Guard", x: 50, y: 20, targetX: 50, targetY: 20, path: [], mood: "Vigilant", energy: 90, state: 'MOVING', speech: null, lastThought: 0 },
    { id: 4, name: "Diana", job: "Doctor", x: 130, y: 60, targetX: 130, targetY: 60, path: [], mood: "Calm", energy: 75, state: 'IDLE', speech: null, lastThought: 0 },
    { id: 5, name: "Eve", job: "Shopkeeper", x: 160, y: 30, targetX: 160, targetY: 30, path: [], mood: "Friendly", energy: 50, state: 'WORKING', speech: "Open for business!", lastThought: 0 },
];

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [tick, setTick] = useState(0);
  const [logs, setLogs] = useState<string[]>(["Simulation initialized.", "Connecting to Neural Matrix (11 APIs)..."]);
  const processingRef = useRef(false); // Lock to prevent too many API calls

  // --- 1. Physics Loop (Fast, 5 FPS) ---
  // Handles movement and energy decay. No API calls here.
  useEffect(() => {
    const timer = setInterval(() => {
        setTick(t => t + 1);
        setAgents(prev => prev.map(a => ({
            ...a,
            energy: Math.max(0, a.energy - 0.05)
        })));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // --- 2. Brain Loop (Slow, Every 3s) ---
  // Picks ONE agent to "think" using the LLM API.
  useEffect(() => {
    const brainTimer = setInterval(async () => {
        if (processingRef.current) return; // Busy
        
        // Pick an agent who hasn't thought in a while
        const now = Date.now();
        const candidates = agents.filter(a => now - a.lastThought > 10000); // At least 10s cooldown
        if (candidates.length === 0) return;
        
        const thinker = candidates[Math.floor(Math.random() * candidates.length)];
        processingRef.current = true;

        try {
            // "Thinking" indicator
            setAgents(prev => prev.map(a => a.id === thinker.id ? {...a, speech: "💭..."} : a));

            // Call our new API Route
            const res = await fetch('/api/agent-brain', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    agent: thinker,
                    taskType: 'CHAT', // Use Groq for fast speech
                    context: `You are at coordinates [${Math.floor(thinker.x)}, ${Math.floor(thinker.y)}]. Your energy is ${Math.floor(thinker.energy)}. It is daytime.`
                })
            });

            const data = await res.json();
            
            if (data.success) {
                const thought = data.result.content || "...";
                
                // Update Agent
                setAgents(prev => prev.map(a => a.id === thinker.id ? {
                    ...a, 
                    speech: thought,
                    lastThought: now,
                    mood: "Thinking" // Should ideally come from API too
                } : a));

                // Log it
                setLogs(prev => [`[API-${data.workerId}] ${thinker.name}: ${thought}`, ...prev.slice(0, 8)]);
            }
        } catch (e) {
            console.error("Brain freeze:", e);
        } finally {
            processingRef.current = false;
        }

    }, 3000); // Check every 3 seconds

    return () => clearInterval(brainTimer);
  }, [agents]);

  // Sync selection
  useEffect(() => {
    if (selectedAgent) {
        const fresh = agents.find(a => a.id === selectedAgent.id);
        if (fresh) setSelectedAgent(fresh);
    }
  }, [agents, selectedAgent]);

  return (
    <div className="h-screen w-screen bg-[#1e1f24] text-[#c5c8c6] font-mono flex overflow-hidden p-1 gap-1">
      
      {/* Map Area */}
      <div className="flex-[5] border border-[#2b2d35] flex flex-col relative bg-[#23242a]">
         <div className="h-10 border-b border-[#2b2d35] flex items-center justify-between px-4 text-xs bg-[#282a30]">
             <div className="flex gap-6">
                 <span className="text-[#8abeb7] font-bold flex items-center gap-2"><Terminal size={14}/> NEURAL_TOWN</span>
                 <span className="text-[#5c6370] flex items-center gap-2"><Activity size={14}/> TICK: {tick}</span>
             </div>
             <div className="text-[#98c379] flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-[#98c379] animate-pulse"></span>
                 BRAIN ONLINE (11 NODES)
             </div>
         </div>
         <div className="flex-1 relative overflow-hidden flex items-center justify-center">
             <GameMap 
                worldData={{ agents }} 
                onSelectAgent={setSelectedAgent} 
             />
         </div>
      </div>

      {/* Inspector Sidebar */}
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
                        <div className="text-white text-sm font-medium leading-relaxed">
                            "{selectedAgent.speech || "..."}"
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#abb2bf]">
                            <span className="flex items-center gap-1"><Zap size={12}/> ENERGY</span>
                            <span>{Math.floor(selectedAgent.energy)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#2b2d35] rounded-full overflow-hidden">
                            <div className="h-full bg-[#98c379]" style={{width: `${selectedAgent.energy}%`}}></div>
                        </div>
                    </div>
                    
                    <div className="text-[10px] text-[#5c6370] font-mono mt-4 pt-4 border-t border-[#2b2d35]">
                        ID: {selectedAgent.id} <br/>
                        COORDS: {Math.floor(selectedAgent.x)}, {Math.floor(selectedAgent.y)} <br/>
                        STATE: {selectedAgent.state}
                    </div>
                </div>
                <button onClick={()=>setSelectedAgent(null)} className="m-4 p-2 bg-[#3e4451] text-white text-xs hover:bg-[#4b5263]">CLOSE</button>
            </div>
        ) : (
            <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-[#2b2d35] text-xs font-bold text-[#5c6370]">NEURAL LOGS</div>
                <div className="flex-1 overflow-y-auto p-3 text-xs font-mono leading-relaxed custom-scrollbar opacity-80">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-2 break-words">
                            <span className="text-[#5c6370] mr-2">{String(logs.length-i).padStart(2,'0')}</span>
                            <span className={log.includes("Thinking") ? "text-[#e5c07b]" : "text-[#98c379]"}>{log}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}