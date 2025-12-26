'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. ASCII 字符集 (扩展版) ---
const CHARS = {
  // 地形
  EMPTY: ' ',
  GRASS: '·',        // 草地
  PAVEMENT: '░',     // 广场地面
  WATER: '≈',        // 水面
  
  // 道路系统 (清晰化)
  ROAD_H: '═',       // 水平路
  ROAD_V: '║',       // 垂直路
  ROAD_X: '╬',       // 十字路口
  ROAD_T: '╩',       // 丁字路口
  
  // 建筑外观 (多样化)
  WALL: '#',         // 墙
  DOOR: '+',         // 门
  WINDOW: 'o',       // 窗
  
  // 建筑标识 (作为屋顶或招牌)
  HOME_S: '⌂',       // 小屋
  HOME_L: '𝐇',       // 大屋
  APT:    '🏢',      // 公寓 (Emoji往往占两格，小心使用，这里用字符替代) -> '▓'
  APT_ALT:'▓',
  SHOP:   '¥',       // 商店
  BANK:   '$',       // 银行
  TECH:   'Ω',       // 科技/工厂
  HOSPITAL:'✚',      // 医院
  LIBRARY:'¶',       // 图书馆
  HALL:   '🏛',      // 市政厅 (部分字体支持) -> 'M'
  HALL_ALT:'M',

  // 装饰
  TREE_A: '♣',
  TREE_B: '♠',
  FLOWER: '*',
  LAMP:   '¡',
};

// --- 2. 终端配色 (高对比度) ---
const COLORS = {
  BG:        '#111111', // 全局背景
  
  // 地块背景色 (用来区分区域)
  BG_GRASS:  '#1b2e1b', // 深绿底
  BG_ROAD:   '#222222', // 深灰底
  BG_PLAZA:  '#3e2723', // 深棕底 (广场)
  BG_WATER:  '#0d47a1', // 深蓝底
  BG_BLDG:   '#000000', // 建筑内纯黑

  // 字符前景色
  FG_GRASS:  '#2e7d32', // 暗绿点
  FG_ROAD:   '#757575', // 灰色路标
  FG_WATER:  '#42a5f5', // 亮蓝波纹
  
  // 建筑颜色
  FG_WALL:   '#9e9e9e', // 灰墙
  FG_DOOR:   '#8d6e63', // 棕门
  
  // 不同建筑的高亮色
  FG_HOME:   '#ffab91', // 浅红
  FG_APT:    '#b0bec5', // 银灰
  FG_SHOP:   '#fff59d', // 亮黄
  FG_CIVIC:  '#ce93d8', // 浅紫
  FG_HOSP:   '#ef5350', // 鲜红
  
  // 角色
  FG_AGENT:  '#00e676', // 荧光绿
  BG_AGENT:  '#1b5e20', // 角色底色
};

// 地图尺寸 (大尺寸以容纳细节)
const COLS = 100;
const ROWS = 50;

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const { agents } = worldData || { agents: [] };

  // --- 1. 生成 ASCII 城市数据 ---
  const mapData = useMemo(() => {
    // 初始化网格：字符，前景色，背景色
    const grid = new Array(COLS * ROWS).fill(null).map(() => ({ 
        char: CHARS.GRASS, 
        fg: COLORS.FG_GRASS, 
        bg: COLORS.BG_GRASS 
    }));
    
    // 工具：设置单元格
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string) => {
        if(x>=0 && x<COLS && y>=0 && y<ROWS) {
            const idx = y*COLS+x;
            grid[idx].char = char;
            grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
        }
    };

    // 工具：画矩形块 (如建筑地基)
    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg);
    };

    // 工具：画空心框 (建筑墙壁)
    const drawBox = (x: number, y: number, w: number, h: number, wallChar: string, wallColor: string) => {
        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, wallChar, wallColor, COLORS.BG_BLDG); setCell(ix, y+h-1, wallChar, wallColor, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, wallChar, wallColor, COLORS.BG_BLDG); setCell(x+w-1, iy, wallChar, wallColor, COLORS.BG_BLDG); }
        // 内部清空
        fillRect(x+1, y+1, w-2, h-2, CHARS.EMPTY, COLORS.FG_WALL, COLORS.BG_BLDG);
    };

    // === 城市规划逻辑 ===

    // 1. 路网生成 (Grid)
    // 定义 "井" 字形主干道
    const roadX = [20, 50, 80]; // 竖路位置
    const roadY = [12, 25, 38]; // 横路位置
    const roadWidth = 2;

    // 填充草地背景
    // fillRect(0, 0, COLS, ROWS, CHARS.GRASS, COLORS.FG_GRASS, COLORS.BG_GRASS);

    // 绘制横向主路
    roadY.forEach(y => {
        fillRect(0, y, COLS, roadWidth, CHARS.ROAD_H, COLORS.FG_ROAD, COLORS.BG_ROAD);
    });
    // 绘制纵向主路
    roadX.forEach(x => {
        fillRect(x, 0, roadWidth, ROWS, CHARS.ROAD_V, COLORS.FG_ROAD, COLORS.BG_ROAD);
        // 交叉口修正
        roadY.forEach(y => {
            fillRect(x, y, roadWidth, roadWidth, CHARS.ROAD_X, COLORS.FG_ROAD, COLORS.BG_ROAD);
        });
    });

    // 2. 街区填充 (Zoning)
    // 遍历路网分割出的每个区域
    const boundariesY = [0, ...roadY.map(y=>y+roadWidth), ROWS];
    const boundariesX = [0, ...roadX.map(x=>x+roadWidth), COLS];

    for (let i = 0; i < boundariesY.length - 1; i++) {
        for (let j = 0; j < boundariesX.length - 1; j++) {
            const x = boundariesX[j];
            const y = boundariesY[i];
            const w = boundariesX[j+1] - boundariesX[j] - (j<roadX.length?0:0); 
            const h = boundariesY[i+1] - boundariesY[i] - (i<roadY.length?0:0);
            
            // 有效建筑区 (留边)
            const bx = x + 2, by = y + 2, bw = w - 4, bh = h - 3;
            if (bw < 5 || bh < 5) continue;

            // 区域功能判定
            const centerX = COLS/2, centerY = ROWS/2;
            const dist = Math.sqrt(((bx+bw/2)-centerX)**2 + ((by+bh/2)-centerY)**2);

            // A. 中心广场区 (Central Plaza)
            if (dist < 18) {
                fillRect(bx-1, by-1, bw+2, bh+2, CHARS.PAVEMENT, '#5d4037', COLORS.BG_PLAZA);
                // 大建筑：市政厅
                const hallW = 12, hallH = 8;
                const hx = bx + Math.floor((bw-hallW)/2);
                const hy = by + Math.floor((bh-hallH)/2);
                drawBox(hx, hy, hallW, hallH, CHARS.WALL, COLORS.FG_CIVIC);
                setCell(hx+Math.floor(hallW/2), hy+hallH-1, CHARS.DOOR, COLORS.FG_DOOR, COLORS.BG_BLDG);
                setCell(hx+Math.floor(hallW/2), hy+Math.floor(hallH/2), CHARS.HALL_ALT, COLORS.FG_CIVIC, COLORS.BG_BLDG); // 标识
                // 喷泉
                setCell(hx-4, hy+hallH+2, '~', COLORS.FG_WATER, COLORS.BG_PLAZA);
                setCell(hx+hallW+3, hy+hallH+2, '~', COLORS.FG_WATER, COLORS.BG_PLAZA);
            }
            // B. 北部高密度区 (Apartments)
            else if (by < centerY - 5) {
                // 密集排列
                const aptW = 8, aptH = 5;
                for (let ay = by; ay < by+bh-aptH+1; ay+=aptH+1) {
                    for (let ax = bx; ax < bx+bw-aptW+1; ax+=aptW+1) {
                        drawBox(ax, ay, aptW, aptH, CHARS.WALL, COLORS.FG_APT);
                        setCell(ax+Math.floor(aptW/2), ay+aptH-1, CHARS.DOOR, COLORS.FG_DOOR, COLORS.BG_BLDG);
                        setCell(ax+1, ay+1, CHARS.APT_ALT, COLORS.FG_APT, COLORS.BG_BLDG);
                        setCell(ax+aptW-2, ay+1, CHARS.APT_ALT, COLORS.FG_APT, COLORS.BG_BLDG);
                    }
                }
            }
            // C. 商业街 (Shops)
            else if (Math.random() > 0.6) {
                const shopW = 6, shopH = 5;
                for (let sx = bx; sx < bx+bw-shopW+1; sx+=shopW+1) {
                    drawBox(sx, by, shopW, shopH, CHARS.WALL, COLORS.FG_SHOP);
                    setCell(sx+Math.floor(shopW/2), by+shopH-1, CHARS.DOOR, COLORS.FG_DOOR, COLORS.BG_BLDG);
                    setCell(sx+2, by+2, Math.random()>0.5?CHARS.SHOP:CHARS.BANK, COLORS.FG_SHOP, COLORS.BG_BLDG);
                }
                // 门前铺路
                fillRect(bx, by+shopH, bw, 1, CHARS.PAVEMENT, '#aaa', COLORS.BG_GRASS);
            }
            // D. 南部别墅区 (Houses with yards)
            else {
                const houseW = 6, houseH = 5;
                // 稀疏排列
                for (let hx = bx; hx < bx+bw-houseW+1; hx+=houseW+3) {
                    drawBox(hx, by+1, houseW, houseH, CHARS.WALL, COLORS.FG_HOME);
                    setCell(hx+Math.floor(houseW/2), by+houseH, CHARS.DOOR, COLORS.FG_DOOR, COLORS.BG_BLDG);
                    setCell(hx+2, by+2, CHARS.HOME_S, COLORS.FG_HOME, COLORS.BG_BLDG);
                    // 院子里的树
                    setCell(hx+houseW+1, by+3, CHARS.TREE_A, COLORS.FG_GRASS, COLORS.BG_GRASS);
                }
            }
        }
    }

    // 3. 全局装饰 (Trees & Lamps)
    // 沿路种树
    roadX.forEach(x => {
        for(let y=0; y<ROWS; y+=2) {
            if(Math.random()>0.3) setCell(x-1, y, CHARS.TREE_A, COLORS.FG_GRASS, COLORS.BG_GRASS);
            if(Math.random()>0.3) setCell(x+roadWidth, y, CHARS.TREE_A, COLORS.FG_GRASS, COLORS.BG_GRASS);
        }
    });

    return grid;
  }, []);

  // --- 2. 渲染引擎 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 自适应字号计算 (填满屏幕)
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            const charW = width / COLS;
            const charH = height / ROWS;
            // 字体宽高比通常约为 0.6，反推 fontSize
            // fontSize = charW / 0.6  或者 charH
            const sizeW = charW / 0.6;
            const sizeH = charH;
            const size = Math.floor(Math.min(sizeW, sizeH)); // 取小值以防溢出
            
            setFontSize(Math.max(10, size)); // 最小10px
        }
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // --- 3. 绘制循环 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // 使用 Fira Code 或 Courier New 保证等宽
    const font = `bold ${fontSize}px "Fira Code", "Courier New", monospace`;
    ctx.font = font;
    
    // 测量字符实际尺寸
    const metrics = ctx.measureText('M');
    const charW = metrics.width;
    const charH = fontSize; // 行高稍大一点

    // 重新计算画布大小以匹配字符网格
    const canvasW = COLS * charW;
    const canvasH = ROWS * charH;

    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);
    
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    
    // 背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, canvasW, canvasH);
    
    ctx.font = font;
    ctx.textBaseline = 'top';

    // 1. 绘制地图
    mapData.forEach((cell, idx) => {
        const x = (idx % COLS) * charW;
        const y = Math.floor(idx / COLS) * charH;
        
        // 绘制背景块
        ctx.fillStyle = cell.bg;
        // 稍微画大一点(0.5px)消除缝隙
        ctx.fillRect(x, y, charW+0.5, charH+0.5);

        // 绘制字符
        if (cell.char !== ' ') {
            ctx.fillStyle = cell.fg;
            ctx.fillText(cell.char, x, y);
        }
    });

    // 2. 绘制角色 (覆盖)
    agents.forEach((agent: any) => {
        const tx = Math.floor((agent.x / 100) * COLS);
        const ty = Math.floor((agent.y / 100) * ROWS);
        
        if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
            const x = tx * charW;
            const y = ty * charH;

            // 角色高亮底色
            ctx.fillStyle = COLORS.BG_AGENT;
            ctx.fillRect(x, y, charW, charH);

            // 角色字 (@ 或 首字母)
            ctx.fillStyle = COLORS.FG_AGENT;
            ctx.fillText('@', x, y);
            
            // 悬浮名字
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${fontSize*0.7}px monospace`;
            ctx.fillText(agent.name, x, y - charH*0.8);
            // 还原字体
            ctx.font = font;
        }
    });

  }, [fontSize, mapData, agents]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#111] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="shadow-2xl" />
    </div>
  );
}