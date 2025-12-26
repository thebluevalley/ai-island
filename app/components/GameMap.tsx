'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 纯粹 ASCII 字符集 ---
// 不再使用 Emoji，回归几何图形
const CHARS: any = {
  EMPTY: ' ',
  GRASS: '·',        // 地面纹理
  TREE:  '♣',        // 树木 (密集时形成森林)
  WATER: '≈',        // 水面
  
  // 道路 (线框风格)
  ROAD_H: '═',
  ROAD_V: '║',
  ROAD_C: '╬',
  
  // 建筑构造
  WALL: '#',         // 墙体 (通用)
  DOOR: '+',         // 门
  FLOOR: '.',        // 室内地面
};

// --- 2. 建筑学配色 (通过颜色区分功能) ---
const COLORS: any = {
  BG:        '#0f0f0f', 
  
  // 环境
  BG_GRASS:  '#1a1a1a', 
  FG_GRASS:  '#333333', 
  FG_FOREST: '#2e7d32', // 深绿森林
  FG_WATER:  '#1565c0', // 深蓝水域
  
  FG_ROAD:   '#424242', // 暗灰道路
  
  // === 核心：通过颜色区分建筑类型 ===
  
  // 1. 居住 (Residential) - 暖色、甚至略显拥挤
  FG_RES_WALL: '#d84315', // 砖红墙
  FG_RES_DOOR: '#ffab91',
  
  // 2. 商业 (Commercial) - 冷色、明亮
  FG_COM_WALL: '#0277bd', // 亮蓝墙
  FG_COM_DOOR: '#81d4fa',
  
  // 3. 公共/行政 (Civic) - 庄重、独特
  FG_CIV_WALL: '#9c27b0', // 紫色/金色
  FG_CIV_DOOR: '#e1bee7',
  
  // 室内通用
  BG_BLDG:   '#050505', // 室内全黑，突出轮廓
};

const COLS = 120; // 宽度增加，容纳更多建筑
const ROWS = 60;

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const { agents } = worldData || { agents: [] };

  // --- 1. 生成高密度地图 ---
  const mapData = useMemo(() => {
    const grid = new Array(COLS * ROWS).fill(null).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS 
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string) => {
        if(x>=0 && x<COLS && y>=0 && y<ROWS) {
            const idx = y*COLS+x;
            grid[idx].char = char;
            grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
        }
    };

    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg);
    };

    // 建筑绘制器
    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }

        // 墙体轮廓
        for(let ix=x; ix<x+w; ix++) { 
            setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG); 
            setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG); 
        }
        for(let iy=y; iy<y+h; iy++) { 
            setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); 
            setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); 
        }
        
        // 内部清空 (地板)
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#222', COLORS.BG_BLDG);
        
        // 门 (根据建筑大小决定门的位置和数量)
        const doorX = x + Math.floor(w/2);
        setCell(doorX, y+h-1, CHARS.DOOR, doorColor, COLORS.BG_BLDG);
    };

    // === 城市规划逻辑 ===

    // 1. 生成棋盘路网 (Dense Grid)
    const blockW = 16; 
    const blockH = 12;
    const roadW = 1; // 单线道路，节省空间给建筑

    // 绘制横纵道路
    for (let x = 0; x < COLS; x+=blockW) fillRect(x, 0, roadW, ROWS, CHARS.ROAD_V, COLORS.FG_ROAD, COLORS.BG_GRASS);
    for (let y = 0; y < ROWS; y+=blockH) fillRect(0, y, COLS, roadW, CHARS.ROAD_H, COLORS.FG_ROAD, COLORS.BG_GRASS);
    // 交叉点
    for (let x = 0; x < COLS; x+=blockW) for (let y = 0; y < ROWS; y+=blockH) setCell(x, y, CHARS.ROAD_C, COLORS.FG_ROAD, COLORS.BG_GRASS);

    // 2. 街区填充 (Zoning & Filling)
    const cx = COLS / 2;
    const cy = ROWS / 2;

    for (let y = 0; y < ROWS; y += blockH) {
        for (let x = 0; x < COLS; x += blockW) {
            // 街区有效区域
            const bx = x + roadW + 1;
            const by = y + roadW + 1;
            const bw = blockW - roadW - 2;
            const bh = blockH - roadW - 2;
            
            if (bx + bw >= COLS || by + bh >= ROWS) continue;

            const dist = Math.sqrt((x-cx)**2 + (y-cy)**2);

            // A. 中心公园 (Central Park) - 成片森林
            if (dist < 15) {
                // 填满树木
                for(let py=by; py<by+bh; py++) {
                    for(let px=bx; px<bx+bw; px++) {
                        // 80% 密度
                        if(Math.random() > 0.2) setCell(px, py, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                    }
                }
                // 中心湖
                if(x === Math.floor(COLS/2 - blockW/2) || x === Math.floor(COLS/2 + blockW/2)) {
                     fillRect(bx+2, by+2, bw-4, bh-4, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                }
                continue;
            }

            // B. 核心区 (Civic Center) - 巨大建筑
            if (dist < 28) {
                // 一个街区只放一个大建筑
                const type = (x+y)%3 === 0 ? 'CIV' : 'COM';
                drawBuilding(bx, by, bw, bh, type);
                continue;
            }

            // C. 住宅区 (Residential) - 极高密度
            // 在一个街区内尝试塞入 4 个小房子
            const houseW = 5;
            const houseH = 4;
            
            // 紧凑排列: 2x2 网格
            // Top-Left
            drawBuilding(bx, by, houseW, houseH, 'RES');
            // Top-Right
            drawBuilding(bx + bw - houseW, by, houseW, houseH, 'RES');
            // Bottom-Left
            drawBuilding(bx, by + bh - houseH, houseW, houseH, 'RES');
            // Bottom-Right
            drawBuilding(bx + bw - houseW, by + bh - houseH, houseW, houseH, 'RES');

            // 缝隙种树
            setCell(bx + houseW + 1, by + houseH + 1, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
        }
    }

    return grid;
  }, []);

  // --- 2. 渲染引擎 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 自适应字号
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            const charW = width / COLS;
            const charH = height / ROWS;
            // 计算最大合适的字号
            const size = Math.floor(Math.min(charW / 0.6, charH));
            setFontSize(Math.max(8, size));
        }
    });
    resizeObserver.observe(container);

    // 绘制
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

        // 背景
        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textBaseline = 'top';

        // 绘制地图
        mapData.forEach((cell, idx) => {
            const x = (idx % COLS) * charW;
            const y = Math.floor(idx / COLS) * charH;
            
            // 背景
            if (cell.bg) {
                ctx.fillStyle = cell.bg;
                ctx.fillRect(x, y, charW+0.5, charH+0.5);
            }

            // 字符
            if (cell.char !== ' ') {
                ctx.fillStyle = cell.fg;
                ctx.fillText(cell.char, x, y);
            }
        });

        // 绘制角色 (高亮显示)
        agents.forEach((agent: any) => {
            const tx = Math.floor((agent.x / 100) * COLS);
            const ty = Math.floor((agent.y / 100) * ROWS);
            if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                const x = tx * charW;
                const y = ty * charH;
                
                // 角色光标背景
                ctx.fillStyle = COLORS.BG_AGENT; 
                ctx.fillRect(x, y, charW, charH);
                
                // 角色字符
                ctx.fillStyle = COLORS.FG_AGENT;
                ctx.fillText('@', x, y);
                
                // 名字标签
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(8, fontSize*0.6)}px monospace`;
                ctx.fillText(agent.name, x, y - charH * 0.8);
                ctx.font = `bold ${fontSize}px "Fira Code", monospace`; // 恢复
            }
        });
    }

    return () => resizeObserver.disconnect();
  }, [fontSize, mapData, agents]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0f0f0f] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
}