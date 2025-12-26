'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 核心工具：伪随机数生成器 (修复崩溃的关键) ---
// 根据坐标返回一个 0.0 到 1.0 之间的固定数值
// 只要 x, y 不变，返回的结果永远不变，确保前后端渲染一致
const random = (x: number, y: number) => {
    let sin = Math.sin(x * 12.9898 + y * 78.233);
    return sin - Math.floor(sin);
};

// --- 2. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  ROAD_MAIN_H: '═', ROAD_MAIN_V: '║', ROAD_MAIN_C: '╬', // 主干道
  ROAD_SUB_H:  '─', ROAD_SUB_V:  '│', ROAD_SUB_C:  '┼', // 次干道
  WALL: '#', DOOR: '+', FLOOR: '.',
};

// --- 3. 莫兰迪配色 (保持您喜欢的风格) ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#4a505c', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  FG_ROAD_MAIN: '#8c92a3', // 亮灰主路
  FG_ROAD_SUB:  '#4b5263', // 暗灰支路

  // 建筑配色
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  BG_BLDG:     '#1e1f24', 
};

const COLS = 120;
const ROWS = 70;

const CIVIC_BUILDINGS = [
    { type: 'CIV', w: 16, h: 10, label: 'HALL' }, 
    { type: 'CIV', w: 14, h: 8,  label: 'LIB'  }, 
    { type: 'COM', w: 12, h: 8,  label: 'MKT'  }, 
    { type: 'CIV', w: 12, h: 8,  label: 'HOSP' }, 
];

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const { agents } = worldData || { agents: [] };

  const mapData = useMemo(() => {
    const grid = new Array(COLS * ROWS).fill(null).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS 
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string) => {
        if(x>=0 && x<COLS && y>=0 && y<ROWS) {
            const idx = y*COLS+x;
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

    // === 生成逻辑 (完全使用 random(x,y) 替代 Math.random) ===
    
    // 1. 主干路网
    const mainBlockW = 36; 
    const mainBlockH = 22; 
    const mainRoadW = 2;   

    for(let x=0; x<COLS; x+=mainBlockW) fillRect(x, 0, mainRoadW, ROWS, CHARS.ROAD_MAIN_V, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);
    for(let y=0; y<ROWS; y+=mainBlockH) fillRect(0, y, COLS, mainRoadW, CHARS.ROAD_MAIN_H, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);
    for(let x=0; x<COLS; x+=mainBlockW) for(let y=0; y<ROWS; y+=mainBlockH) fillRect(x, y, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);

    let civicCount = 0;

    // 2. 街区填充
    for (let by=0; by<Math.floor(ROWS/mainBlockH); by++) {
        for (let bx=0; bx<Math.floor(COLS/mainBlockW); bx++) {
            
            const sx = bx * mainBlockW + mainRoadW;
            const sy = by * mainBlockH + mainRoadW;
            const sw = mainBlockW - mainRoadW;
            const sh = mainBlockH - mainRoadW;

            // 中心公园 (左上角第二个街区)
            if (bx === 1 && by === 1) {
                // 树林 (确定性生成)
                for(let iy=sy; iy<sy+sh; iy++) {
                    for(let ix=sx; ix<sx+sw; ix++) {
                        if (random(ix, iy) > 0.7) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                    }
                }
                fillRect(sx+4, sy+4, sw-8, sh-8, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            // 公共建筑 (对角线位置)
            if ((bx+by)%3 === 0 && civicCount < CIVIC_BUILDINGS.length) {
                const bldg = CIVIC_BUILDINGS[civicCount++];
                const cx = sx + Math.floor((sw-bldg.w)/2);
                const cy = sy + Math.floor((sh-bldg.h)/2);
                drawBuilding(cx, cy, bldg.w, bldg.h, bldg.type as any);
                
                // 广场噪点
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if(ix<cx||ix>cx+bldg.w||iy<cy||iy>cy+bldg.h) {
                        if(random(ix, iy) > 0.8) setCell(ix, iy, CHARS.FLOOR, '#444', COLORS.BG_GRASS);
                    }
                }
                continue;
            }

            // === 居住区细分 ===
            const subRows = 2; 
            const subCols = 3;
            const cellW = Math.floor(sw / subCols);
            const cellH = Math.floor(sh / subRows);

            // 次干道
            for(let i=1; i<subCols; i++) fillRect(sx+i*cellW, sy, 1, sh, CHARS.ROAD_SUB_V, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);
            for(let j=1; j<subRows; j++) fillRect(sx, sy+j*cellH, sw, 1, CHARS.ROAD_SUB_H, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);
            for(let i=1; i<subCols; i++) for(let j=1; j<subRows; j++) setCell(sx+i*cellW, sy+j*cellH, CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);

            // 房屋填充
            for(let r=0; r<subRows; r++) {
                for(let c=0; c<subCols; c++) {
                    const hx = sx + c*cellW + 1;
                    const hy = sy + r*cellH + 1;
                    const hw = cellW - 2;
                    const hh = cellH - 2;

                    const bW = 6, bH = 5;
                    const bx_pos = hx + Math.floor((hw-bW)/2);
                    const by_pos = hy + Math.floor((hh-bH)/2);
                    
                    if (bx_pos+bW < sx+sw && by_pos+bH < sy+sh) {
                        drawBuilding(bx_pos, by_pos, bW, bH, 'RES');
                        // 院子里的树 (确定性)
                        if(random(bx_pos, by_pos) > 0.5) setCell(bx_pos-1, by_pos+1, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                    }
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
            const charW = width / COLS;
            const charH = height / ROWS;
            const size = Math.floor(Math.min(charW / 0.6, charH));
            setFontSize(Math.max(8, size));
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

        canvas.width = COLS * charW * dpr;
        canvas.height = ROWS * charH * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${COLS * charW}px`;
        canvas.style.height = `${ROWS * charH}px`;

        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textBaseline = 'top';

        mapData.forEach((cell, idx) => {
            const x = (idx % COLS) * charW;
            const y = Math.floor(idx / COLS) * charH;
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, charW+0.5, charH+0.5); }
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y); }
        });

        // 绘制代理
        agents.forEach((agent: any) => {
            const tx = Math.floor((agent.x / 100) * COLS);
            const ty = Math.floor((agent.y / 100) * ROWS);
            if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
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