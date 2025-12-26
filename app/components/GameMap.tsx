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

  // 统一的暖色调住宅
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  
  FG_CAFE:     '#e5c07b', 
  FG_POCKET:   '#98c379', 

  BG_BLDG:     '#1e1f24', 
};

// 6x3 网格 + 留白
const MARGIN_X = 6;
const MARGIN_Y = 4;
const BLOCK_W = 38; 
const BLOCK_H = 36; 
const GRID_COLS = 6; 
const GRID_ROWS = 3; 

const MAP_COLS = BLOCK_W * GRID_COLS + MARGIN_X * 2; 
const MAP_ROWS = BLOCK_H * GRID_ROWS + MARGIN_Y * 2; 

// 标准化住宅尺寸 (Strict Size)
const HOUSE_W = 10;
const HOUSE_H = 6;
const HOUSE_GAP = 1; // 极小的间距

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
        // 严格碰撞检测
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
        
        // 门居中
        const doorX = x + Math.floor(w/2);
        const doorY = y + h - 1;
        setCell(doorX, doorY, CHARS.DOOR, doorColor, COLORS.BG_BLDG, false, true);
        
        if (type === 'CAFE') setCell(x+Math.floor(w/2), y+Math.floor(h/2), CHARS.CAFE_SIGN, COLORS.FG_CAFE, COLORS.BG_BLDG, false, true);

        return { doorX, doorY }; 
    };

    // === Layout Logic ===
    
    // 1. Main Grid 
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
    for(let i=0; i<=GRID_COLS; i++) for(let j=0; j<=GRID_ROWS; j++) {
        let px = startX + i*BLOCK_W; if(i===GRID_COLS) px-=mainRoadW;
        let py = startY + j*BLOCK_H; if(j===GRID_ROWS) py-=mainRoadW;
        fillRect(px, py, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // 2. Block Filling
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            
            const sx = startX + bx * BLOCK_W + mainRoadW;
            const sy = startY + by * BLOCK_H + mainRoadW;
            const sw = BLOCK_W - mainRoadW; 
            const sh = BLOCK_H - mainRoadW; 
            const centerX = sx + sw/2;
            const centerY = sy + sh/2;

            // Park
            if (bx === 2 && by === 1) {
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.3) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                fillRect(sx+8, sy+8, sw-16, sh-16, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            const isCivic = ((bx+by)%3 === 0);

            if (isCivic) {
                // Civic: Complex (Center placement)
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.7) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                
                const quads = [{x:sx, y:sy}, {x:sx+sw/2, y:sy}, {x:sx, y:sy+sh/2}, {x:sx+sw/2, y:sy+sh/2}];
                const count = 2 + Math.floor(random(bx, by) * 2.9); 
                
                for(let i=0; i<count; i++) {
                    const q = quads[i];
                    // Civic buildings vary in size slightly
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
                // === Residential: Row Alignment (High Density) ===
                
                // 1. Draw Internal Road (Horizontal Center)
                const midY = Math.floor(sy + sh/2);
                fillRect(sx, midY, sw, 1, CHARS.ROAD_SUB_H, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);

                // We now have two sub-zones: Top Half and Bottom Half.
                // We will pack houses along the Main Road (Top edge) and Main Road (Bottom edge)
                // and potentially along the Sub Road (Inner edges)
                
                const zones = [
                    { yStart: sy + 1, dir: 1, roadY: sy }, // Top row, hug top road
                    { yStart: sy + sh - 1 - HOUSE_H, dir: 1, roadY: sy+sh }, // Bottom row, hug bottom road
                    // { yStart: midY - 1 - HOUSE_H, dir: 1, roadY: midY }, // Inner Top
                    // { yStart: midY + 2, dir: 1, roadY: midY } // Inner Bottom
                ];

                // Let's stick to 2 dense rows per block to avoid overcrowding but keep alignment
                // Row 1: Top of block
                // Row 2: Bottom of block
                // Plus corner fillers

                let totalHouses = 0;

                zones.forEach(zone => {
                    let currX = sx + 2; // Start with padding
                    const limitX = sx + sw - 2;
                    
                    // Linear fill
                    while (currX + HOUSE_W <= limitX) {
                        // Place house
                        const res = drawBuilding(currX, zone.yStart, HOUSE_W, HOUSE_H, 'RES');
                        if (res) {
                            totalHouses++;
                            // Path to nearest horizontal road (Top Main or Bottom Main)
                            // If Top Row, path UP to sy? No, paths usually go to "front" door.
                            // Let's assume doors face the INTERNAL road (midY)
                            // So Top Row doors face Down, Bottom Row doors face Up?
                            // For simplicity, door is always at bottom of sprite.
                            
                            if (Math.abs(res.doorY - midY) < Math.abs(res.doorY - sy)) {
                                drawPath(res.doorX, res.doorY+1, res.doorX, midY); // Connect to internal road
                            } else {
                                drawPath(res.doorX, res.doorY+1, res.doorX, zone.roadY); // Connect to main road (unlikely with bottom door)
                            }
                        }
                        currX += HOUSE_W + HOUSE_GAP; // Tight packing
                    }
                });

                // Corner Activation (If block looks empty or just for flavor)
                // Check corners for cafes
                const corners = [
                    {x: sx, y: sy}, {x: sx+sw-5, y: sy},
                    {x: sx, y: sy+sh-4}, {x: sx+sw-5, y: sy+sh-4}
                ];
                corners.forEach(c => {
                    const idx = (c.y+1)*MAP_COLS + (c.x+1);
                    if (!grid[idx].isBldg && !grid[idx].isRoad) {
                        if (random(c.x, c.y) > 0.6) {
                            drawBuilding(c.x, c.y, 5, 4, 'CAFE');
                        } else if (random(c.x, c.y) > 0.3) {
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
        const charH = fontSize;

        const w = MAP_COLS * ctx.measureText('M').width; // Approx
        const h = MAP_ROWS * charH;

        // Force precise aspect ratio rendering
        canvas.width = MAP_COLS * fontSize * 0.6 * dpr; // Approx aspect ratio for fonts
        canvas.height = MAP_ROWS * fontSize * dpr;
        ctx.scale(dpr, dpr);
        
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain'; 

        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textBaseline = 'top';
        
        // Exact Grid Width calc
        const cellW = canvas.width / dpr / MAP_COLS;
        const cellH = canvas.height / dpr / MAP_ROWS;

        mapData.forEach((cell: any, idx: number) => {
            const x = (idx % MAP_COLS) * cellW;
            const y = Math.floor(idx / MAP_COLS) * cellH;
            
            // Background Block
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, cellW+0.5, cellH+0.5); }
            // Character
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y + cellH*0.1); }
        });

        agents.forEach((agent: any) => {
            const tx = Math.floor((agent.x / 100) * MAP_COLS);
            const ty = Math.floor((agent.y / 100) * MAP_ROWS);
            if(tx>=0 && tx<MAP_COLS && ty>=0 && ty<MAP_ROWS) {
                const x = tx * cellW;
                const y = ty * cellH;
                ctx.fillStyle = '#fff';
                ctx.fillText('@', x, y);
            }
        });
    }
    return () => resizeObserver.disconnect();
  }, [fontSize, mapData, agents]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#23242a] flex items-center justify-center overflow-hidden p-4">
      {/* Padding container */}
      <canvas ref={canvasRef} className="shadow-2xl" />
    </div>
  );
}