'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  ROAD_MAIN: '▒', ROAD_SUB:  '░', PATH: '·', 
  WALL: '#', DOOR: '+', FLOOR: ' ',
  CAFE_SIGN: '☕', PARK_SIGN: '♣', LIB_SIGN: '📖', HOSP_SIGN: '✚'
};

// --- 2. 配色 ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#3e4451', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  FG_ROAD_MAIN: '#5c6370', FG_ROAD_SUB: '#4b5263', FG_PATH: '#8d6e63', 
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#61afef', FG_COM_DOOR: '#56b6c2',
  FG_CIV_WALL: '#c678dd', FG_CIV_DOOR: '#e06c75',
  FG_CAFE:     '#e5c07b', FG_POCKET: '#98c379', 
  BG_BLDG:     '#1e1f24', 
  FG_AGENT: '#ffffff', BG_AGENT: '#e06c75'
};

// 5x2 网格
const MARGIN_X = 14; 
const MARGIN_Y = 8;
const BLOCK_W = 46; 
const BLOCK_H = 42; 
const GRID_COLS = 5; 
const GRID_ROWS = 2; 

const MAP_COLS = BLOCK_W * GRID_COLS + MARGIN_X * 2; 
const MAP_ROWS = BLOCK_H * GRID_ROWS + MARGIN_Y * 2; 

// 房屋尺寸
const HOUSE_W = 8;
const HOUSE_H = 6;
const MAIN_ROAD_W = 4;
const SUB_ROAD_W = 2;

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
    while(queue.length > 0 && iterations < 2000) {
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
                const isWalkable = cell.isRoad || cell.char === CHARS.PATH || cell.char === CHARS.DOOR || cell.char === CHARS.GRASS;
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

    const drawPath = (x1: number, y1: number, x2: number, y2: number) => {
        let currX = x1, currY = y1;
        const safeSet = (x: number, y: number) => {
            if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
                const idx = y*MAP_COLS+x;
                if(!grid[idx].isRoad && !grid[idx].isBldg) setCell(x, y, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS);
            }
        };
        while(currX !== x2) { currX += (x2 > currX ? 1 : -1); safeSet(currX, currY); }
        while(currY !== y2) { currY += (y2 > currY ? 1 : -1); safeSet(currX, currY); }
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV' | 'CAFE', facing: string = 'DOWN') => {
        // Strict Collision Check
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) {
            const idx = iy*MAP_COLS+ix;
            if(ix>=MAP_COLS || iy>=MAP_ROWS || grid[idx]?.isBldg || grid[idx]?.isRoad) return null; 
        }

        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }
        if (type === 'CAFE') { wallColor = COLORS.FG_CAFE; doorColor = COLORS.FG_CAFE; }

        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#222', COLORS.BG_BLDG, false, true);
        
        let doorX = x + Math.floor(w/2);
        let doorY = y + h - 1;
        if (facing === 'UP') { doorY = y; }
        else if (facing === 'DOWN') { doorY = y + h - 1; }
        else if (facing === 'LEFT') { doorX = x; doorY = y + Math.floor(h/2); }
        else if (facing === 'RIGHT') { doorX = x + w - 1; doorY = y + Math.floor(h/2); }

        setCell(doorX, doorY, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
        buildingsRegistry.push({ type, x, y, w, h, doorX, doorY, id: buildingsRegistry.length });
        if (type === 'CAFE') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.CAFE_SIGN, COLORS.FG_CAFE, COLORS.BG_BLDG, false, true);
        if (type === 'CIV') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.LIB_SIGN, COLORS.FG_CIV_WALL, COLORS.BG_BLDG, false, true);
        return { doorX, doorY }; 
    };

    // === 1. Draw Infrastructure ===
    const startX = MARGIN_X;
    const startY = MARGIN_Y;

    // Roads
    for(let i=0; i<=GRID_COLS; i++) {
        let x = startX + i * BLOCK_W; if(i===GRID_COLS) x-=MAIN_ROAD_W;
        fillRect(x, startY, MAIN_ROAD_W, MAP_ROWS - MARGIN_Y*2, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let i=0; i<=GRID_ROWS; i++) {
        let y = startY + i * BLOCK_H; if(i===GRID_ROWS) y-=MAIN_ROAD_W;
        fillRect(startX, y, MAP_COLS - MARGIN_X*2, MAIN_ROAD_W, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // Green Boulevard
    const avenueY = startY + BLOCK_H;
    for (let bx=0; bx<GRID_COLS; bx++) {
        const sx = startX + bx * BLOCK_W + MAIN_ROAD_W;
        const sw = BLOCK_W - MAIN_ROAD_W;
        for(let ix=sx; ix<sx+sw; ix++) {
            if(random(ix, avenueY)>0.1) setCell(ix, avenueY - MAIN_ROAD_W - 2, CHARS.TREE, COLORS.FG_POCKET, COLORS.BG_GRASS);
            if(random(ix, avenueY)>0.1) setCell(ix, avenueY + 2, CHARS.TREE, COLORS.FG_POCKET, COLORS.BG_GRASS);
        }
    }

    // === 2. Block Filling ===
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            const sx = startX + bx * BLOCK_W + MAIN_ROAD_W;
            const sy = startY + by * BLOCK_H + MAIN_ROAD_W;
            const sw = BLOCK_W - MAIN_ROAD_W; // ~42
            const sh = BLOCK_H - MAIN_ROAD_W; // ~38
            const centerX = sx + Math.floor(sw/2);
            const centerY = sy + Math.floor(sh/2);

            // SPECIAL: Civic Center (2,0)
            if (bx === 2 && by === 0) {
                const effectiveH = sh - 4; 
                for(let iy=sy; iy<sy+effectiveH; iy++) for(let ix=sx; ix<sx+sw; ix++) 
                    if(random(ix, iy)>0.6) setCell(ix, iy, CHARS.FLOOR, '#333', COLORS.BG_GRASS);
                const quads = [{x:sx, y:sy}, {x:sx+sw/2, y:sy}, {x:sx, y:sy+effectiveH/2}, {x:sx+sw/2, y:sy+effectiveH/2}];
                for(let i=0; i<4; i++) {
                    const q = quads[i];
                    const res = drawBuilding(q.x + 4, q.y + 4, 12, 10, 'CIV');
                    if(res) { drawPath(res.doorX, res.doorY+1, res.doorX, res.doorY+2); drawPath(res.doorX, res.doorY+2, centerX, centerY); }
                }
                drawPath(centerX, centerY, centerX, sy+sh); 
                continue;
            }

            // SPECIAL: Park (2,1)
            if (bx === 2 && by === 1) {
                const parkH = Math.floor(sh/2);
                for(let iy=sy+4; iy<sy+parkH; iy++) for(let ix=sx; ix<sx+sw; ix++) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                fillRect(sx+6, sy+6, sw-12, parkH-10, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                const bY = sy + parkH + 2;
                const b1 = drawBuilding(sx + 4, bY, 12, 10, 'CIV');
                if(b1) drawPath(b1.doorX, b1.doorY+1, b1.doorX, sy+sh);
                const b2 = drawBuilding(sx + sw - 16, bY, 12, 10, 'CIV');
                if(b2) drawPath(b2.doorX, b2.doorY+1, b2.doorX, sy+sh);
                drawPath(centerX, sy, centerX, sy+parkH);
                continue;
            }

            // === RESIDENTIAL (Forced Population) ===
            // Internal Road
            const midX = Math.floor(sx + sw/2);
            const midY = Math.floor(sy + sh/2);
            // Draw internal roads (2 wide)
            fillRect(sx, midY, sw, SUB_ROAD_W, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            fillRect(midX, sy, SUB_ROAD_W, sh, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            setCell(midX, midY, CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);

            const isDense = random(bx, by) > 0.5; // 50% dense blocks
            
            // Adjust y-offsets for green belts
            let topY = sy + 2;
            let bottomY = sy + sh - HOUSE_H - 2;
            if (by === 0) bottomY -= 4; 
            if (by === 1) topY += 4;    

            const slots: {x: number, y: number, f: string, cy?: number, cx?: number}[] = [];

            // Define Slots STRICTLY (No randomness in generation)
            if (isDense) {
                // Layout: 12 Houses
                // Top: 4
                slots.push({ x: sx+1, y: topY, f: 'UP', cy: sy });
                slots.push({ x: sx+1 + 10, y: topY, f: 'UP', cy: sy });
                slots.push({ x: sx+1 + 20, y: topY, f: 'UP', cy: sy });
                slots.push({ x: sx+1 + 30, y: topY, f: 'UP', cy: sy });
                // Bottom: 4
                slots.push({ x: sx+1, y: bottomY, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+1 + 10, y: bottomY, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+1 + 20, y: bottomY, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+1 + 30, y: bottomY, f: 'DOWN', cy: sy+sh });
                // Left: 2 (Vertical stack)
                slots.push({ x: sx+2, y: sy + 10, f: 'LEFT', cx: sx });
                slots.push({ x: sx+2, y: sy + sh - 16, f: 'LEFT', cx: sx });
                // Right: 2
                slots.push({ x: sx+sw-HOUSE_W-2, y: sy + 10, f: 'RIGHT', cx: sx+sw });
                slots.push({ x: sx+sw-HOUSE_W-2, y: sy + sh - 16, f: 'RIGHT', cx: sx+sw });
            } else {
                // Layout: 8 Houses (Spread out)
                // Top: 3
                slots.push({ x: sx+2, y: topY, f: 'UP', cy: sy });
                slots.push({ x: sx+sw/2-HOUSE_W/2, y: topY, f: 'UP', cy: sy });
                slots.push({ x: sx+sw-HOUSE_W-2, y: topY, f: 'UP', cy: sy });
                // Bottom: 3
                slots.push({ x: sx+2, y: bottomY, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+sw/2-HOUSE_W/2, y: bottomY, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+sw-HOUSE_W-2, y: bottomY, f: 'DOWN', cy: sy+sh });
                // Left: 1
                slots.push({ x: sx+2, y: midY - HOUSE_H/2, f: 'LEFT', cx: sx });
                // Right: 1
                slots.push({ x: sx+sw-HOUSE_W-2, y: midY - HOUSE_H/2, f: 'RIGHT', cx: sx+sw });
            }

            // Build ALL slots
            slots.forEach(s => {
                const res = drawBuilding(s.x, s.y, HOUSE_W, HOUSE_H, 'RES', s.f);
                if (res) {
                    if (s.f === 'UP' || s.f === 'DOWN') drawPath(res.doorX, res.doorY, res.doorX, s.cy!);
                    else drawPath(res.doorX, res.doorY, s.cx!, res.doorY);
                } else {
                    // Fallback: If blocked, try nudging slightly
                    const res2 = drawBuilding(s.x+1, s.y, HOUSE_W, HOUSE_H, 'RES', s.f);
                    if(res2) {
                         if (s.f === 'UP' || s.f === 'DOWN') drawPath(res2.doorX, res2.doorY, res2.doorX, s.cy!);
                         else drawPath(res2.doorX, res2.doorY, s.cx!, res2.doorY);
                    }
                }
            });
        }
    }

    return { grid, poiList: buildingsRegistry };
  }, []);

  // --- Agents ---
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

  // --- Static BG ---
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

  // Resize
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