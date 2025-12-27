'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 资源定义 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  ROAD_MAIN: '▒', ROAD_SUB:  '░', PATH: '·', 
  WALL: '#', DOOR: '+', FLOOR: ' ',
  CAFE_SIGN: '☕', PARK_SIGN: '♣', LIB_SIGN: '📖', HOSP_SIGN: '✚'
};

const COLORS: any = {
  BG: '#23242a', BG_GRASS: '#2b2d35', FG_GRASS: '#3e4451', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  FG_ROAD_MAIN: '#5c6370', FG_ROAD_SUB: '#4b5263', FG_PATH: '#a07e72', 
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#61afef', FG_COM_DOOR: '#56b6c2',
  FG_CIV_WALL: '#c678dd', FG_CIV_DOOR: '#e06c75',
  FG_CAFE: '#e5c07b', FG_POCKET: '#565c64', FG_TREE: '#98c379', 
  BG_BLDG: '#1e1f24', FG_AGENT: '#ffffff', BG_AGENT: '#e06c75'
};

const JOB_EMOJIS: any = {
  'Citizen': '🙍', 'Mayor': '👨‍💼', 'Guard': '👮', 'Doctor': '👩‍⚕️',
  'Shopkeeper': '🧑‍🍳', 'Teacher': '👩‍🏫', 'Artist': '🎨', 'Developer': '👨‍💻'
};

const MARGIN_X = 16; const MARGIN_Y = 10;
const BLOCK_W = 46; const BLOCK_H = 42; 
const GRID_COLS = 5; const GRID_ROWS = 2; 
const MAP_COLS = BLOCK_W * GRID_COLS + MARGIN_X * 2; 
const MAP_ROWS = BLOCK_H * GRID_ROWS + MARGIN_Y * 2; 
const HOUSE_W = 8; const HOUSE_H = 6;
const MAIN_ROAD_W = 4; const SUB_ROAD_W = 3;

const random = (x: number, y: number) => {
    let sin = Math.sin(x * 12.9898 + y * 78.233);
    return sin - Math.floor(sin);
};

// BFS Pathfinding (Optimized for performance)
const findPath = (startX: number, startY: number, endX: number, endY: number, grid: any[]) => {
    const queue = [{x: startX, y: startY, path: [] as any[]}];
    const visited = new Set();
    visited.add(`${startX},${startY}`);
    let iterations = 0;
    while(queue.length > 0 && iterations < 800) { // Reduced depth for FPS
        iterations++;
        const curr = queue.shift();
        if(!curr) break;
        if (Math.abs(curr.x - endX) < 2 && Math.abs(curr.y - endY) < 2) return curr.path;
        
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]].sort((a,b) => {
             return (Math.abs((curr.x+a[0])-endX) + Math.abs((curr.y+a[1])-endY)) - 
                    (Math.abs((curr.x+b[0])-endX) + Math.abs((curr.y+b[1])-endY));
        });

        for (let d of dirs) {
            const nx = curr.x + d[0]; const ny = curr.y + d[1];
            const key = `${nx},${ny}`;
            if (nx >= 0 && nx < MAP_COLS && ny >= 0 && ny < MAP_ROWS && !visited.has(key)) {
                const cell = grid[ny * MAP_COLS + nx];
                // Walkable areas
                const isWalkable = cell.isRoad || cell.char === CHARS.PATH || cell.char === CHARS.DOOR || cell.char === CHARS.GRASS || cell.char === CHARS.ROAD_SUB;
                if (isWalkable && !cell.isBldg) {
                    visited.add(key);
                    queue.push({x: nx, y: ny, path: [...curr.path, {x: nx, y: ny}]});
                }
            }
        }
    }
    return []; 
};

export default function GameMap({ worldData, onSelectAgent, onMapReady }: { worldData: any, onSelectAgent: (agent: any) => void, onMapReady?: (pois: any[]) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null); 
  
  const [fontSize, setFontSize] = useState(8);
  const [cellSize, setCellSize] = useState({ w: 0, h: 0 });
  const localAgentsRef = useRef<any[]>([]); // Visual state
  const { agents } = worldData || { agents: [] };

  // --- Map Generation ---
  const { grid } = useMemo(() => {
    const grid = new Array(MAP_COLS * MAP_ROWS).fill(0).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS, isRoad: false, isBldg: false 
    }));
    const pois: any[] = []; // Points of Interest

    const setCell = (x: number, y: number, char: string, fg: string, bg?: string, isRoad=false, isBldg=false) => {
        if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
            const idx = y*MAP_COLS+x;
            grid[idx] = { char, fg, bg: bg || grid[idx].bg, isRoad, isBldg };
        }
    };
    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string, isRoad=false, isBldg=false) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg, isRoad, isBldg);
    };
    const drawSmartPath = (x1: number, y1: number, x2: number, y2: number) => {
        let currX = x1, currY = y1;
        const safeSetBrush = (cx: number, cy: number) => {
            [[0,0], [1,0], [0,1], [1,1]].forEach(off => {
                const px = cx + off[0]; const py = cy + off[1];
                if(px>=0 && px<MAP_COLS && py>=0 && py<MAP_ROWS) {
                    const idx = py*MAP_COLS+px;
                    if(!grid[idx].isBldg && grid[idx].char !== CHARS.ROAD_MAIN) setCell(px, py, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS, true);
                }
            });
        };
        safeSetBrush(currX, currY);
        while(currX !== x2) { currX += (x2 > currX ? 1 : -1); safeSetBrush(currX, currY); }
        while(currY !== y2) { currY += (y2 > currY ? 1 : -1); safeSetBrush(currX, currY); }
    };
    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV' | 'CAFE', facing: string = 'DOWN') => {
        let wallColor = COLORS.FG_RES_WALL; let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }
        if (type === 'CAFE') { wallColor = COLORS.FG_CAFE; doorColor = COLORS.FG_CAFE; }
        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#222', COLORS.BG_BLDG, false, true);
        const doors = [];
        let d1x = x + Math.floor(w/2); let d1y = y + h - 1;
        if (facing === 'UP') d1y = y; else if (facing === 'DOWN') d1y = y + h - 1; else if (facing === 'LEFT') { d1x = x; d1y = y + Math.floor(h/2); } else if (facing === 'RIGHT') { d1x = x + w - 1; d1y = y + Math.floor(h/2); }
        setCell(d1x, d1y, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
        doors.push({x: d1x, y: d1y});
        if (type === 'CIV') {
            let d2x = d1x; let d2y = d1y;
            if (facing === 'UP' || facing === 'DOWN') { setCell(d1x, d1y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); d1x = x + Math.floor(w/3); d2x = x + Math.floor(2*w/3); } 
            else { setCell(d1x, d1y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); d1y = y + Math.floor(h/3); d2y = y + Math.floor(2*h/3); }
            setCell(d1x, d1y, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true); setCell(d2x, d2y, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
            doors[0] = {x: d1x, y: d1y}; doors.push({x: d2x, y: d2y});
        }
        pois.push({ type, x: d1x, y: d1y, id: pois.length }); // Register POI
        if (type === 'CAFE') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.CAFE_SIGN, COLORS.FG_CAFE, COLORS.BG_BLDG, false, true);
        if (type === 'CIV') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.LIB_SIGN, COLORS.FG_CIV_WALL, COLORS.BG_BLDG, false, true);
        return { doors }; 
    };

    // --- Draw Layout ---
    const startX = MARGIN_X; const startY = MARGIN_Y;
    for(let i=0; i<=GRID_COLS; i++) { let x = startX + i * BLOCK_W; if(i===GRID_COLS) x-=MAIN_ROAD_W; fillRect(x, startY, MAIN_ROAD_W, MAP_ROWS - MARGIN_Y*2, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true); }
    for(let i=0; i<=GRID_ROWS; i++) { let y = startY + i * BLOCK_H; if(i===GRID_ROWS) y-=MAIN_ROAD_W; fillRect(startX, y, MAP_COLS - MARGIN_X*2, MAIN_ROAD_W, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true); }
    const avenueY = startY + BLOCK_H;
    for (let bx=0; bx<GRID_COLS; bx++) { const sx = startX + bx * BLOCK_W + MAIN_ROAD_W; const sw = BLOCK_W - MAIN_ROAD_W; fillRect(sx, avenueY - MAIN_ROAD_W - 2, sw, 2, CHARS.TREE, COLORS.FG_TREE, COLORS.BG_GRASS); fillRect(sx, avenueY + 2, sw, 2, CHARS.TREE, COLORS.FG_TREE, COLORS.BG_GRASS); }

    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            const sx = startX + bx * BLOCK_W + MAIN_ROAD_W; const sy = startY + by * BLOCK_H + MAIN_ROAD_W;
            const sw = BLOCK_W - MAIN_ROAD_W; const sh = BLOCK_H - MAIN_ROAD_W; 
            const centerX = sx + Math.floor(sw/2); const centerY = sy + Math.floor(sh/2);

            if (bx === 2 && by === 0) { // Civic
                const effectiveH = sh - 4; 
                for(let iy=sy; iy<sy+effectiveH; iy++) for(let ix=sx; ix<sx+sw; ix++) if(random(ix, iy)>0.6) setCell(ix, iy, CHARS.FLOOR, '#333', COLORS.BG_GRASS);
                const quads = [{x:sx, y:sy}, {x:sx+sw/2, y:sy}, {x:sx, y:sy+effectiveH/2}, {x:sx+sw/2, y:sy+effectiveH/2}];
                for(let i=0; i<4; i++) { const q = quads[i]; const res = drawBuilding(q.x + 4, q.y + 4, 12, 10, 'CIV'); if(res) res.doors.forEach(d => { drawSmartPath(d.x, d.y+1, d.x, d.y+3); drawSmartPath(d.x, d.y+3, centerX, centerY); }); }
                drawSmartPath(centerX, centerY, centerX, sy+sh); continue;
            }
            if (bx === 2 && by === 1) { // Park
                const parkH = Math.floor(sh/2) - 4;
                for(let iy=sy+4; iy<sy+parkH; iy++) for(let ix=sx; ix<sx+sw; ix++) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                fillRect(sx+6, sy+6, sw-12, parkH-10, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                const bY = sy + Math.floor(sh/2) + 2;
                [sx+4, sx+sw-16].forEach(bxPos => { const b = drawBuilding(bxPos, bY, 12, 10, 'CIV'); if(b) b.doors.forEach(d => drawSmartPath(d.x, d.y+1, d.x, sy+sh)); });
                drawSmartPath(centerX, sy, centerX, sy+parkH); continue;
            }

            // Residential
            fillRect(sx, centerY-1, sw, SUB_ROAD_W, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            fillRect(centerX-1, sy, SUB_ROAD_W, sh, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            const rand = random(bx, by); let count = 12; if (rand < 0.2) count = 10; else if (rand < 0.4) count = 11;
            let topY = sy + 2; let bottomY = sy + sh - HOUSE_H - 2; if (by === 1) topY += 2; if (by === 0) bottomY -= 2; 
            const slots: any[] = [];
            for(let i=0; i<4; i++) slots.push({ x: sx+2 + i*9, y: topY, f: 'UP' });
            for(let i=0; i<4; i++) slots.push({ x: sx+2 + i*9, y: bottomY, f: 'DOWN' });
            const upperSideY = sy + 10; const lowerSideY = sy + sh - 16;
            if (count >= 10) { slots.push({ x: sx+2, y: upperSideY, f: 'LEFT' }); slots.push({ x: sx+sw-HOUSE_W-2, y: upperSideY, f: 'RIGHT' }); }
            if (count >= 11) slots.push({ x: sx+2, y: lowerSideY, f: 'LEFT' });
            if (count === 12) slots.push({ x: sx+sw-HOUSE_W-2, y: lowerSideY, f: 'RIGHT' });

            const builtHouses: any[] = [];
            slots.forEach(s => { const res = drawBuilding(s.x, s.y, HOUSE_W, HOUSE_H, 'RES', s.f); if (res) builtHouses.push({door: res.doors[0], facing: s.f}); });
            builtHouses.forEach(h => {
                const distTop = Math.abs(h.door.y - sy); const distBot = Math.abs(h.door.y - (sy+sh));
                const distLeft = Math.abs(h.door.x - sx); const distRight = Math.abs(h.door.x - (sx+sw));
                const minDist = Math.min(distTop, distBot, distLeft, distRight);
                if (minDist === distTop) drawSmartPath(h.door.x, h.door.y, h.door.x, sy);
                else if (minDist === distBot) drawSmartPath(h.door.x, h.door.y, h.door.x, sy+sh);
                else if (minDist === distLeft) drawSmartPath(h.door.x, h.door.y, sx, h.door.y);
                else drawSmartPath(h.door.x, h.door.y, sx+sw, h.door.y);
            });
            for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                const idx = iy*MAP_COLS+ix;
                if (grid[idx].char === CHARS.GRASS && !grid[idx].isRoad && !grid[idx].isBldg) { if (random(ix, iy) > 0.85) setCell(ix, iy, CHARS.GRASS, COLORS.FG_POCKET, COLORS.BG_GRASS); }
            }
        }
    }
    
    // Callback to parent with POIs
    if(onMapReady) setTimeout(() => onMapReady(pois), 0);

    return { grid, poiList: pois };
  }, []);

  // --- Sync State ---
  useEffect(() => {
    // Initialize Local Agents if empty
    if (localAgentsRef.current.length === 0 && agents.length > 0) {
        localAgentsRef.current = agents.map((a: any) => ({
            ...a, path: [], waitTime: 0
        }));
    }
    
    // Update Goals from Parent (High-level Brain), but Keep Position (Local Physics)
    localAgentsRef.current = localAgentsRef.current.map(localA => {
        const propA = agents.find((a: any) => a.id === localA.id);
        if (propA) {
            return {
                ...localA,
                targetX: propA.targetX, // Update Goal
                targetY: propA.targetY,
                mood: propA.mood,
                speech: propA.speech,
                job: propA.job // Keep Job updated
            };
        }
        return localA;
    });
  }, [agents]);

  // --- Game Loop (Physics) ---
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return; 
    
    const dpr = window.devicePixelRatio || 1;
    const w = containerRef.current?.clientWidth || 800;
    const h = containerRef.current?.clientHeight || 600;
    setCellSize({ w: w / MAP_COLS, h: h / MAP_ROWS });

    // Render Static BG once
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.fillStyle = COLORS.BG; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`; ctx.textBaseline = 'top';
        const cellW = (canvas.width/dpr) / MAP_COLS; const cellH = (canvas.height/dpr) / MAP_ROWS;
        grid.forEach((cell: any, idx: number) => {
            const x = (idx % MAP_COLS) * cellW; const y = Math.floor(idx / MAP_COLS) * cellH;
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, cellW+0.5, cellH+0.5); }
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y + cellH*0.15); }
        });
    }

    // Animation Loop
    const tick = () => {
        localAgentsRef.current.forEach(agent => {
            // 1. Move towards target
            if (agent.path.length === 0 && (Math.abs(agent.x - agent.targetX) > 1 || Math.abs(agent.y - agent.targetY) > 1)) {
                // Calculate path if needed
                const p = findPath(Math.round(agent.x), Math.round(agent.y), agent.targetX, agent.targetY, grid);
                if (p.length > 0) agent.path = p;
            }

            if (agent.path.length > 0) {
                const next = agent.path[0];
                const dx = next.x - agent.x;
                const dy = next.y - agent.y;
                const speed = 0.15; // Smooth speed

                if (Math.abs(dx) < speed && Math.abs(dy) < speed) {
                    agent.x = next.x; agent.y = next.y; agent.path.shift();
                } else {
                    agent.x += Math.sign(dx) * speed;
                    agent.y += Math.sign(dy) * speed;
                }
            }
        });
        // Force Re-render of HTML overlay (hacky but works for this structure)
        setCellSize(prev => ({...prev})); 
        requestAnimationFrame(tick);
    };
    
    const animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [fontSize, grid]);

  // --- HTML Overlay ---
  return (
    <div ref={containerRef} className="w-full h-full bg-[#23242a] flex items-center justify-center overflow-hidden p-4 relative">
      <canvas ref={bgCanvasRef} className="absolute inset-0 shadow-2xl m-auto" style={{width:'100%', height:'100%', objectFit:'contain'}} />
      <div className="absolute inset-0 m-auto" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        {cellSize.w > 0 && localAgentsRef.current.map((agent: any) => {
            const x = agent.x * cellSize.w; const y = agent.y * cellSize.h;
            const emoji = JOB_EMOJIS[agent.job] || '😐';
            return (
                <div key={agent.id} onClick={() => onSelectAgent(agent)}
                    className="absolute cursor-pointer transition-transform duration-100 ease-linear hover:z-50 group"
                    style={{ left: x, top: y, width: cellSize.w * 1.5, height: cellSize.h * 1.5, fontSize: fontSize * 1.8, lineHeight: 1, transform: 'translate(-25%, -25%)' }}>
                    <div className="relative z-10">{emoji}</div>
                    {(agent.speech || agent.isHovered) && (
                        <div className="absolute left-1/2 bottom-full mb-1 -translate-x-1/2 w-40 bg-white text-black p-2 rounded-lg shadow-xl text-[10px] z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity font-sans leading-tight border border-gray-200">
                            {agent.speech || "..."}
                            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white"></div>
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
}