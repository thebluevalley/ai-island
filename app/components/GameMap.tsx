'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 地图参数 ---
const TILE_SIZE = 32;
// 保持 4:3 比例，方便屏幕适配
const MAP_COLS = 64; 
const MAP_ROWS = 48; 

// 地块类型
const TILES = {
  GRASS: 0,
  ROAD: 1,
  PAVEMENT: 2,
  WATER: 3,
};

// 建筑类型
const BLDG = {
  HOME_A: 'home_a', // 红顶
  HOME_B: 'home_b', // 蓝顶
  SHOP:   'shop',   // 商店
  OFFICE: 'office', // 办公
  CIVIC:  'civic',  // 市政
};

// --- 2. 鲜明配色 (AI Town Style) ---
const COLORS = {
  BG:        '#b0bec5', // 画布底色
  GRASS:     '#76d275', // 鲜亮草地
  ROAD:      '#ffffff', // 纯白道路 (AI Town 特色)
  ROAD_SUB:  '#f5f5f5',
  PAVEMENT:  '#fff9c4', // 暖黄地面
  WATER:     '#4fc3f7', // 亮蓝

  // 建筑 (高对比度)
  WALL:      '#ffffff', 
  WALL_S:    '#cfd8dc', 
  
  // 屋顶
  ROOF_RED:  '#ff7043', 
  ROOF_BLUE: '#42a5f5', 
  ROOF_TEAL: '#26a69a', 
  ROOF_YELL: '#fbc02d', 
  ROOF_GRAY: '#78909c',

  SHADOW:    'rgba(0,0,0,0.15)',
  TREE:      '#2e7d32', 
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 初始 scale 设为 0，避免闪烁，等待计算
  const [viewState, setViewState] = useState({ scale: 0, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 强制高密度生成器 ---
  const cityData = useMemo(() => {
    const grid = new Uint8Array(MAP_COLS * MAP_ROWS).fill(TILES.GRASS);
    const buildings: any[] = [];
    const props: any[] = [];

    const fill = (x: number, y: number, w: number, h: number, t: number) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) 
            if(ix>=0 && ix<MAP_COLS && iy>=0 && iy<MAP_ROWS) grid[iy*MAP_COLS+ix] = t;
    };
    const addBldg = (x: number, y: number, w: number, h: number, type: string) => {
        buildings.push({ x, y, w, h, type });
        fill(x, y, w, h, TILES.PAVEMENT); // 建筑下铺地
    };

    // 1. 生成棋盘路网 (Block System)
    const blockW = 8; // 小而密的街区
    const blockH = 8;
    const roadW = 2; // 宽路

    for(let x=0; x<MAP_COLS; x+=blockW) fill(x, 0, roadW, MAP_ROWS, TILES.ROAD);
    for(let y=0; y<MAP_ROWS; y+=blockH) fill(0, y, MAP_COLS, roadW, TILES.ROAD);

    // 2. 强制填充每个格子 (100% Fill Rate)
    for(let by=0; by<MAP_ROWS; by+=blockH) {
        for(let bx=0; bx<MAP_COLS; bx+=blockW) {
            if(bx+blockW > MAP_COLS || by+blockH > MAP_ROWS) continue;

            const ix = bx + roadW;
            const iy = by + roadW;
            const iw = blockW - roadW;
            const ih = blockH - roadW;

            const cx = MAP_COLS/2, cy = MAP_ROWS/2;
            const dist = Math.sqrt((bx-cx)**2 + (by-cy)**2);

            // 中央公园
            if(dist < 8) {
                fill(ix, iy, iw, ih, TILES.WATER);
                continue;
            }

            // 市政区
            if(dist < 16) {
                fill(ix, iy, iw, ih, TILES.PAVEMENT);
                addBldg(ix, iy, iw, ih, BLDG.CIVIC);
                continue;
            }

            // 商业/住宅
            const seed = Math.sin(bx*by);
            if(seed > 0.5) {
                // 商业：填满
                addBldg(ix, iy, iw, ih-2, BLDG.SHOP);
            } else {
                // 住宅：建两栋
                addBldg(ix, iy, iw, 3, BLDG.HOME_A);
                addBldg(ix, iy+3, iw, 3, BLDG.HOME_B);
            }
            
            // 缝隙种树
            if(Math.random()>0.5) props.push({x: ix+iw/2, y: iy+ih-1, type:'tree'});
        }
    }

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = MAP_COLS * TILE_SIZE;
    const h = MAP_ROWS * TILE_SIZE;
    
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = COLORS.GRASS; ctx.fillRect(0, 0, w, h);
    const { grid, buildings, props } = cityData;

    // 地形
    for(let y=0; y<MAP_ROWS; y++) for(let x=0; x<MAP_COLS; x++) {
        const t = grid[y*MAP_COLS+x];
        const px = x*TILE_SIZE, py = y*TILE_SIZE;
        if(t===TILES.ROAD) { ctx.fillStyle = COLORS.ROAD; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
        else if(t===TILES.PAVEMENT) { ctx.fillStyle = COLORS.PAVEMENT; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
        else if(t===TILES.WATER) { ctx.fillStyle = COLORS.WATER; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
    }

    // 树
    props.forEach(p => {
        const px = p.x*TILE_SIZE+16, py = p.y*TILE_SIZE+16;
        ctx.fillStyle = COLORS.SHADOW; ctx.beginPath(); ctx.ellipse(px+4, py+8, 8, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8d6e63'; ctx.fillRect(px-2, py, 4, 8);
        ctx.fillStyle = COLORS.TREE; ctx.beginPath(); ctx.arc(px, py-8, 12, 0, Math.PI*2); ctx.fill();
    });

    // 建筑 (2.5D 盒子)
    buildings.forEach(b => {
        const px = b.x*TILE_SIZE, py = b.y*TILE_SIZE, pw = b.w*TILE_SIZE, ph = b.h*TILE_SIZE;
        
        // 阴影
        ctx.fillStyle = COLORS.SHADOW; ctx.fillRect(px+8, py+8, pw, ph);

        const wallH = ph * 0.6;
        const wallY = py + ph - wallH;

        // 墙
        ctx.fillStyle = COLORS.WALL; ctx.fillRect(px, wallY, pw, wallH);
        ctx.fillStyle = COLORS.WALL_S; ctx.fillRect(px, wallY+wallH-2, pw, 2);

        // 门窗
        ctx.fillStyle = '#5d4037'; ctx.fillRect(px+pw/2-6, wallY+wallH-12, 12, 12);
        ctx.fillStyle = '#90caf9'; 
        if(pw > 40) { ctx.fillRect(px+6, wallY+6, 10, 10); ctx.fillRect(px+pw-16, wallY+6, 10, 10); }

        // 屋顶
        let rc = COLORS.ROOF_RED;
        if(b.type===BLDG.HOME_B) rc = COLORS.ROOF_BLUE;
        if(b.type===BLDG.SHOP) rc = COLORS.ROOF_TEAL;
        if(b.type===BLDG.CIVIC) rc = COLORS.ROOF_YELL;
        if(b.type===BLDG.OFFICE) rc = COLORS.ROOF_GRAY;

        ctx.fillStyle = rc;
        if(b.type===BLDG.CIVIC || b.type===BLDG.SHOP) {
            ctx.fillRect(px-2, py, pw+4, wallY-py); // 平顶
        } else {
            ctx.beginPath(); ctx.moveTo(px-2, wallY); ctx.lineTo(px+pw/2, py-4); ctx.lineTo(px+pw+2, wallY); ctx.fill(); // 尖顶
        }
    });

  }, [cityData]);

  // --- 3. 终极适配逻辑 (ResizeObserver) ---
  useEffect(() => {
    if (!containerRef.current) return;

    const updateScale = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0 || pH === 0) return;

      const mapW = MAP_COLS * TILE_SIZE;
      const mapH = MAP_ROWS * TILE_SIZE;

      // 强制包含：取宽比和高比的最小值，确保任何一边都不溢出
      const scale = Math.min(pW / mapW, pH / mapH) * 0.95; // 0.95 留白
      
      // 绝对居中
      const x = (pW - mapW * scale) / 2;
      const y = (pH - mapH * scale) / 2;

      setViewState({ scale, x, y });
    };

    // 使用 ResizeObserver 监听容器大小变化 (比 window resize 更准)
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#cfd8dc] relative overflow-hidden select-none flex items-center justify-center">
      
      {/* 确保地图容器居中 */}
      <div 
        className="relative shadow-2xl origin-top-left transition-transform duration-300 ease-out"
        style={{
          width: MAP_COLS * TILE_SIZE,
          height: MAP_ROWS * TILE_SIZE,
          transformOrigin: '0 0', // 强制左上角为变换原点，配合 calculated x,y
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 z-0 rounded" />

        {/* Agents */}
        {agents.map((agent: any) => {
            const tx = (agent.x/100)*MAP_COLS, ty = (agent.y/100)*MAP_ROWS;
            return (
                <div key={agent.id} className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: tx*TILE_SIZE, top: ty*TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        <div className={`w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse`}>
                             <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${agent.job.includes('建筑')?'bg-orange-500':'bg-blue-500'}`}></div>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}