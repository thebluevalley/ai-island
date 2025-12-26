'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 (保持 HD 精致版) ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  
  // 道路系统
  ROAD_MAIN_H: '═', ROAD_MAIN_V: '║', ROAD_MAIN_C: '╬', 
  ROAD_SUB_H:  '─', ROAD_SUB_V:  '│', ROAD_SUB_C:  '┼', 
  PATH:        '·', 
  
  // 建筑
  WALL: '#', DOOR: '+', FLOOR: ' ',
};

// --- 2. 配色 (Morandi) ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#3e4451', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  FG_ROAD_MAIN: '#abb2bf', 
  FG_ROAD_SUB:  '#5c6370', 
  FG_PATH:      '#8d6e63', 

  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  BG_BLDG:     '#1e1f24', 
};

// === 核心修改：6x3 舒朗大网格 ===
// 总分辨率约为 240x120，保持 HD
const BLOCK_W = 40; // 街区变得非常宽敞
const BLOCK_H = 40; 
const GRID_COLS = 6; // 6 列
const GRID_ROWS = 3; // 3 行

const MAP_COLS = BLOCK_W * GRID_COLS; // 240
const MAP_ROWS = BLOCK_H * GRID_ROWS; // 120

const random = (x: number, y: number) => {
    let sin = Math.sin(x * 12.9898 + y * 78.233);
    return sin - Math.floor(sin);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(8);

  const { agents } = worldData || { agents: [] };

  const mapData = useMemo(() => {
    const grid = new Array(MAP_COLS * MAP_ROWS).fill(0).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS, isRoad: false 
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string, isRoad=false) => {
        if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
            const idx = y*MAP_COLS+x;
            grid[idx].char = char; grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
            grid[idx].isRoad = isRoad;
        }
    };

    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string, isRoad=false) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg, isRoad);
    };

    const drawPath = (x1: number, y1: number, x2: number, y2: number) => {
        let currX = x1, currY = y1;
        const safeSet = (x: number, y: number) => {
            if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
                const idx = y*MAP_COLS+x;
                if(grid[idx] && !grid[idx].isRoad) setCell(x, y, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS);
            }
        };
        while(currX !== x2) { currX += (x2 > currX ? 1 : -1); safeSet(currX, currY); }
        while(currY !== y2) { currY += (y2 > currY ? 1 : -1); safeSet(currX, currY); }
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }

        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#222', COLORS.BG_BLDG);
        
        const doorX = x + Math.floor(w/2);
        const doorY = y + h - 1;
        setCell(doorX, doorY, CHARS.DOOR, doorColor, COLORS.BG_BLDG);
        return { doorX, doorY }; 
    };

    // === Layout Generation ===
    const mainRoadW = 2; // 主干道宽度

    // 1. Grid Lines
    for(let i=0; i<=GRID_COLS; i++) {
        let x = i * BLOCK_W;
        if(i===GRID_COLS) x-=mainRoadW;
        fillRect(x, 0, mainRoadW, MAP_ROWS, CHARS.ROAD_MAIN_V, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let i=0; i<=GRID_ROWS; i++) {
        let y = i * BLOCK_H;
        if(i===GRID_ROWS) y-=mainRoadW;
        fillRect(0, y, MAP_COLS, mainRoadW, CHARS.ROAD_MAIN_H, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let x=0; x<=GRID_COLS; x++) for(let y=0; y<=GRID_ROWS; y++) {
        let px = x*BLOCK_W; if(x===GRID_COLS) px-=mainRoadW;
        let py = y*BLOCK_H; if(y===GRID_ROWS) py-=mainRoadW;
        fillRect(px, py, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // 2. Block Filling
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            
            const sx = bx * BLOCK_W + mainRoadW;
            const sy = by * BLOCK_H + mainRoadW;
            const sw = BLOCK_W - mainRoadW; 
            const sh = BLOCK_H - mainRoadW; 
            const centerX = sx + sw/2;
            const centerY = sy + sh/2;

            // Park (Moved to roughly center left: 2,1)
            // 网格变少后，(2,1) 是比较好的中心位置 (0,1,2,3,4,5)
            if (bx === 2 && by === 1) {
                // Lush Forest
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.25) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                // Large Lake
                fillRect(sx+8, sy+8, sw-16, sh-16, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            // Civic Complex (Less frequent now)
            const isCivic = ((bx+by)%3 === 0);

            if (isCivic) {
                // Civic: 2-4 Buildings with Gardens
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.65) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }

                const qW = Math.floor(sw/2);
                const qH = Math.floor(sh/2);
                const quads = [
                    {x:sx, y:sy}, {x:sx+qW, y:sy}, {x:sx, y:sy+qH}, {x:sx+qW, y:sy+qH}
                ];

                const count = 2 + Math.floor(random(bx, by) * 2.9); 
                for(let i=0; i<count; i++) {
                    const q = quads[i];
                    // Building Size
                    const bW = 12 + Math.floor(random(q.x, q.y)*8); 
                    const bH = 10 + Math.floor(random(q.y, q.x)*6); 
                    const bX = q.x + Math.floor((qW-bW)/2);
                    const bY = q.y + Math.floor((qH-bH)/2);
                    
                    const type = i===0 ? 'CIV' : 'COM';
                    const {doorX, doorY} = drawBuilding(bX, bY, bW, bH, type);
                    
                    // Path to block center
                    drawPath(doorX, doorY+1, doorX, doorY+3);
                    drawPath(doorX, doorY+3, Math.floor(centerX), Math.floor(centerY));
                }
                // Path to main road
                drawPath(Math.floor(centerX), Math.floor(centerY), Math.floor(centerX), sy+sh);

            } else {
                // Residential (High Density but Spacious Block)
                // 十字路网划分
                fillRect(sx, Math.floor(sy+sh/2), sw, 1, CHARS.ROAD_SUB_H, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
                fillRect(Math.floor(sx+sw/2), sy, 1, sh, CHARS.ROAD_SUB_V, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
                setCell(Math.floor(sx+sw/2), Math.floor(sy+sh/2), CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);

                const subW = Math.floor(sw/2);
                const subH = Math.floor(sh/2);
                const zones = [
                    {x: sx, y: sy}, {x: sx+subW, y: sy},
                    {x: sx, y: sy+subH}, {x: sx+subW, y: sy+subH}
                ];

                zones.forEach(z => {
                    // Try to fit 2 houses per quadrant (Total 8 per block)
                    const hW = 6, hH = 5;
                    
                    // House 1 (Top Left of quadrant)
                    if(random(z.x, z.y) > 0.15) {
                        const x1 = z.x + 3; 
                        const y1 = z.y + 3;
                        if (x1 + hW < z.x + subW && y1 + hH < z.y + subH) {
                            const {doorX, doorY} = drawBuilding(x1, y1, hW, hH, 'RES');
                            drawPath(doorX, doorY+1, doorX, Math.floor(sy+sh/2));
                        }
                    }
                    
                    // House 2 (Bottom Right of quadrant)
                    if(random(z.x+1, z.y+1) > 0.15) {
                        const x2 = z.x + subW - hW - 3;
                        const y2 = z.y + subH - hH - 2;
                        
                        // Check overlap with center roads and house 1
                        if(x2 > z.x + hW + 2 && y2 > z.y + 2) {
                            const {doorX, doorY} = drawBuilding(x2, y2, hW, hH, 'RES');
                            drawPath(doorX, doorY+1, Math.floor(sx+sw/2), doorY+1);
                        }
                    }
                });
            }
        }
    }

    return grid;
  }, []);

  // --- Rendering ---
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
            const finalSize = Math.max(4, size); 
            setFontSize(finalSize);
        }
    });
    resizeObserver.observe(container);

    const ctx = canvas.getContext('2d');
    if(ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        const metrics = ctx.measureText('M');
        const charW = metrics.width; 
        const charH = fontSize;

        const w = MAP_COLS * charW;
        const h = MAP_ROWS * charH;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'fill'; 

        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, w, h);
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textBaseline = 'top';

        mapData.forEach((cell: any, idx: number) => {
            const x = (idx % MAP_COLS) * charW;
            const y = Math.floor(idx / MAP_COLS) * charH;
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, charW+0.5, charH+0.5); }
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y); }
        });

        agents.forEach((agent: any) => {
            const tx = Math.floor((agent.x / 100) * MAP_COLS);
            const ty = Math.floor((agent.y / 100) * MAP_ROWS);
            if(tx>=0 && tx<MAP_COLS && ty>=0 && ty<MAP_ROWS) {
                const x = tx * charW;
                const y = ty * charH;
                ctx.fillStyle = '#fff';
                ctx.fillText('@', x, y);
            }
        });
    }
    return () => resizeObserver.disconnect();
  }, [fontSize, mapData, agents]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#23242a] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
}