'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. ASCII 字符集 (增强版) ---
const CHARS: any = {
  // 地形
  EMPTY: ' ',
  GRASS: '·',        // 草地
  FOREST: '♣',       // 森林
  PAVEMENT: '░',     // 广场
  WATER: '≈',        // 水
  
  // 交通
  ROAD_H: '═',
  ROAD_V: '║',
  ROAD_X: '╬',
  BUS: '🚌',         // 公交车 (动态)
  STOP: '🚏',        // 车站牌
  
  // 建筑墙体
  WALL: '#',
  DOOR: '+',
  WIN: 'o',
  
  // 建筑标识 (Roof/Sign)
  HOME_S: '⌂',       // 小屋
  HOME_L: '𝐇',       // 别墅
  APT:    '▓',       // 公寓
  
  // 公共设施 (新)
  CLINIC: '✚',       // 诊所
  CAFE:   '☕',       // 咖啡
  REST:   'Ψ',       // 餐馆
  LIB:    '¶',       // 图书馆
  HALL:   '🏛',      // 市政厅
  STATION:'🚉',      // 交通枢纽
};

// --- 2. 配色方案 (霓虹/终端风) ---
const COLORS: any = {
  BG:        '#111111', 
  
  // 环境底色
  BG_GRASS:  '#1b2e1b', 
  BG_FOREST: '#0e230e', // 深林色
  BG_ROAD:   '#222222', 
  BG_PLAZA:  '#3e2723', 
  BG_WATER:  '#0d47a1', 
  BG_BLDG:   '#000000',

  // 前景
  FG_GRASS:  '#2e7d32', 
  FG_FOREST: '#43a047', // 亮绿树
  FG_ROAD:   '#555555', 
  FG_WATER:  '#42a5f5', 
  
  // 建筑标识色
  FG_WALL:   '#757575',
  FG_DOOR:   '#8d6e63',
  
  FG_HOME:   '#ffab91', // 浅红
  FG_APT:    '#90a4ae', // 蓝灰
  FG_CLINIC: '#ef5350', // 红十字
  FG_CAFE:   '#dce775', // 柠檬黄
  FG_REST:   '#ffcc80', // 橙色
  FG_LIB:    '#81d4fa', // 浅蓝
  FG_HALL:   '#ce93d8', // 紫色
  FG_STATION:'#bdbdbd', // 银色
  
  // 交通
  FG_BUS:    '#ffeb3b', // 黄色公交
  FG_STOP:   '#4db6ac', // 青色站牌
  
  // 角色
  FG_AGENT:  '#00e676', 
  BG_AGENT:  '#1b5e20', 
};

const COLS = 100;
const ROWS = 50;

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);
  
  // 前端模拟交通流
  const [buses, setBuses] = useState<{x:number, y:number, dx:number, dy:number}[]>([]);

  const { agents } = worldData || { agents: [] };

  // --- 1. 生成静态地图数据 ---
  const mapData = useMemo(() => {
    const grid = new Array(COLS * ROWS).fill(null).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS, isRoad: false 
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string, isRoad = false) => {
        if(x>=0 && x<COLS && y>=0 && y<ROWS) {
            const cell = grid[y*COLS+x];
            cell.char = char; cell.fg = fg;
            if(bg) cell.bg = bg;
            cell.isRoad = isRoad;
        }
    };

    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg);
    };

    const drawBox = (x: number, y: number, w: number, h: number, fg: string, symbol: string) => {
        // 墙
        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, COLORS.FG_WALL, COLORS.BG_BLDG); setCell(ix, y+h-1, CHARS.WALL, COLORS.FG_WALL, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, COLORS.FG_WALL, COLORS.BG_BLDG); setCell(x+w-1, iy, CHARS.WALL, COLORS.FG_WALL, COLORS.BG_BLDG); }
        // 内部清空
        fillRect(x+1, y+1, w-2, h-2, ' ', COLORS.FG_WALL, COLORS.BG_BLDG);
        // 门 (底部中间)
        setCell(x+Math.floor(w/2), y+h-1, CHARS.DOOR, COLORS.FG_DOOR, COLORS.BG_BLDG);
        // 标识 (中心)
        setCell(x+Math.floor(w/2), y+Math.floor(h/2), symbol, fg, COLORS.BG_BLDG);
    };

    // === 城市规划 ===
    
    // 1. 路网 (Grid)
    const roadX = [15, 38, 62, 85]; 
    const roadY = [10, 25, 40];
    const roadW = 2;

    // 绘制路 (修复处)
    roadY.forEach(y => {
        for(let x=0; x<COLS; x++) {
            setCell(x, y, CHARS.ROAD_H, COLORS.FG_ROAD, COLORS.BG_ROAD, true);
            setCell(x, y+1, CHARS.ROAD_H, COLORS.FG_ROAD, COLORS.BG_ROAD, true); // 双车道
        }
    });
    roadX.forEach(x => {
        for(let y=0; y<ROWS; y++) {
            setCell(x, y, CHARS.ROAD_V, COLORS.FG_ROAD, COLORS.BG_ROAD, true);
            setCell(x+1, y, CHARS.ROAD_V, COLORS.FG_ROAD, COLORS.BG_ROAD, true);
        }
        roadY.forEach(y => fillRect(x, y, 2, 2, CHARS.ROAD_X, COLORS.FG_ROAD, COLORS.BG_ROAD));
    });

    // 2. 区域填充
    const boundariesY = [0, ...roadY.map(y=>y+roadW), ROWS];
    const boundariesX = [0, ...roadX.map(x=>x+roadW), COLS];

    for (let i = 0; i < boundariesY.length - 1; i++) {
        for (let j = 0; j < boundariesX.length - 1; j++) {
            const x = boundariesX[j], y = boundariesY[i];
            const w = boundariesX[j+1] - boundariesX[j] - (j<roadX.length?0:0); 
            const h = boundariesY[i+1] - boundariesY[i] - (i<roadY.length?0:0);
            
            const bx = x+2, by = y+2, bw = w-4, bh = h-4;
            if(bw<6 || bh<6) continue;

            const cx = COLS/2, cy = ROWS/2;
            const dist = Math.sqrt(((bx+bw/2)-cx)**2 + ((by+bh/2)-cy)**2);

            // A. 中心行政区 (Civic Core)
            if (dist < 15) {
                fillRect(bx-1, by-1, bw+2, bh+2, CHARS.PAVEMENT, '#5d4037', COLORS.BG_PLAZA);
                // 大建筑：市政厅
                const hallW = 14, hallH = 8;
                const hx = bx + Math.floor((bw-hallW)/2), hy = by + Math.floor((bh-hallH)/2);
                drawBox(hx, hy, hallW, hallH, COLORS.FG_HALL, CHARS.HALL);
                // 两个侧翼：图书馆 & 车站
                if(bw > 20) {
                    drawBox(bx, hy+1, 8, 6, COLORS.FG_LIB, CHARS.LIB); // Library
                    drawBox(bx+bw-8, hy+1, 8, 6, COLORS.FG_STATION, CHARS.STATION); // Station
                }
                // 喷泉
                setCell(hx+hallW/2, hy+hallH+2, '~', COLORS.FG_WATER, COLORS.BG_PLAZA);
            }
            // B. 商业环区 (Commercial)
            else if (dist < 35) {
                // 沿街商业
                const shopW = 6, shopH = 5;
                for(let sx=bx; sx<bx+bw-shopW; sx+=shopW+2) {
                    // 上排
                    const type = Math.random();
                    let symbol = CHARS.SHOP, color = COLORS.FG_SHOP;
                    if(type>0.7) { symbol=CHARS.CAFE; color=COLORS.FG_CAFE; } // 咖啡
                    else if(type>0.4) { symbol=CHARS.REST; color=COLORS.FG_REST; } // 餐馆
                    
                    drawBox(sx, by, shopW, shopH, color, symbol);
                    
                    // 下排 (公寓或更多商店)
                    if(bh > 12) {
                        drawBox(sx, by+bh-shopH, shopW, shopH, COLORS.FG_APT, CHARS.APT);
                    }
                }
            }
            // C. 森林公园 (Forest Park) - 随机几个区域
            else if ((i+j)%5 === 3) {
                // 密集种树
                for(let py=by; py<by+bh; py++) for(let px=bx; px<bx+bw; px++) {
                    if(Math.random()>0.3) setCell(px, py, CHARS.FOREST, COLORS.FG_FOREST, COLORS.BG_FOREST);
                }
                // 林中小屋
                drawBox(bx+Math.floor(bw/2)-3, by+Math.floor(bh/2)-2, 6, 5, COLORS.FG_HOME, CHARS.HOME_S);
            }
            // D. 居住区 (Residential)
            else {
                // 社区诊所 (每个大居住区配一个)
                if(Math.random() > 0.7) {
                    drawBox(bx, by, 8, 6, COLORS.FG_CLINIC, CHARS.CLINIC);
                }
                // 别墅群
                const houseW = 6, houseH = 5;
                for(let hx=bx+2; hx<bx+bw-houseW; hx+=houseW+2) {
                    for(let hy=by+2; hy<by+bh-houseH; hy+=houseH+2) {
                        if(grid[hy*COLS+hx].char === CHARS.GRASS) { // 没被占
                            drawBox(hx, hy, houseW, houseH, COLORS.FG_HOME, CHARS.HOME_S);
                        }
                    }
                }
            }
        }
    }

    // 3. 交通设施 (Bus Stops)
    // 在主干道交叉口附近放置
    roadX.forEach(x => {
        roadY.forEach(y => {
            setCell(x+roadW, y-2, CHARS.STOP, COLORS.FG_STOP, COLORS.BG_ROAD);
            setCell(x-1, y+roadW+2, CHARS.STOP, COLORS.FG_STOP, COLORS.BG_ROAD);
        });
    });

    return grid;
  }, []);

  // --- 2. 交通模拟 (Simple Simulation) ---
  useEffect(() => {
    // 初始化几辆公交车
    const initBuses = [
        {x: 20, y: 0, dx: 0, dy: 1}, // 竖向
        {x: 50, y: 49, dx: 0, dy: -1},
        {x: 0, y: 25, dx: 1, dy: 0}, // 横向
        {x: 99, y: 12, dx: -1, dy: 0},
    ];
    setBuses(initBuses);

    const timer = setInterval(() => {
        setBuses(prev => prev.map(bus => {
            let nx = bus.x + bus.dx;
            let ny = bus.y + bus.dy;
            
            // 边界循环
            if(nx >= COLS) nx = 0; if(nx < 0) nx = COLS-1;
            if(ny >= ROWS) ny = 0; if(ny < 0) ny = ROWS-1;

            // 简单转向逻辑：遇到十字路口随机转向
            // 这里简化为一直直走，模拟固定线路
            return { ...bus, x: nx, y: ny };
        }));
    }, 200); // 移动速度

    return () => clearInterval(timer);
  }, []);

  // --- 3. 渲染循环 ---
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
            const size = Math.floor(Math.min(charW / 0.6, charH));
            setFontSize(Math.max(10, size));
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

        // 1. 静态地图
        mapData.forEach((cell, idx) => {
            const x = (idx % COLS) * charW;
            const y = Math.floor(idx / COLS) * charH;
            
            ctx.fillStyle = cell.bg;
            ctx.fillRect(x, y, charW+0.5, charH+0.5);

            if (cell.char !== ' ') {
                ctx.fillStyle = cell.fg;
                ctx.fillText(cell.char, x, y);
            }
        });

        // 2. 动态公交车
        buses.forEach(bus => {
            const x = bus.x * charW;
            const y = bus.y * charH;
            ctx.fillStyle = COLORS.FG_BUS;
            ctx.fillText(CHARS.BUS, x, y);
        });

        // 3. 角色
        agents.forEach((agent: any) => {
            const tx = Math.floor((agent.x / 100) * COLS);
            const ty = Math.floor((agent.y / 100) * ROWS);
            if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                const x = tx * charW;
                const y = ty * charH;
                ctx.fillStyle = COLORS.BG_AGENT;
                ctx.fillRect(x, y, charW, charH);
                ctx.fillStyle = COLORS.FG_AGENT;
                ctx.fillText('@', x, y);
                // 名字
                ctx.fillStyle = '#fff';
                ctx.font = `${fontSize*0.7}px monospace`;
                ctx.fillText(agent.name, x, y-charH*0.8);
                ctx.font = `bold ${fontSize}px "Fira Code", monospace`; // 恢复
            }
        });
    }

    return () => resizeObserver.disconnect();
  }, [fontSize, mapData, agents, buses]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#111] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
}