'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  
  // 道路
  ROAD_MAIN_H: '═', ROAD_MAIN_V: '║', ROAD_MAIN_C: '╬',
  ROAD_SUB_H:  '─', ROAD_SUB_V:  '│', ROAD_SUB_C:  '┼',
  
  // 建筑
  WALL: '#', DOOR: '+', FLOOR: '.',
};

// --- 2. 莫兰迪/淡雅配色 ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#4a505c', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  // 道路
  FG_ROAD_MAIN: '#8c92a3', // 亮灰
  FG_ROAD_SUB:  '#4b5263', // 暗灰

  // 建筑 (粉彩)
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  BG_BLDG:     '#1e1f24', 
};

// 完美对齐的尺寸 (4x4个 Superblock)
const BLOCK_W = 32;
const BLOCK_H = 20;
const MAP_COLS = BLOCK_W * 4; // 128
const MAP_ROWS = BLOCK_H * 4; // 80

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
    // 修复点：使用普通 Array 存储对象，而不是 Uint8Array
    const grid = new Array(MAP_COLS * MAP_ROWS).fill(null).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS 
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string) => {
        if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
            const idx = y*MAP_COLS+x;
            grid[idx].char = char; grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
        }
    };

    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg);
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }

        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#333', COLORS.BG_BLDG);
        setCell(x+Math.floor(w/2), y+h-1, CHARS.DOOR, doorColor, COLORS.BG_BLDG);
    };

    // === 布局算法 ===
    
    // 1. 生成主干路网 (Supergrid)
    const mainRoadW = 2;

    // 绘制主路
    for(let x=0; x<MAP_COLS; x+=BLOCK_W) fillRect(x, 0, mainRoadW, MAP_ROWS, CHARS.ROAD_MAIN_V, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);
    for(let y=0; y<MAP_ROWS; y+=BLOCK_H) fillRect(0, y, MAP_COLS, mainRoadW, CHARS.ROAD_MAIN_H, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);
    for(let x=0; x<MAP_COLS; x+=BLOCK_W) for(let y=0; y<MAP_ROWS; y+=BLOCK_H) fillRect(x, y, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);

    // 2. 遍历 4x4 网格
    const cols = MAP_COLS / BLOCK_W;
    const rows = MAP_ROWS / BLOCK_H;

    for (let by=0; by<rows; by++) {
        for (let bx=0; bx<cols; bx++) {
            
            const sx = bx * BLOCK_W + mainRoadW;
            const sy = by * BLOCK_H + mainRoadW;
            const sw = BLOCK_W - mainRoadW;
            const sh = BLOCK_H - mainRoadW;

            // A. 中央公园 (定点：第二行第二列)
            if (bx === 1 && by === 1) {
                // 森林
                for(let i=0; i<200; i++) {
                    const rx = sx + Math.floor(random(sx+i, sy)*sw);
                    const ry = sy + Math.floor(random(sy, sx+i)*sh);
                    setCell(rx, ry, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                // 湖泊
                fillRect(sx+6, sy+6, sw-12, sh-12, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            // B. 公共/商业街区 (对角线 + 中心周围)
            const isCivicZone = (bx+by)%2 === 0 && !(bx===1 && by===1);

            if (isCivicZone) {
                // 铺广场地面
                for(let i=0; i<50; i++) {
                    const rx = sx + Math.floor(random(sx+i, sy)*sw);
                    const ry = sy + Math.floor(random(sy, sx+i)*sh);
                    setCell(rx, ry, CHARS.FLOOR, '#333', COLORS.BG_GRASS);
                }

                const quadrants = [
                    {x: sx+1, y: sy+1},
                    {x: sx+Math.floor(sw/2)+1, y: sy+1},
                    {x: sx+1, y: sy+Math.floor(sh/2)+1},
                    {x: sx+Math.floor(sw/2)+1, y: sy+Math.floor(sh/2)+1}
                ];

                const qW = Math.floor(sw/2);
                const qH = Math.floor(sh/2);

                // 决定建几栋 (2-4)
                const count = 2 + Math.floor(random(bx, by) * 2.9); 
                
                for(let i=0; i<count; i++) {
                    const q = quadrants[i];
                    // 随机大小 (中等偏大)
                    const bW = 8 + Math.floor(random(q.x, q.y)*6); // 8-13
                    const bH = 6 + Math.floor(random(q.y, q.x)*3); // 6-8
                    
                    const drawW = Math.min(bW, qW-2);
                    const drawH = Math.min(bH, qH-2);

                    const type = i===0 ? 'CIV' : 'COM'; 
                    drawBuilding(q.x + Math.floor((qW-drawW)/2), q.y + Math.floor((qH-drawH)/2), drawW, drawH, type);
                }
                continue;
            }

            // C. 居住区 (细分高密度)
            // 内部路网：十字
            fillRect(sx + sw/2, sy, 1, sh, CHARS.ROAD_SUB_V, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);
            fillRect(sx, sy + sh/2, sw, 1, CHARS.ROAD_SUB_H, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);
            setCell(sx+sw/2, sy+sh/2, CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);

            // 4个小地块
            const subW = Math.floor(sw/2);
            const subH = Math.floor(sh/2);
            
            const resQuads = [
                {x: sx, y: sy}, {x: sx+subW, y: sy},
                {x: sx, y: sy+subH}, {x: sx+subW, y: sy+subH}
            ];

            resQuads.forEach((q, idx) => {
                const innerX = q.x + (q.x > sx ? 1 : 0);
                const innerY = q.y + (q.y > sy ? 1 : 0);
                const innerW = subW - 1;
                const innerH = subH - 1;

                if (random(innerX, innerY) > 0.4) {
                    const houseW = 5, houseH = 4;
                    // 房1
                    if(innerW > houseW+1 && innerH > houseH+1)
                        drawBuilding(innerX+1, innerY+1, houseW, houseH, 'RES');
                    // 房2 (错位)
                    if(innerW > houseW*2 && innerH > houseH*2)
                        drawBuilding(innerX+innerW-houseW-1, innerY+innerH-houseH-1, houseW, houseH, 'RES');
                    
                    setCell(innerX+innerW-2, innerY+2, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                } else {
                    const houseW = 8, houseH = 6;
                    drawBuilding(innerX + Math.floor((innerW-houseW)/2), innerY + Math.floor((innerH-houseH)/2), houseW, houseH, 'RES');
                }
            });
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
            const finalSize = Math.max(6, size); 
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
        canvas.style.objectFit = 'contain';

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

        // Agents
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