'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 地图参数 (全景模式) ---
const TILE_SIZE = 32;
const MAP_COLS = 80; // 宽度
const MAP_ROWS = 60; // 高度

// 地块类型
const TILES = {
  GRASS: 0,
  ROAD: 1,
  PAVEMENT: 2, // 商业区硬化路面
  WATER: 3,
  PARK: 4,     // 公园绿地
};

// 建筑类型
const BLDG = {
  HOME_S: 'home_s',   // 小民居
  HOME_L: 'home_l',   // 大民居
  SHOP:   'shop',     // 商店
  OFFICE: 'office',   // 办公楼
  CIVIC:  'civic',    // 市政
};

// --- 2. 高对比度配色 (全景下依然清晰) ---
const COLORS = {
  BG:        '#cfd8dc', // 画布背景(防穿帮)
  
  // 地面
  GRASS:     '#c8e6c9', // 浅绿
  ROAD:      '#eceff1', // 亮灰
  PAVEMENT:  '#fff9c4', // 米黄 (商业区)
  WATER:     '#81d4fa', // 蓝
  PARK:      '#a5d6a7', // 深绿 (公园)

  // 建筑墙体
  WALL:      '#ffffff', // 纯白墙
  WALL_S:    '#b0bec5', // 墙阴影
  
  // 屋顶 (高饱和度，方便识别)
  ROOF_RED:  '#ff8a65', // 民居红
  ROOF_BLUE: '#64b5f6', // 商业蓝
  ROOF_GOLD: '#ffd54f', // 公共黄
  ROOF_GRAY: '#90a4ae', // 办公灰

  // 细节
  SHADOW:    'rgba(0,0,0,0.2)', // 投影
  TREE:      '#43a047', // 树
  DOOR:      '#5d4037', // 门
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 初始状态
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 城市生成器 (保证填满) ---
  const cityData = useMemo(() => {
    const grid = new Uint8Array(MAP_COLS * MAP_ROWS).fill(TILES.GRASS);
    const buildings: any[] = [];
    const props: any[] = [];

    // 辅助: 填充
    const fill = (x: number, y: number, w: number, h: number, t: number) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) 
            if(ix>=0 && ix<MAP_COLS && iy>=0 && iy<MAP_ROWS) grid[iy*MAP_COLS+ix] = t;
    };
    // 辅助: 加建筑
    const addBldg = (x: number, y: number, w: number, h: number, type: string) => {
        buildings.push({ x, y, w, h, type });
        // 建筑下铺地板
        fill(x, y, w, h, TILES.PAVEMENT);
    };

    // === 生成逻辑 ===
    // 1. 划分大网格 (Grid Layout)
    const roadW = 2;
    const blockW = 12; // 街区宽
    const blockH = 10; // 街区高

    // 铺路
    for(let x=2; x<MAP_COLS; x+=blockW) fill(x, 0, roadW, MAP_ROWS, TILES.ROAD);
    for(let y=2; y<MAP_ROWS; y+=blockH) fill(0, y, MAP_COLS, roadW, TILES.ROAD);

    // 2. 填充每个格子
    for(let by=2; by<MAP_ROWS-blockH; by+=blockH) {
        for(let bx=2; bx<MAP_COLS-blockW; bx+=blockW) {
            
            // 街区内部
            const ix = bx + roadW;
            const iy = by + roadW;
            const iw = blockW - roadW;
            const ih = blockH - roadW;

            // 简单的分区逻辑
            const centerX = MAP_COLS/2, centerY = MAP_ROWS/2;
            const dist = Math.sqrt((bx-centerX)**2 + (by-centerY)**2);

            if (dist < 15) {
                // A. 市中心 (Civic)
                fill(ix, iy, iw, ih, TILES.PAVEMENT);
                addBldg(ix+1, iy+1, iw-2, ih-2, BLDG.CIVIC);
            } 
            else if (dist < 30) {
                // B. 商业区 (Commercial)
                fill(ix, iy, iw, ih, TILES.PAVEMENT);
                // 上下两排商店
                addBldg(ix+1, iy+1, iw-2, 3, BLDG.SHOP);
                addBldg(ix+1, iy+ih-4, iw-2, 3, BLDG.SHOP);
            }
            else if ((bx+by)%11 === 0) {
                // C. 公园 (Park)
                fill(ix, iy, iw, ih, TILES.PARK);
                fill(ix+2, iy+2, iw-4, ih-4, TILES.WATER); // 湖
                // 种树
                props.push({x:ix, y:iy, type:'tree'});
                props.push({x:ix+iw-1, y:iy, type:'tree'});
                props.push({x:ix, y:iy+ih-1, type:'tree'});
                props.push({x:ix+iw-1, y:iy+ih-1, type:'tree'});
            }
            else {
                // D. 住宅区 (Residential) - 填满！
                // 四个角各一个小房子
                const hw = 3, hh = 3;
                addBldg(ix+1, iy+1, hw, hh, BLDG.HOME_S);
                addBldg(ix+iw-hw-1, iy+1, hw, hh, BLDG.HOME_S);
                addBldg(ix+1, iy+ih-hh-1, hw, hh, BLDG.HOME_S);
                addBldg(ix+iw-hw-1, iy+ih-hh-1, hw, hh, BLDG.HOME_S);
                // 中间种树
                props.push({x:ix+iw/2, y:iy+ih/2, type:'tree'});
            }
        }
    }

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染 (Canvas) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = MAP_COLS * TILE_SIZE;
    const h = MAP_ROWS * TILE_SIZE;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // 1. 地面
    const { grid, buildings, props } = cityData;
    ctx.fillStyle = COLORS.GRASS; ctx.fillRect(0, 0, w, h);

    for(let y=0; y<MAP_ROWS; y++) {
        for(let x=0; x<MAP_COLS; x++) {
            const t = grid[y*MAP_COLS+x];
            const px = x*TILE_SIZE, py = y*TILE_SIZE;
            if(t===TILES.ROAD) { ctx.fillStyle = COLORS.ROAD; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
            else if(t===TILES.PAVEMENT) { ctx.fillStyle = COLORS.PAVEMENT; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
            else if(t===TILES.WATER) { ctx.fillStyle = COLORS.WATER; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
            else if(t===TILES.PARK) { ctx.fillStyle = COLORS.PARK; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
        }
    }

    // 2. 装饰
    props.forEach(p => {
        const px = p.x*TILE_SIZE, py = p.y*TILE_SIZE;
        ctx.fillStyle = COLORS.SHADOW; ctx.beginPath(); ctx.arc(px+16, py+24, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#795548'; ctx.fillRect(px+12, py+16, 8, 8); // 干
        ctx.fillStyle = COLORS.TREE; ctx.beginPath(); ctx.arc(px+16, py+10, 12, 0, Math.PI*2); ctx.fill(); // 冠
    });

    // 3. 建筑 (2.5D Block)
    buildings.forEach(b => {
        const px = b.x*TILE_SIZE, py = b.y*TILE_SIZE, pw = b.w*TILE_SIZE, ph = b.h*TILE_SIZE;
        
        // 阴影
        ctx.fillStyle = COLORS.SHADOW; ctx.fillRect(px+6, py+6, pw, ph);

        // 墙
        const wallH = ph * 0.5;
        const wallY = py + ph - wallH;
        ctx.fillStyle = COLORS.WALL; ctx.fillRect(px, wallY, pw, wallH);
        ctx.fillStyle = COLORS.WALL_S; ctx.fillRect(px, wallY+wallH-2, pw, 2);

        // 门
        ctx.fillStyle = COLORS.DOOR; ctx.fillRect(px+pw/2-6, wallY+wallH-10, 12, 10);

        // 屋顶
        let roofC = COLORS.ROOF_RED;
        if(b.type===BLDG.SHOP) roofC = COLORS.ROOF_BLUE;
        if(b.type===BLDG.CIVIC) roofC = COLORS.ROOF_GOLD;
        if(b.type===BLDG.OFFICE) roofC = COLORS.ROOF_GRAY;

        ctx.fillStyle = roofC;
        // 简单三角顶/平顶
        if(b.type===BLDG.CIVIC || b.type===BLDG.SHOP) {
            ctx.fillRect(px-2, py, pw+4, wallY-py); // 平顶
        } else {
            ctx.beginPath(); ctx.moveTo(px-2, wallY); ctx.lineTo(px+pw/2, py-4); ctx.lineTo(px+pw+2, wallY); ctx.fill();
        }
    });

  }, [cityData]);

  // --- 3. 强制全屏适配 (Fix: Fit to Container) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0 || pH === 0) return;

      const mapW = MAP_COLS * TILE_SIZE;
      const mapH = MAP_ROWS * TILE_SIZE;

      // 核心修复：同时考虑宽和高，确保地图完全放入屏幕 (Contain)
      // 乘以 0.95 留一点边距，避免贴边
      const scale = Math.min(pW / mapW, pH / mapH) * 0.95;
      
      // 核心修复：基于 transform-origin: 0 0 的居中算法
      const x = (pW - mapW * scale) / 2;
      const y = (pH - mapH * scale) / 2;
      
      setViewState({ scale, x, y });
    };
    
    // 监听窗口变化 + 初始化执行
    window.addEventListener('resize', handleResize);
    // 延时一点点确保 layout ready
    const timer = setTimeout(handleResize, 50); 
    
    return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#cfd8dc] relative overflow-hidden select-none">
      
      {/* 地图容器：原点设为左上角 (0 0)，配合计算好的 x,y 实现完美居中 */}
      <div 
        className="absolute transition-transform duration-300 ease-out will-change-transform"
        style={{
          width: MAP_COLS * TILE_SIZE,
          height: MAP_ROWS * TILE_SIZE,
          transformOrigin: '0 0', // 关键！
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-xl rounded" />

        {/* 角色 */}
        {agents.map((agent: any) => {
            // 简单的坐标映射
            const tx = (agent.x / 100) * MAP_COLS;
            const ty = (agent.y / 100) * MAP_ROWS;
            return (
                <div key={agent.id} className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: tx*TILE_SIZE, top: ty*TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        <div className="absolute top-[-8px] bg-white/90 px-1 rounded-[2px] text-[6px] shadow-sm whitespace-nowrap">{agent.name}</div>
                        <div className={`w-3 h-3 rounded-full border border-white shadow-sm flex items-center justify-center ${agent.job.includes('建筑')?'bg-orange-500':'bg-blue-500'}`}></div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}