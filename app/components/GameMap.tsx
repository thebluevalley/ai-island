'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  ROAD_MAIN: '▒', // 宽马路纹理
  ROAD_SUB:  '░', 
  PATH:      '·', 
  WALL: '#', DOOR: '+', FLOOR: ' ',
  CAFE_SIGN: '☕', PARK_SIGN: '♣', LIB_SIGN: '📖', HOSP_SIGN: '✚'
};

// --- 2. 配色 ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#3e4451', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  // 道路系统
  FG_ROAD_MAIN: '#5c6370', 
  FG_ROAD_SUB:  '#4b5263', 
  FG_PATH:      '#8d6e63', 

  // 建筑
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#61afef', FG_COM_DOOR: '#56b6c2',
  FG_CIV_WALL: '#c678dd', FG_CIV_DOOR: '#e06c75',
  
  FG_CAFE:     '#e5c07b', FG_POCKET: '#98c379', 
  BG_BLDG:     '#1e1f24', 
  
  // Agent
  FG_AGENT: '#ffffff', BG_AGENT: '#e06c75'
};

// === 核心修改：5x2 网格 + 宽边距 ===
const MARGIN_X = 14; // 四周空地加宽
const MARGIN_Y = 8;
const BLOCK_W = 46; 
const BLOCK_H = 42; 
const GRID_COLS = 5; // 5列
const GRID_ROWS = 2; // 2行

const MAP_COLS = BLOCK_W * GRID_COLS + MARGIN_X * 2; 
const MAP_ROWS = BLOCK_H * GRID_ROWS + MARGIN_Y * 2; 

// 房屋尺寸
const HOUSE_W = 8;
const HOUSE_H = 6;

// 道路宽度
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
    while(queue.length > 0 && iterations < 3000) {
        iterations++;
        const curr = queue.shift();
        if(!curr) break;
        if (Math.abs(curr.x - endX) < 2 && Math.abs(curr.y - endY) < 2) return curr.path;
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(8);
  
  const [simAgents, setSimAgents] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);

  const { agents } = worldData || { agents: [] };

  // --- Map Generation ---
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
                if(!grid[idx].isRoad && !grid[idx].isBldg) 
                    setCell(x, y, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS);
            }
        };
        while(currX !== x2) { currX += (x2 > currX ? 1 : -1); safeSet(currX, currY); }
        while(currY !== y2) { currY += (y2 > currY ? 1 : -1); safeSet(currX, currY); }
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV' | 'CAFE', facing: string = 'DOWN') => {
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
        
        const building = { type, x, y, w, h, doorX, doorY, id: buildingsRegistry.length };
        buildingsRegistry.push(building);

        if (type === 'CAFE') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.CAFE_SIGN, COLORS.FG_CAFE, COLORS.BG_BLDG, false, true);
        if (type === 'CIV') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.LIB_SIGN, COLORS.FG_CIV_WALL, COLORS.BG_BLDG, false, true);

        return { doorX, doorY }; 
    };

    // === 1. Draw Infrastructure (Roads) ===
    const startX = MARGIN_X;
    const startY = MARGIN_Y;

    // Grid Roads
    for(let i=0; i<=GRID_COLS; i++) {
        let x = startX + i * BLOCK_W; 
        if(i===GRID_COLS) x-=MAIN_ROAD_W;
        fillRect(x, startY, MAIN_ROAD_W, MAP_ROWS - MARGIN_Y*2, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let i=0; i<=GRID_ROWS; i++) {
        let y = startY + i * BLOCK_H; 
        if(i===GRID_ROWS) y-=MAIN_ROAD_W;
        fillRect(startX, y, MAP_COLS - MARGIN_X*2, MAIN_ROAD_W, CHARS.ROAD_MAIN, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // === 2. Zoning Logic (5x2 Grid) ===
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            const sx = startX + bx * BLOCK_W + MAIN_ROAD_W;
            const sy = startY + by * BLOCK_H + MAIN_ROAD_W;
            const sw = BLOCK_W - MAIN_ROAD_W; 
            const sh = BLOCK_H - MAIN_ROAD_W; 
            const centerX = sx + Math.floor(sw/2);
            const centerY = sy + Math.floor(sh/2);

            // --- SPECIAL BLOCK 1: CIVIC CENTER (4 Buildings) ---
            // Located at (2, 0) - Center Top
            if (bx === 2 && by === 0) {
                // Pave the plaza
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) 
                    if(random(ix, iy)>0.5) setCell(ix, iy, CHARS.FLOOR, '#333', COLORS.BG_GRASS);

                // 4 Large Buildings
                const quads = [{x:sx, y:sy}, {x:sx+sw/2, y:sy}, {x:sx, y:sy+sh/2}, {x:sx+sw/2, y:sy+sh/2}];
                for(let i=0; i<4; i++) {
                    const q = quads[i];
                    const bW = 14; const bH = 10;
                    const bX = q.x + Math.floor((sw/2 - bW)/2);
                    const bY = q.y + Math.floor((sh/2 - bH)/2);
                    const res = drawBuilding(bX, bY, bW, bH, 'CIV');
                    if(res) {
                        drawPath(res.doorX, res.doorY+1, res.doorX, res.doorY+3);
                        drawPath(res.doorX, res.doorY+3, centerX, centerY);
                    }
                }
                // Connect plaza to main road
                drawPath(centerX, centerY, centerX, sy+sh);
                continue;
            }

            // --- SPECIAL BLOCK 2: MIXED PARK/CIVIC (Half/Half) ---
            // Located at (2, 1) - Center Bottom
            if (bx === 2 && by === 1) {
                // Left Half: Park
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw/2; ix++) {
                    setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                fillRect(sx+4, sy+6, sw/2-8, sh-12, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);

                // Right Half: 2 Civic Buildings
                const rightX = sx + sw/2;
                const topY = sy;
                const bottomY = sy + sh/2;
                
                // Bldg 1 (Top Right)
                const b1 = drawBuilding(rightX + 4, topY + 4, 12, 10, 'CIV');
                if(b1) drawPath(b1.doorX, b1.doorY+1, b1.doorX, centerY);

                // Bldg 2 (Bottom Right)
                const b2 = drawBuilding(rightX + 4, bottomY + 4, 12, 10, 'CIV');
                if(b2) drawPath(b2.doorX, b2.doorY+1, b2.doorX, centerY);
                
                // Path connecting park and buildings
                drawPath(centerX, centerY, centerX, sy);
                continue;
            }

            // --- RESIDENTIAL BLOCKS (The remaining 8 blocks) ---
            // Draw Internal Road
            const midX = Math.floor(sx + sw/2);
            const midY = Math.floor(sy + sh/2);
            fillRect(sx, midY, sw, SUB_ROAD_W, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            fillRect(midX, sy, SUB_ROAD_W, sh, CHARS.ROAD_SUB, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
            setCell(midX, midY, CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);

            // Decide Density: 30% Dense (12), 70% Standard (8)
            const isDense = random(bx, by) > 0.7;
            const slots: {x: number, y: number, f: string, cy?: number, cx?: number}[] = [];

            if (isDense) {
                // 12 Houses
                for(let i=0; i<4; i++) slots.push({ x: sx+2 + i*9, y: sy+2, f: 'UP', cy: sy });
                for(let i=0; i<4; i++) slots.push({ x: sx+2 + i*9, y: sy+sh-HOUSE_H-2, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+2, y: sy+HOUSE_H+3, f: 'LEFT', cx: sx });
                slots.push({ x: sx+2, y: sy+sh-HOUSE_H*2-4, f: 'LEFT', cx: sx });
                slots.push({ x: sx+sw-HOUSE_W-2, y: sy+HOUSE_H+3, f: 'RIGHT', cx: sx+sw });
                slots.push({ x: sx+sw-HOUSE_W-2, y: sy+sh-HOUSE_H*2-4, f: 'RIGHT', cx: sx+sw });
            } else {
                // 8 Houses
                slots.push({ x: sx+2, y: sy+2, f: 'UP', cy: sy }); 
                slots.push({ x: sx+sw/2-HOUSE_W/2, y: sy+2, f: 'UP', cy: sy }); 
                slots.push({ x: sx+sw-HOUSE_W-2, y: sy+2, f: 'UP', cy: sy }); 
                
                slots.push({ x: sx+2, y: sy+sh-HOUSE_H-2, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+sw/2-HOUSE_W/2, y: sy+sh-HOUSE_H-2, f: 'DOWN', cy: sy+sh });
                slots.push({ x: sx+sw-HOUSE_W-2, y: sy+sh-HOUSE_H-2, f: 'DOWN', cy: sy+sh });

                slots.push({ x: sx+2, y: midY-HOUSE_H/2, f: 'LEFT', cx: sx });
                slots.push({ x: sx+sw-HOUSE_W-2, y: midY-HOUSE_H/2, f: 'RIGHT', cx: sx+sw });
            }

            // Render ALL slots
            slots.forEach(s => {
                const res = drawBuilding(s.x, s.y, HOUSE_W, HOUSE_H, 'RES', s.f);
                if (res) {
                    if (s.f === 'UP' || s.f === 'DOWN') drawPath(res.doorX, res.doorY, res.doorX, s.cy!);
                    else drawPath(res.doorX, res.doorY, s.cx!, res.doorY);
                }
            });
        }
    }

    return { grid, poiList: buildingsRegistry };
  }, []);

  // --- Agent Simulation ---
  useEffect(() => {
    if (agents.length > 0 && poiList.length > 0) {
        const homes = poiList.filter(b => b.type === 'RES');
        const shops = poiList.filter(b => b.type !== 'RES');
        
        const sims = agents.map((agent: any, idx: number) => {
            const home = homes[idx % homes.length];
            const target = (Math.random() > 0.5 && shops.length > 0) ? shops[Math.floor(Math.random()*shops.length)] : home;
            
            return {
                ...agent,
                x: home.doorX, y: home.doorY,
                targetX: target.doorX, targetY: target.doorY,
                path: [], state: 'IDLE'
            };
        });
        setSimAgents(sims);
        setBuildings(poiList);
    }
  }, [agents, poiList]);

  useEffect(() => {
    const timer = setInterval(() => {
        setSimAgents(prev => prev.map(agent => {
            let { x, y, targetX, targetY, path } = agent;
            if (Math.abs(x - targetX) < 1 && Math.abs(y - targetY) < 1) {
                const dests = buildings;
                const nextDest = dests[Math.floor(Math.random() * dests.length)];
                return { ...agent, targetX: nextDest.doorX, targetY: nextDest.doorY, path: [] };
            }
            if (path.length === 0) {
                const newPath = findPath(x, y, targetX, targetY, grid);
                if (newPath && newPath.length > 0) return { ...agent, path: newPath };
            }
            if (path.length > 0) {
                const nextStep = path.shift();
                return { ...agent, x: nextStep.x, y: nextStep.y, path: path };
            }
            return agent;
        }));
    }, 200);
    return () => clearInterval(timer);
  }, [buildings, grid]);

  // --- Render ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

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

    const ctx = canvas.getContext('2d');
    if(ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        canvas.width = MAP_COLS * fontSize * 0.6 * dpr;
        canvas.height = MAP_ROWS * fontSize * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain'; 

        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textBaseline = 'top';
        const cellW = canvas.width / dpr / MAP_COLS;
        const cellH = canvas.height / dpr / MAP_ROWS;

        grid.forEach((cell: any, idx: number) => {
            const x = (idx % MAP_COLS) * cellW;
            const y = Math.floor(idx / MAP_COLS) * cellH;
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, cellW+0.5, cellH+0.5); }
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y + cellH*0.15); }
        });

        simAgents.forEach((agent: any) => {
            const x = agent.x * cellW;
            const y = agent.y * cellH;
            ctx.fillStyle = COLORS.BG_AGENT;
            ctx.fillRect(x, y, cellW, cellH);
            ctx.fillStyle = COLORS.FG_AGENT;
            ctx.fillText('@', x, y);
        });
    }
    return () => resizeObserver.disconnect();
  }, [fontSize, grid, simAgents]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#23242a] flex items-center justify-center overflow-hidden p-4">
      <canvas ref={canvasRef} className="shadow-2xl" />
    </div>
  );
}