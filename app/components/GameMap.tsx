'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. ASCII 字符映射表 ---
const CHARS = {
  EMPTY: ' ',
  GRASS: '·',        // 草地：中点
  GRASS_D: '"',      // 茂密草丛：双引号
  WATER: '≈',        // 水：约等于
  ROAD: '░',         // 路：阴影块
  WALL_H: '═',       // 墙：双横线
  WALL_V: '║',       // 墙：双竖线
  WALL_C: '╬',       // 墙：交叉
  FLOOR: ' ',        // 地板：空格 (干净)
  DOOR: '▓',         // 门：实心块
  TREE: '♣',         // 树：梅花
  PLANT: '¥',        // 盆栽
  BED: '□',          // 床
  TABLE: '┬',        // 桌子
};

// --- 2. 终端配色 (Terminal Theme) ---
const COLORS = {
  BG:        '#0c0c0c', // 纯黑底
  GRASS:     '#333333', // 暗灰草地 (低对比，作为背景)
  GRASS_D:   '#555555', // 稍亮草丛
  WATER:     '#1e88e5', // 亮蓝
  ROAD:      '#424242', // 路面灰
  
  // 建筑
  WALL:      '#d4d4d4', // 亮白墙
  FLOOR:     '#222222', // 暗室地板
  DOOR:      '#8d6e63', // 棕色门
  FURNITURE: '#a1887f', // 家具色
  
  // 装饰
  TREE:      '#43a047', // 鲜绿树
  
  // 角色
  AGENT:     '#fdd835', // 亮黄主角
  AGENT_BG:  '#b71c1c', // 主角背景(强调)
};

// 地图尺寸
const COLS = 80;
const ROWS = 45;

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const { agents } = worldData || { agents: [] };

  // --- 1. 生成 ASCII 世界数据 ---
  const mapData = useMemo(() => {
    // 存储每个格子的 { char, color }
    const grid = new Array(COLS * ROWS).fill(null).map(() => ({ char: CHARS.GRASS, color: COLORS.GRASS }));
    
    // 辅助：设置格子
    const setCell = (x: number, y: number, char: string, color: string) => {
        if(x>=0 && x<COLS && y>=0 && y<ROWS) grid[y*COLS+x] = { char, color };
    };
    
    // 辅助：画矩形
    const drawRect = (x: number, y: number, w: number, h: number, char: string, color: string) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, color);
    };

    // 辅助：画框（墙）
    const drawBox = (x: number, y: number, w: number, h: number) => {
        // 顶底
        for(let ix=x; ix<x+w; ix++) {
            setCell(ix, y, CHARS.WALL_H, COLORS.WALL);
            setCell(ix, y+h-1, CHARS.WALL_H, COLORS.WALL);
        }
        // 左右
        for(let iy=y; iy<y+h; iy++) {
            setCell(x, iy, CHARS.WALL_V, COLORS.WALL);
            setCell(x+w-1, iy, CHARS.WALL_V, COLORS.WALL);
        }
        // 角落 (简化处理)
        setCell(x, y, CHARS.WALL_C, COLORS.WALL);
        setCell(x+w-1, y, CHARS.WALL_C, COLORS.WALL);
        setCell(x, y+h-1, CHARS.WALL_C, COLORS.WALL);
        setCell(x+w-1, y+h-1, CHARS.WALL_C, COLORS.WALL);
        
        // 内部地板
        drawRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, COLORS.FLOOR);
    };

    // === 生成逻辑 ===
    
    // 1. 随机噪点草地
    for(let i=0; i<grid.length; i++) {
        if(Math.random() > 0.9) grid[i] = { char: CHARS.GRASS_D, color: COLORS.GRASS_D };
    }

    // 2. 河流 (Sine Wave River)
    for(let x=0; x<COLS; x++) {
        const y = Math.floor(20 + Math.sin(x/5) * 5);
        drawRect(x, y, 1, 3, CHARS.WATER, COLORS.WATER);
    }

    // 3. 道路网
    const roadX = 20, roadY = 15;
    for(let x=0; x<COLS; x+=roadX) drawRect(x, 0, 2, ROWS, CHARS.ROAD, COLORS.ROAD);
    for(let y=0; y<ROWS; y+=roadY) drawRect(0, y, COLS, 1, CHARS.ROAD, COLORS.ROAD);

    // 4. 建筑生成
    for(let by=2; by<ROWS-10; by+=roadY) {
        for(let bx=2; bx<COLS-10; bx+=roadX) {
            // 在网格空隙中生成房子
            const houseW = 10, houseH = 8;
            const hx = bx + 4;
            const hy = by + 2;
            
            // 避开河流
            const riverY = Math.floor(20 + Math.sin(hx/5) * 5);
            if (Math.abs(hy - riverY) < 10) continue; 

            drawBox(hx, hy, houseW, houseH);
            
            // 门
            setCell(hx + houseW/2, hy + houseH - 1, CHARS.DOOR, COLORS.DOOR);
            
            // 家具
            setCell(hx+1, hy+1, CHARS.BED, COLORS.FURNITURE);
            setCell(hx+houseW-2, hy+1, CHARS.PLANT, COLORS.TREE);
            setCell(hx+houseW/2, hy+houseH/2, CHARS.TABLE, COLORS.FURNITURE);
        }
    }

    // 5. 树木
    for(let i=0; i<100; i++) {
        const x = Math.floor(Math.random()*COLS);
        const y = Math.floor(Math.random()*ROWS);
        // 只在草地上种树
        if(grid[y*COLS+x].char === CHARS.GRASS) {
            setCell(x, y, CHARS.TREE, COLORS.TREE);
        }
    }

    return grid;
  }, []);

  // --- 2. 渲染引擎 (Canvas Text) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 自适应字号计算
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            // 计算单字符最大尺寸 (假设字体高宽比约 0.6)
            // 目标是填满宽高
            const charW = width / COLS;
            const charH = height / ROWS;
            
            // 简单估算：通常 monospace 字体高度 ≈ 宽度 / 0.6
            // 我们保守取较小值以防溢出
            const size = Math.floor(Math.min(charW / 0.6, charH));
            setFontSize(Math.max(8, size)); // 最小8px
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

    // 设置画布物理尺寸
    const dpr = window.devicePixelRatio || 1;
    // 字符实际占用宽高
    // Monospace 字体通常 width ≈ 0.6 * fontSize
    // 这里我们用 measureText 动态获取更准
    ctx.font = `${fontSize}px "Fira Code", "Courier New", monospace`; 
    const metrics = ctx.measureText('M');
    const charW = metrics.width;
    const charH = fontSize; // 行高

    const canvasW = COLS * charW;
    const canvasH = ROWS * charH;

    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);
    
    // 样式设置
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    
    // 背景清空
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, canvasW, canvasH);
    
    // 设置字体
    ctx.font = `bold ${fontSize}px "Fira Code", "Courier New", monospace`;
    ctx.textBaseline = 'top';

    // 1. 绘制地图字符
    mapData.forEach((cell, idx) => {
        const x = (idx % COLS) * charW;
        const y = Math.floor(idx / COLS) * charH;
        
        ctx.fillStyle = cell.color;
        ctx.fillText(cell.char, x, y);
    });

    // 2. 绘制角色 (覆盖在地图上)
    agents.forEach((agent: any) => {
        // 坐标映射
        const tx = Math.floor((agent.x / 100) * COLS);
        const ty = Math.floor((agent.y / 100) * ROWS);
        
        if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
            const x = tx * charW;
            const y = ty * charH;

            // 角色背景高亮块
            ctx.fillStyle = COLORS.AGENT_BG; // 红色底块
            ctx.fillRect(x, y, charW, charH);

            // 角色字符 (名字首字母)
            ctx.fillStyle = COLORS.AGENT; // 黄色字
            ctx.fillText('@', x, y); // 或者用 agent.name[0]
            
            // 名字标签 (悬浮字)
            ctx.fillStyle = '#ffffff';
            ctx.font = `${fontSize*0.8}px monospace`;
            ctx.fillText(agent.name, x, y - charH);
            // 恢复字体
            ctx.font = `bold ${fontSize}px "Fira Code", "Courier New", monospace`;
        }
    });

  }, [fontSize, mapData, agents]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0c0c0c] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="shadow-none" />
    </div>
  );
}