'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 (增加次级道路) ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  
  // 主干道 (双线/粗线)
  ROAD_MAIN_H: '═', ROAD_MAIN_V: '║', ROAD_MAIN_C: '╬',
  
  // 次干道 (单线/细线)
  ROAD_SUB_H:  '─', ROAD_SUB_V:  '│', ROAD_SUB_C:  '┼',
  
  // 建筑
  WALL: '#', DOOR: '+', FLOOR: '.',
};

// --- 2. 莫兰迪/淡雅配色 ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#4a505c', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  // 道路区分
  FG_ROAD_MAIN: '#8c92a3', // 亮灰
  FG_ROAD_SUB:  '#4b5263', // 暗灰 (低对比)

  // 建筑 (粉彩)
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  BG_BLDG:     '#1e1f24', 
};

const COLS = 120;
const ROWS = 70; // 高度增加，容纳更多街区

// 公共建筑定义
const CIVIC_BUILDINGS = [
    { type: 'CIV', w: 16, h: 10, label: 'HALL' }, // Hall
    { type: 'CIV', w: 14, h: 8,  label: 'LIB'  }, // Lib
    { type: 'COM', w: 12, h: 8,  label: 'MKT'  }, // Market
    { type: 'CIV', w: 12, h: 8,  label: 'HOSP' }, // Hosp
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

    // === 布局算法 ===
    
    // 1. 生成主干路网 (Main Grid) -> 划分出 Superblocks
    const mainBlockW = 36; // 大街区宽
    const mainBlockH = 22; // 大街区高
    const mainRoadW = 2;   // 主路宽

    // 绘制主路
    for(let x=0; x<COLS; x+=mainBlockW) fillRect(x, 0, mainRoadW, ROWS, CHARS.ROAD_MAIN_V, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);
    for(let y=0; y<ROWS; y+=mainBlockH) fillRect(0, y, COLS, mainRoadW, CHARS.ROAD_MAIN_H, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);
    // 交叉口
    for(let x=0; x<COLS; x+=mainBlockW) for(let y=0; y<ROWS; y+=mainBlockH) fillRect(x, y, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS);

    let civicCount = 0;

    // 2. 遍历每个 Superblock
    for (let by=0; by<Math.floor(ROWS/mainBlockH); by++) {
        for (let bx=0; bx<Math.floor(COLS/mainBlockW); bx++) {
            
            const sx = bx * mainBlockW + mainRoadW;
            const sy = by * mainBlockH + mainRoadW;
            const sw = mainBlockW - mainRoadW;
            const sh = mainBlockH - mainRoadW;

            // 中心公园 (固定在左上角的大街区)
            if (bx === 1 && by === 1) {
                for(let i=0; i<150; i++) setCell(sx+Math.random()*sw, sy+Math.random()*sh, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                fillRect(sx+4, sy+4, sw-8, sh-8, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            // 公共建筑 (少量，放在显眼位置)
            if ((bx+by)%3 === 0 && civicCount < CIVIC_BUILDINGS.length) {
                const bldg = CIVIC_BUILDINGS[civicCount++];
                // 居中放置一个大建筑
                const cx = sx + Math.floor((sw-bldg.w)/2);
                const cy = sy + Math.floor((sh-bldg.h)/2);
                drawBuilding(cx, cy, bldg.w, bldg.h, bldg.type as any);
                
                // 广场铺地
                for(let i=0; i<30; i++) {
                    const tx = sx + Math.random()*sw;
                    const ty = sy + Math.random()*sh;
                    if(tx<cx||tx>cx+bldg.w||ty<cy||ty>cy+bldg.h) setCell(Math.floor(tx), Math.floor(ty), CHARS.FLOOR, '#444', COLORS.BG_GRASS);
                }
                continue;
            }

            // === 居住区细分 (Subdivide Residential) ===
            // 在 Superblock 内部划分为 3x2 或 3x3 的小格子
            const subRows = 2; 
            const subCols = 3;
            const cellW = Math.floor(sw / subCols);
            const cellH = Math.floor(sh / subRows);

            // 绘制次干道 (内部路网)
            for(let i=1; i<subCols; i++) fillRect(sx+i*cellW, sy, 1, sh, CHARS.ROAD_SUB_V, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);
            for(let j=1; j<subRows; j++) fillRect(sx, sy+j*cellH, sw, 1, CHARS.ROAD_SUB_H, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);
            for(let i=1; i<subCols; i++) for(let j=1; j<subRows; j++) setCell(sx+i*cellW, sy+j*cellH, CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS);

            // 填充每个小格子 (6-10 Houses per Block)
            for(let r=0; r<subRows; r++) {
                for(let c=0; c<subCols; c++) {
                    const hx = sx + c*cellW + 1;
                    const hy = sy + r*cellH + 1;
                    const hw = cellW - 2;
                    const hh = cellH - 2;

                    // 100% 填充率，不再留空
                    // 房子尺寸固定为 6x5
                    const bW = 6, bH = 5;
                    // 在小格子里居中
                    const bx = hx + Math.floor((hw-bW)/2);
                    const by = hy + Math.floor((hh-bH)/2);
                    
                    if (bx+bW < sx+sw && by+bH < sy+sh) {
                        drawBuilding(bx, by, bW, bH, 'RES');
                        // 种树 (院子)
                        if(Math.random()>0.5) setCell(bx-1, by+1, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
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

        // Draw Map
        mapData.forEach((cell, idx) => {
            const x = (idx % COLS) * charW;
            const y = Math.floor(idx / COLS) * charH;
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, charW+0.5, charH+0.5); }
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y); }
        });

        // Draw Agents
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