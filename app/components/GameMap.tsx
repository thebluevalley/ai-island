'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  
  // 道路系统
  ROAD_MAIN_H: '═', ROAD_MAIN_V: '║', ROAD_MAIN_C: '╬', 
  ROAD_SUB_H:  '─', ROAD_SUB_V:  '│', ROAD_SUB_C:  '┼', 
  PATH:        '░', 
  
  // 建筑
  WALL: '#', DOOR: '+', FLOOR: ' ',
};

// --- 2. 配色 ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#4a505c', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  FG_ROAD_MAIN: '#8c92a3', 
  FG_ROAD_SUB:  '#5c6370', 
  FG_PATH:      '#8d6e63', 

  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  BG_BLDG:     '#1e1f24', 
};

// === 7x4 超宽网格 ===
const BLOCK_W = 26; 
const BLOCK_H = 20; 
const GRID_COLS = 7; 
const GRID_ROWS = 4; 

const MAP_COLS = BLOCK_W * GRID_COLS; // 182
const MAP_ROWS = BLOCK_H * GRID_ROWS; // 80

// 伪随机
const random = (x: number, y: number) => {
    let sin = Math.sin(x * 12.9898 + y * 78.233);
    return sin - Math.floor(sin);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

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

    // === 修复点：增加边界检查防止 build 报错 ===
    const drawPath = (x1: number, y1: number, x2: number, y2: number) => {
        let currX = x1, currY = y1;
        
        // 辅助函数：安全绘制路径点
        const safeSetPath = (x: number, y: number) => {
            if (x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS) {
                const idx = y * MAP_COLS + x;
                // 只有不是路的地方才画小径，且确保 grid[idx] 存在
                if (grid[idx] && !grid[idx].isRoad) {
                    setCell(x, y, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS);
                }
            }
        };

        while(currX !== x2) {
            currX += (x2 > currX ? 1 : -1);
            safeSetPath(currX, currY);
        }
        while(currY !== y2) {
            currY += (y2 > currY ? 1 : -1);
            safeSetPath(currX, currY);
        }
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }

        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#333', COLORS.BG_BLDG);
        
        const doorX = x + Math.floor(w/2);
        const doorY = y + h - 1;
        setCell(doorX, doorY, CHARS.DOOR, doorColor, COLORS.BG_BLDG);

        return { doorX, doorY }; 
    };

    // === Step 1: 主干路网 ===
    const mainRoadW = 2;
    for(let i=0; i<=GRID_COLS; i++) {
        let x = i * BLOCK_W;
        if (i === GRID_COLS) x -= mainRoadW; 
        fillRect(x, 0, mainRoadW, MAP_ROWS, CHARS.ROAD_MAIN_V, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let i=0; i<=GRID_ROWS; i++) {
        let y = i * BLOCK_H;
        if (i === GRID_ROWS) y -= mainRoadW;
        fillRect(0, y, MAP_COLS, mainRoadW, CHARS.ROAD_MAIN_H, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let x=0; x<=GRID_COLS; x++) for(let y=0; y<=GRID_ROWS; y++) {
        let px = x*BLOCK_W, py = y*BLOCK_H;
        if(x===GRID_COLS) px -= mainRoadW; if(y===GRID_ROWS) py -= mainRoadW;
        fillRect(px, py, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // === Step 2: 填充街区 ===
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            
            const sx = bx * BLOCK_W + mainRoadW;
            const sy = by * BLOCK_H + mainRoadW;
            const sw = BLOCK_W - mainRoadW; 
            const sh = BLOCK_H - mainRoadW; 

            const centerX = sx + sw/2;
            const centerY = sy + sh/2;

            // 中心公园
            if (bx === 3 && by === 1) {
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.4) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                fillRect(sx+4, sy+4, sw-8, sh-8, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            const isCivic = ((bx+by)%3 === 0) || (bx===3 && by===2);

            if (isCivic) {
                // A. 公共建筑地块
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.6) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }

                const qW = Math.floor(sw/2);
                const qH = Math.floor(sh/2);
                const quadrants = [
                    {x: sx, y: sy}, {x: sx+qW, y: sy},
                    {x: sx, y: sy+qH}, {x: sx+qW, y: sy+qH}
                ];

                const count = 2 + Math.floor(random(bx, by) * 2.9); 
                
                for(let i=0; i<count; i++) {
                    const q = quadrants[i]; 
                    const bW = 8 + Math.floor(random(q.x, q.y)*5); 
                    const bH = 6 + Math.floor(random(q.y, q.x)*3); 
                    
                    const bX = q.x + Math.floor((qW-bW)/2);
                    const bY = q.y + Math.floor((qH-bH)/2);
                    
                    const type = i===0 ? 'CIV' : 'COM'; 
                    const { doorX, doorY } = drawBuilding(bX, bY, bW, bH, type);

                    drawPath(doorX, doorY + 1, doorX, doorY + 2); 
                    drawPath(doorX, doorY + 2, Math.floor(centerX), Math.floor(centerY)); 
                }
                
                // 连到下方主干道 (注意这里可能有越界风险，safeSetPath 会处理)
                drawPath(Math.floor(centerX), Math.floor(centerY), Math.floor(centerX), sy+sh);

            } else {
                // B. 居住地块
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
                    const hW = 5, hH = 4;
                    
                    if (random(z.x, z.y) > 0.2) {
                        const x1 = z.x + 1;
                        const y1 = z.y + 1;
                        const {doorX, doorY} = drawBuilding(x1, y1, hW, hH, 'RES');
                        drawPath(doorX, doorY+1, doorX, Math.floor(sy+sh/2)); 
                    }
                    
                    if (random(z.x+1, z.y+1) > 0.3) {
                        const x2 = z.x + subW - hW - 1;
                        const y2 = z.y + subH - hH - 1;
                        if (x2 > z.x + hW + 2 || y2 > z.y + hH + 2) {
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
            setFontSize(Math.max(6, size));
        }
    });
    resizeObserver.observe(container);

    const ctx = canvas.getContext('2d');
    if(ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        const charW = ctx.measureText('M').width;
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