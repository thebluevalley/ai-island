'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  
  // 道路
  ROAD_MAIN_H: '═', ROAD_MAIN_V: '║', ROAD_MAIN_C: '╬', 
  ROAD_SUB_H:  '─', ROAD_SUB_V:  '│', ROAD_SUB_C:  '┼', 
  PATH:        '·', 
  
  // 建筑
  WALL: '#', DOOR: '+', FLOOR: ' ',
  
  // 装饰
  CAFE_SIGN: '☕', PARK_SIGN: '♣'
};

// --- 2. 莫兰迪配色 ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#3e4451', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  FG_ROAD_MAIN: '#abb2bf', 
  FG_ROAD_SUB:  '#5c6370', 
  FG_PATH:      '#8d6e63', 

  // 建筑 (加大尺寸后，颜色块更明显)
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  
  // 街角设施
  FG_CAFE:     '#e5c07b', // 金黄
  FG_POCKET:   '#98c379', // 嫩绿

  BG_BLDG:     '#1e1f24', 
};

// 6x3 网格 + 边缘留白
const MARGIN_X = 6;
const MARGIN_Y = 4;
const BLOCK_W = 38; 
const BLOCK_H = 36; 
const GRID_COLS = 6; 
const GRID_ROWS = 3; 

// 计算总尺寸 (包含留白)
const MAP_COLS = BLOCK_W * GRID_COLS + MARGIN_X * 2; // ~240
const MAP_ROWS = BLOCK_H * GRID_ROWS + MARGIN_Y * 2; // ~116

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
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS, isRoad: false, isBldg: false
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string, isRoad=false, isBldg=false) => {
        if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
            const idx = y*MAP_COLS+x;
            grid[idx].char = char; grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
            grid[idx].isRoad = isRoad;
            grid[idx].isBldg = isBldg;
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
                if(grid[idx] && !grid[idx].isRoad && !grid[idx].isBldg) 
                    setCell(x, y, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS);
            }
        };
        while(currX !== x2) { currX += (x2 > currX ? 1 : -1); safeSet(currX, currY); }
        while(currY !== y2) { currY += (y2 > currY ? 1 : -1); safeSet(currX, currY); }
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV' | 'CAFE') => {
        // 碰撞检测
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) {
            const idx = iy*MAP_COLS+ix;
            if(ix>=MAP_COLS || iy>=MAP_ROWS || grid[idx]?.isBldg || grid[idx]?.isRoad) return null; // 无法建造
        }

        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }
        if (type === 'CAFE') { wallColor = COLORS.FG_CAFE; doorColor = COLORS.FG_CAFE; }

        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG, false, true); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#222', COLORS.BG_BLDG, false, true);
        
        const doorX = x + Math.floor(w/2);
        const doorY = y + h - 1;
        setCell(doorX, doorY, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
        
        // 标识
        if (type === 'CAFE') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.CAFE_SIGN, COLORS.FG_CAFE, COLORS.BG_BLDG, false, true);

        return { doorX, doorY }; 
    };

    // === Layout Logic ===
    
    // 1. Fill Background (Margin Effect)
    // 默认就是草地，四周自动留白因为我们只在中间画路和房子

    // 2. Main Grid (Offset by MARGIN)
    const startX = MARGIN_X;
    const startY = MARGIN_Y;
    const mainRoadW = 2;

    for(let i=0; i<=GRID_COLS; i++) {
        let x = startX + i * BLOCK_W;
        if(i===GRID_COLS) x-=mainRoadW;
        fillRect(x, startY, mainRoadW, MAP_ROWS - MARGIN_Y*2, CHARS.ROAD_MAIN_V, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    for(let i=0; i<=GRID_ROWS; i++) {
        let y = startY + i * BLOCK_H;
        if(i===GRID_ROWS) y-=mainRoadW;
        fillRect(startX, y, MAP_COLS - MARGIN_X*2, mainRoadW, CHARS.ROAD_MAIN_H, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    // Crossings
    for(let i=0; i<=GRID_COLS; i++) for(let j=0; j<=GRID_ROWS; j++) {
        let px = startX + i*BLOCK_W; if(i===GRID_COLS) px-=mainRoadW;
        let py = startY + j*BLOCK_H; if(j===GRID_ROWS) py-=mainRoadW;
        fillRect(px, py, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // 3. Block Logic
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            
            const sx = startX + bx * BLOCK_W + mainRoadW;
            const sy = startY + by * BLOCK_H + mainRoadW;
            const sw = BLOCK_W - mainRoadW; 
            const sh = BLOCK_H - mainRoadW; 
            const centerX = sx + sw/2;
            const centerY = sy + sh/2;

            // Park (Fixed)
            if (bx === 2 && by === 1) {
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.3) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                fillRect(sx+8, sy+8, sw-16, sh-16, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            const isCivic = ((bx+by)%3 === 0);

            if (isCivic) {
                // Civic: 2-4 Buildings centered
                // Background forest
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.7) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                
                const quads = [{x:sx, y:sy}, {x:sx+sw/2, y:sy}, {x:sx, y:sy+sh/2}, {x:sx+sw/2, y:sy+sh/2}];
                const count = 2 + Math.floor(random(bx, by) * 2.9); 
                
                for(let i=0; i<count; i++) {
                    const q = quads[i];
                    const bW = 12 + Math.floor(random(q.x, q.y)*6); 
                    const bH = 10 + Math.floor(random(q.y, q.x)*4); 
                    const bX = q.x + Math.floor((sw/2 - bW)/2);
                    const bY = q.y + Math.floor((sh/2 - bH)/2);
                    
                    const res = drawBuilding(bX, bY, bW, bH, i===0?'CIV':'COM');
                    if(res) {
                        drawPath(res.doorX, res.doorY+1, res.doorX, res.doorY+3);
                        drawPath(res.doorX, res.doorY+3, Math.floor(centerX), Math.floor(centerY));
                    }
                }
                drawPath(Math.floor(centerX), Math.floor(centerY), Math.floor(centerX), sy+sh);

            } else {
                // === Residential: Street Hugging & Corners ===
                
                // 1. Draw Internal Roads (Cruciform)
                const midX = Math.floor(sx + sw/2);
                const midY = Math.floor(sy + sh/2);
                fillRect(sx, midY, sw, 1, CHARS.ROAD_SUB_H, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
                fillRect(midX, sy, 1, sh, CHARS.ROAD_SUB_V, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
                setCell(midX, midY, CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);

                // 2. Define 4 Sub-Blocks
                const subBlocks = [
                    {x: sx, y: sy, w: midX-sx, h: midY-sy}, // TL
                    {x: midX+1, y: sy, w: sx+sw-midX-1, h: midY-sy}, // TR
                    {x: sx, y: midY+1, w: midX-sx, h: sy+sh-midY-1}, // BL
                    {x: midX+1, y: midY+1, w: sx+sw-midX-1, h: sy+sh-midY-1} // BR
                ];

                let houseCount = 0;
                const houseW = 10; // 加大
                const houseH = 7;

                subBlocks.forEach(sb => {
                    // Try to place 1-2 houses in this sub-block
                    // Strategy: Hug the OUTER edges (Main Roads) or INNER edges (Sub Roads)
                    // Let's try mixed: Hug Outer
                    
                    // Possible slots
                    // Slot 1: Top-Left of subblock (if TL)
                    // We simply try random placement but constrained
                    
                    if (random(sb.x, sb.y) > 0.1) {
                        // Attempt placement
                        // Align to Top or Left of subblock
                        const bX = sb.x + 2; 
                        const bY = sb.y + 2;
                        
                        const res = drawBuilding(bX, bY, houseW, houseH, 'RES');
                        if (res) {
                            houseCount++;
                            // Path to sub-road (Right or Bottom)
                            drawPath(res.doorX, res.doorY+1, res.doorX, midY);
                        }
                    }
                    
                    // Attempt second house (Offset)
                    if (random(sb.x+1, sb.y+1) > 0.3) {
                        const bX = sb.x + sb.w - houseW - 2;
                        const bY = sb.y + sb.h - houseH - 2;
                        
                        // Check distance
                        const res = drawBuilding(bX, bY, houseW, houseH, 'RES');
                        if (res) {
                            houseCount++;
                            drawPath(res.doorX, res.doorY+1, midX, res.doorY+1);
                        }
                    }
                });

                // 3. Corner Filler (If density is low)
                if (houseCount < 5) {
                    // Check 4 corners of the MAIN block
                    const corners = [
                        {x: sx+1, y: sy+1}, {x: sx+sw-6, y: sy+1},
                        {x: sx+1, y: sy+sh-5}, {x: sx+sw-6, y: sy+sh-5}
                    ];
                    
                    corners.forEach(c => {
                        // Check if empty (simple check: center point)
                        const idx = (c.y+2)*MAP_COLS + (c.x+2);
                        if (!grid[idx].isBldg && !grid[idx].isRoad) {
                            // Place Cafe or Pocket Park
                            if (random(c.x, c.y) > 0.5) {
                                // Cafe
                                drawBuilding(c.x, c.y, 5, 4, 'CAFE');
                            } else {
                                // Pocket Park
                                for(let py=c.y; py<c.y+4; py++) for(let px=c.x; px<c.x+5; px++) {
                                    setCell(px, py, CHARS.TREE, COLORS.FG_POCKET, COLORS.BG_GRASS);
                                }
                            }
                        }
                    });
                }
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