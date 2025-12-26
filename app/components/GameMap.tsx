'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 (保持几何感) ---
const CHARS: any = {
  EMPTY: ' ',
  GRASS: '·', 
  TREE:  '♣', 
  WATER: '≈', 
  
  // 道路 (线框)
  ROAD_H: '═', ROAD_V: '║', ROAD_C: '╬',
  
  // 建筑
  WALL: '#', 
  DOOR: '+', 
  FLOOR: '.',
};

// --- 2. 莫兰迪/淡雅配色 (Elegant Dark) ---
const COLORS: any = {
  // 全局背景：深灰蓝，护眼且高级
  BG:        '#23242a', 

  // 环境色 (低饱和度)
  BG_GRASS:  '#2b2d35', // 比背景稍亮
  FG_GRASS:  '#4a505c', // 隐约的噪点
  FG_FOREST: '#68856c', // 雾霾绿
  FG_WATER:  '#6a9fb5', // 灰蓝
  FG_ROAD:   '#5c6370', // 中灰道路

  // === 建筑配色 (粉彩/莫兰迪) ===
  
  // 1. 居住 (Residential) - 温暖的陶土/米色
  FG_RES_WALL: '#d4b595', // 淡褐
  FG_RES_DOOR: '#cc8c6c', // 砖红
  
  // 2. 商业 (Commercial) - 淡雅的青色
  FG_COM_WALL: '#8abeb7', // 青灰
  FG_COM_DOOR: '#5e8d87',
  
  // 3. 公共 (Civic) - 独特的灰紫/淡金
  FG_CIV_WALL: '#b294bb', // 灰紫
  FG_CIV_DOOR: '#817299',
  
  // 室内
  BG_BLDG:   '#1e1f24', // 比外部更深一点
};

const COLS = 100;
const ROWS = 50;

// 定制公共建筑列表 (尺寸不一)
const CIVIC_BUILDINGS = [
    { type: 'CIV', w: 16, h: 10, label: 'HALL' }, // 市政厅 (最大)
    { type: 'CIV', w: 14, h: 8,  label: 'LIB'  }, // 图书馆 (中大)
    { type: 'COM', w: 12, h: 6,  label: 'MKT'  }, // 市场
    { type: 'CIV', w: 10, h: 6,  label: 'HOSP' }, // 诊所
    { type: 'COM', w: 8,  h: 6,  label: 'CAFE' }, // 咖啡馆 (最小)
];

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const { agents } = worldData || { agents: [] };

  // --- 生成逻辑 ---
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

    // 建筑绘制
    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }

        // 墙
        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        // 地板
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#333', COLORS.BG_BLDG);
        // 门
        setCell(x+Math.floor(w/2), y+h-1, CHARS.DOOR, doorColor, COLORS.BG_BLDG);
    };

    // === 布局算法 ===
    
    // 1. 路网 (宽阔疏朗)
    const blockW = 24; // 街区变大 -> 建筑变稀疏
    const blockH = 16;
    
    // 绘制道路
    for(let x=0; x<COLS; x+=blockW) fillRect(x, 0, 1, ROWS, CHARS.ROAD_V, COLORS.FG_ROAD, COLORS.BG_GRASS);
    for(let y=0; y<ROWS; y+=blockH) fillRect(0, y, COLS, 1, CHARS.ROAD_H, COLORS.FG_ROAD, COLORS.BG_GRASS);
    for(let x=0; x<COLS; x+=blockW) for(let y=0; y<ROWS; y+=blockH) setCell(x, y, CHARS.ROAD_C, COLORS.FG_ROAD, COLORS.BG_GRASS);

    // 2. 放置公共建筑 (Priority Placement)
    // 我们手动挑选几个显眼的街区中心来放这些建筑
    // 比如：(1,1) (2,1) (1,2) 这些位置
    const civicLocs = [
        {bx: 2, by: 1}, // 中心
        {bx: 1, by: 1}, // 左侧
        {bx: 3, by: 1}, // 右侧
        {bx: 2, by: 2}, // 下方
        {bx: 1, by: 2}  // 左下
    ];

    let civicIdx = 0;

    // 3. 遍历街区
    for (let by=0; by<Math.floor(ROWS/blockH); by++) {
        for (let bx=0; bx<Math.floor(COLS/blockW); bx++) {
            
            // 街区像素坐标
            const x = bx * blockW + 2;
            const y = by * blockH + 2;
            const w = blockW - 3;
            const h = blockH - 3;

            // 检查是否是预留给公共建筑的位置
            const isCivicSpot = civicLocs.some(loc => loc.bx === bx && loc.by === by);

            if (isCivicSpot && civicIdx < CIVIC_BUILDINGS.length) {
                // === A. 放置独特的公共建筑 ===
                const bldg = CIVIC_BUILDINGS[civicIdx++];
                // 居中放置
                const cx = x + Math.floor((w - bldg.w)/2);
                const cy = y + Math.floor((h - bldg.h)/2);
                drawBuilding(cx, cy, bldg.w, bldg.h, bldg.type as any);
                
                // 周围做成广场/公园
                for(let i=0; i<10; i++) {
                    const tx = x + Math.random()*w;
                    const ty = y + Math.random()*h;
                    if (tx < cx || tx > cx+bldg.w || ty < cy || ty > cy+bldg.h) {
                        setCell(Math.floor(tx), Math.floor(ty), CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                    }
                }
            } 
            else if (bx === 2 && by === 0) { // 这里硬编码一个中心公园位置
                 // === B. 森林公园 ===
                 for(let i=0; i<40; i++) {
                     setCell(x+Math.random()*w, y+Math.random()*h, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                 }
                 // 湖
                 fillRect(x+6, y+4, w-12, h-8, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
            }
            else {
                // === C. 住宅区 (疏密有致) ===
                // 只有 60% 的街区会有房子，留白
                if (Math.random() > 0.4) {
                    // 一个街区只放 1-2 栋，不再填满
                    const houseW = 6, houseH = 5;
                    
                    // 主宅
                    drawBuilding(x + 2, y + 2, houseW, houseH, 'RES');
                    
                    // 可能有附楼/邻居
                    if (Math.random() > 0.5) {
                        drawBuilding(x + w - houseW - 2, y + h - houseH - 2, houseW, houseH, 'RES');
                    }

                    // 院子里的树
                    setCell(x+w-2, y+2, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                    setCell(x+2, y+h-2, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
            }
        }
    }

    return grid;
  }, []);

  // --- 渲染逻辑 ---
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

        // 地图
        mapData.forEach((cell, idx) => {
            const x = (idx % COLS) * charW;
            const y = Math.floor(idx / COLS) * charH;
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, charW+0.5, charH+0.5); }
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y); }
        });

        // 角色 (白色高亮，简洁)
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