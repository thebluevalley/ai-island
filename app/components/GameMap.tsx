'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  ROAD_MAIN: '▒', // 主路实心
  ROAD_SUB:  '░', // 内部宽路
  PATH:      '·', // 入户细路
  WALL: '#', DOOR: '+', FLOOR: ' ',
  CAFE_SIGN: '☕', PARK_SIGN: '♣', LIB_SIGN: '📖', HOSP_SIGN: '✚'
};

// --- 2. 配色 ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#3e4451', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  FG_ROAD_MAIN: '#5c6370', 
  FG_ROAD_SUB:  '#4b5263', 
  FG_PATH:      '#8d6e63', 

  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#61afef', FG_COM_DOOR: '#56b6c2',
  FG_CIV_WALL: '#c678dd', FG_CIV_DOOR: '#e06c75',
  FG_CAFE:     '#e5c07b', 
  
  // 绿化微调
  FG_POCKET:   '#565c64', // 极简草点颜色 (深灰绿)
  FG_TREE:     '#98c379', // 大树颜色 (只在公园/大道)
  
  BG_BLDG:     '#1e1f24', 
  FG_AGENT: '#ffffff', BG_AGENT: '#e06c75'
};

// 5x2 网格
const MARGIN_X = 16; 
const MARGIN_Y = 10;
const BLOCK_W = 46; 
const BLOCK_H = 42; 
const GRID_COLS = 5; 
const GRID_ROWS = 2; 

const MAP_COLS = BLOCK_W * GRID_COLS + MARGIN_X * 2; 
const MAP_ROWS = BLOCK_H * GRID_ROWS + MARGIN_Y * 2; 

const HOUSE_W = 8;
const HOUSE_H = 6;
const MAIN_ROAD_W = 4;
const SUB_ROAD_W = 3; // 加宽内部道路

const random = (x: number, y: number) => {
    let sin = Math.sin(x * 12.9898 + y * 78.233);
    return sin - Math.floor(sin);
};

// BFS Pathfinding
const findPath = (startX: number, startY: number, endX: number, endY: number, grid: any[]) => {
    const queue = [{x: startX, y: startY, path: [] as any[]}];
    const visited = new Set();
    visited.add(`${startX},${startY}`);
    let iterations = 0;
    while(queue.length > 0 && iterations < 1500) {
        iterations++;
        const curr = queue.shift();
        if(!curr) break;
        if (Math.abs(curr.x - endX) < 2 && Math.abs(curr.y - endY) < 2) return curr.path;
        
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]].sort((a,b) => {
             return (Math.abs((curr.x+a[0])-endX) + Math.abs((curr.y+a[1])-endY)) - 
                    (Math.abs((curr.x+b[0])-endX) + Math.abs((curr.y+b[1])-endY));
        });

        for (let d of dirs) {
            const nx = curr.x + d[0];
            const ny = curr.y + d[1];
            const key = `${nx},${ny}`;
            if (nx >= 0 && nx < MAP_COLS && ny >= 0 && ny < MAP_ROWS && !visited.has(key)) {
                const cell = grid[ny * MAP_COLS + nx];
                // Allow walking on SUB_ROAD and GRASS now
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

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null); 
  const fgCanvasRef = useRef<HTMLCanvasElement>(null); 
  
  const [fontSize, setFontSize] = useState(8);
  const agentsRef = useRef<any[]>([]);
  const frameIdRef = useRef<number>(0);

  const { agents } = worldData || { agents: [] };

  const { grid, poiList } = useMemo(() => {
    const grid = new Array(MAP_COLS * MAP_ROWS).fill(0).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS, isRoad: false, isBldg: false
    }));
    const buildingsRegistry: any[] = [];

    const setCell = (x: number, y: number, char: string, fg: string, bg?: string, isRoad=false, isBldg=false) => {
        if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
            const idx = y*MAP_COLS+x;
            grid[idx].char = char; grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
            if(isRoad) grid[idx].isRoad = true;
            if(isBldg) grid[idx].isBldg = true;
        }
    };

    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string, isRoad=false, isBldg=false) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg, isRoad, isBldg);
    };

    // Smart Path: Avoids Buildings, connects to Roads
    const drawSmartPath = (x1: number, y1: number, x2: number, y2: number) => {
        let currX = x1, currY = y1;
        const safeSet = (x: number, y: number) => {
            if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
                const idx = y*MAP_COLS+x;
                // Don't overwrite Buildings or Main Roads
                if(!grid[idx].isBldg && grid[idx].char !== CHARS.ROAD_MAIN) {
                    setCell(x, y, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS, true);
                }
            }
        };
        while(currX !== x2) { currX += (x2 > currX ? 1 : -1); safeSet(currX, currY); }
        while(currY !== y2) { currY += (y2 > currY ? 1 : -1); safeSet(currX, currY); }
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV' | 'CAFE', facing: string = 'DOWN') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }
        if (type === 'CAFE') { wallColor = COLORS.FG_CAFE; doorColor = COLORS.FG_CAFE; }

        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#222', COLORS.BG_BLDG, false, true);
        
        const doors = [];
        let d1x = x + Math.floor(w/2);
        let d1y = y + h - 1;
        
        if (facing === 'UP') { d1y = y; }
        else if (facing === 'DOWN') { d1y = y + h - 1; }
        else if (facing === 'LEFT') { d1x = x; d1y = y + Math.floor(h/2); }
        else if (facing === 'RIGHT') { d1x = x + w - 1; d1y = y + Math.floor(h/2); }
        
        setCell(d1x, d1y, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
        doors.push({x: d1x, y: d1y});

        if (type === 'CIV') {
            let d2x = d1x; let d2y = d1y;
            if (facing === 'UP' || facing === 'DOWN') {
                setCell(d1x, d1y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); 
                d1x = x + Math.floor(w/3); d2x = x + Math.floor(2*w/3);
            } else {
                setCell(d1x, d1y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); 
                d1y = y + Math.floor(h/3); d2y = y + Math.floor(2*h/3);
            }
            setCell(d1x, d1y, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
            setCell(d2x, d2y, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
            doors[0] = {x: d1x, y: d1y}; 
            doors.push({x: d2x, y: d2y}); 
        }

        buildingsRegistry.push({ type, x, y, w, h, doorX: d1x, doorY: d1y, id: buildingsRegistry.length });
        if (type === 'CAFE') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.CAFE_SIGN, COLORS.FG_CAFE, COLORS.BG_BLDG, false, true);
        if (type === 'CIV') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.LIB_SIGN, COLORS.FG_CIV_WALL, COLORS.BG_BLDG, false, true);

        return { doors }; 
    };

    // === 1. Draw Main Infrastructure ===
    const startX = MARGIN_X;
    const startY = MARGIN_Y;

    // Main Roads
    for(let i=0; i<=GRID_COLS; i++) {
        let x = startX + i * BLOCK_W; if(i===GRID_COLS) x-=MAIN_ROAD_W;
        fillRect(x, startY, MAIN_ROAD_W, MAP_ROWS - MARGIN_Y*2, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let i=0; i<=GRID_ROWS; i++) {
        let y = startY + i * BLOCK_H; if(i===GRID_ROWS) y-=MAIN_ROAD_W;
        fillRect(startX, y, MAP_COLS - MARGIN_X*2, MAIN_ROAD_W, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // Formal Green Boulevard (Trees Only Here)
    const avenueY = startY + BLOCK_H;
    for (let bx=0; bx<GRID_COLS; bx++) {
        const sx = startX + bx * BLOCK_W + MAIN_ROAD_W;
        const sw = BLOCK_W - MAIN_ROAD_W;
        fillRect(sx, avenueY - MAIN_ROAD_W - 2, sw, 2, CHARS.TREE, COLORS.FG_TREE, COLORS.BG_GRASS);
        fillRect(sx, avenueY + 2, sw, 2, CHARS.TREE, COLORS.FG_TREE, COLORS.BG_GRASS);
    }

    // === 2. Block Filling ===
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            const sx = startX + bx * BLOCK_W + MAIN_ROAD_W;
            const sy = startY + by * BLOCK_H + MAIN_ROAD_W;
            const sw = BLOCK_W - MAIN_ROAD_W; 
            const sh = BLOCK_H - MAIN_ROAD_W; 
            const centerX = sx + Math.floor(sw/2);
            const centerY = sy + Math.floor(sh/2);

            // SPECIAL 1: Civic Center
            if (bx === 2 && by === 0) {
                const effectiveH = sh - 4; 
                for(let iy=sy; iy<sy+effectiveH; iy++) for(let ix=sx; ix<sx+sw; ix++) if(random(ix, iy)>0.6) setCell(ix, iy, CHARS.FLOOR, '#333', COLORS.BG_GRASS);
                const quads = [{x:sx, y:sy}, {x:sx+sw/2, y:sy}, {x:sx, y:sy+effectiveH/2}, {x:sx+sw/2, y:sy+effectiveH/2}];
                for(let i=0; i<4; i++) {
                    const q = quads[i];
                    const res = drawBuilding(q.x + 4, q.y + 4, 12, 10, 'CIV');
                    if(res) res.doors.forEach(d => { drawSmartPath(d.x, d.y+1, d.x, d.y+3); drawSmartPath(d.x, d.y+3, centerX, centerY); });
                }
                drawSmartPath(centerX, centerY, centerX, sy+sh); 
                continue;
            }

            // SPECIAL 2: Park
            if (bx === 2 && by === 1) {
                const parkH = Math.floor(sh/2) - 4;
                for(let iy=sy+4; iy<sy+parkH; iy++) for(let ix=sx; ix<sx+sw; ix++) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                fillRect(sx+6, sy+6, sw-12, parkH-10, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                const bY = sy + Math.floor(sh/2) + 2;
                [sx+4, sx+sw-16].forEach(bxPos => {
                    const b = drawBuilding(bxPos, bY, 12, 10, 'CIV');
                    if(b) b.doors.forEach(d => drawSmartPath(d.x, d.y+1, d.x, sy+sh));
                });
                drawSmartPath(centerX, sy, centerX, sy+parkH);
                continue;
            }

            // === RESIDENTIAL: STRICT 12/11/10 MODES ===
            
            // 1. Draw Internal Roads FIRST (Wider: 3px)
            // This defines the "No Build Zone"
            fillRect(sx, centerY-1, sw, SUB_ROAD_W, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            fillRect(centerX-1, sy, SUB_ROAD_W, sh, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            
            const rand = random(bx, by);
            let count = 12; // Majority
            if (rand < 0.2) count = 10;
            else if (rand < 0.4) count = 11;

            let topY = sy + 2;
            let bottomY = sy + sh - HOUSE_H - 2;
            if (by === 1) topY += 2; // Tree buffer
            if (by === 0) bottomY -= 2; 

            const slots: {x: number, y: number, f: string}[] = [];

            // BASE: 8 Houses (Top 4 + Bottom 4)
            for(let i=0; i<4; i++) slots.push({ x: sx+2 + i*9, y: topY, f: 'UP' });
            for(let i=0; i<4; i++) slots.push({ x: sx+2 + i*9, y: bottomY, f: 'DOWN' });

            // SIDES: Add based on count
            // Side slots are positioned safely between the top/bottom rows and the center road
            const upperSideY = sy + 10;
            const lowerSideY = sy + sh - 16;

            if (count >= 10) {
                // Add Upper Left & Upper Right
                slots.push({ x: sx+2, y: upperSideY, f: 'LEFT' });
                slots.push({ x: sx+sw-HOUSE_W-2, y: upperSideY, f: 'RIGHT' });
            }
            if (count >= 11) {
                // Add Lower Left
                slots.push({ x: sx+2, y: lowerSideY, f: 'LEFT' });
            }
            if (count === 12) {
                // Add Lower Right
                slots.push({ x: sx+sw-HOUSE_W-2, y: lowerSideY, f: 'RIGHT' });
            }

            // 2. Build Houses (Overwriting grass, but checked coordinates ensure no road overlap)
            const builtHouses: any[] = [];
            slots.forEach(s => {
                const res = drawBuilding(s.x, s.y, HOUSE_W, HOUSE_H, 'RES', s.f);
                if (res) builtHouses.push({door: res.doors[0], facing: s.f});
            });

            // 3. Smart Paths
            builtHouses.forEach(h => {
                const distTop = Math.abs(h.door.y - sy);
                const distBot = Math.abs(h.door.y - (sy+sh));
                const distLeft = Math.abs(h.door.x - sx);
                const distRight = Math.abs(h.door.x - (sx+sw));
                const minDist = Math.min(distTop, distBot, distLeft, distRight);
                
                if (minDist === distTop) drawSmartPath(h.door.x, h.door.y, h.door.x, sy);
                else if (minDist === distBot) drawSmartPath(h.door.x, h.door.y, h.door.x, sy+sh);
                else if (minDist === distLeft) drawSmartPath(h.door.x, h.door.y, sx, h.door.y);
                else drawSmartPath(h.door.x, h.door.y, sx+sw, h.door.y);
            });

            // 4. MICRO-GREENERY (No Trees, just Grass dots)
            for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                const idx = iy*MAP_COLS+ix;
                const cell = grid[idx];
                // Only on empty grass
                if (cell.char === CHARS.GRASS && !cell.isRoad && !cell.isBldg) {
                    // Very sparse, only use CHARS.GRASS (small dot), never TREE inside residential
                    if (random(ix, iy) > 0.85) {
                        setCell(ix, iy, CHARS.GRASS, COLORS.FG_POCKET, COLORS.BG_GRASS);
                    }
                }
            }
        }
    }

    return { grid, poiList: buildingsRegistry };
  }, []);

  // --- Agents & Rendering (Unchanged) ---
  useEffect(() => {
    if (agents.length > 0 && poiList.length > 0) {
        const homes = poiList.filter(b => b.type === 'RES');
        const shops = poiList.filter(b => b.type !== 'RES');
        agentsRef.current = agents.map((agent: any, idx: number) => {
            const home = homes[idx % homes.length] || homes[0];
            const target = (Math.random() > 0.5 && shops.length > 0) ? shops[Math.floor(Math.random()*shops.length)] : home;
            return {
                ...agent, x: home.doorX, y: home.doorY, targetX: target.doorX, targetY: target.doorY, path: [], lastUpdate: Date.now()
            };
        });
    }
  }, [agents, poiList]);

  useEffect(() => {
    const canvas = fgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_COLS * fontSize * 0.6 * dpr;
    canvas.height = MAP_ROWS * fontSize * dpr;
    const cellW = (canvas.width/dpr) / MAP_COLS;
    const cellH = (canvas.height/dpr) / MAP_ROWS;

    const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        const now = Date.now();
        agentsRef.current.forEach(agent => {
            if (now - agent.lastUpdate > 100) { 
                agent.lastUpdate = now;
                if (Math.abs(agent.x - agent.targetX) < 1 && Math.abs(agent.y - agent.targetY) < 1) {
                    const dests = poiList;
                    const next = dests[Math.floor(Math.random() * dests.length)];
                    agent.targetX = next.doorX; agent.targetY = next.doorY; agent.path = [];
                }
                if (agent.path.length === 0) {
                    const p = findPath(agent.x, agent.y, agent.targetX, agent.targetY, grid);
                    if (p.length > 0) agent.path = p;
                }
                if (agent.path.length > 0) {
                    const step = agent.path.shift(); agent.x = step.x; agent.y = step.y;
                }
            }
            const x = agent.x * cellW; const y = agent.y * cellH;
            ctx.fillStyle = COLORS.BG_AGENT; ctx.fillRect(x, y, cellW, cellH);
            ctx.fillStyle = COLORS.FG_AGENT; ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
            ctx.fillText('@', x, y + cellH*0.15);
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        frameIdRef.current = requestAnimationFrame(render);
    };
    frameIdRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [fontSize, grid, poiList]);

  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_COLS * fontSize * 0.6 * dpr;
    canvas.height = MAP_ROWS * fontSize * dpr;
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
  }, [fontSize, grid]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            const charW = width / MAP_COLS;
            const charH = height / MAP_ROWS;
            const size = Math.floor(Math.min(charW / 0.6, charH));
            setFontSize(Math.max(4, size));
        }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#23242a] flex items-center justify-center overflow-hidden p-4 relative">
      <canvas ref={bgCanvasRef} className="absolute inset-0 shadow-2xl m-auto" style={{width:'100%', height:'100%', objectFit:'contain'}} />
      <canvas ref={fgCanvasRef} className="absolute inset-0 m-auto" style={{width:'100%', height:'100%', objectFit:'contain'}} />
    </div>
  );
}