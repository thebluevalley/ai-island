'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Map, Clock } from 'lucide-react';

// --- 1. 配置 ---
const TILE_SIZE = 32;
const MAP_WIDTH = 100; 
const MAP_HEIGHT = 80;

// 地块类型
const TILES = {
  GRASS: 0,    // 郊区草地
  ROAD: 1,     // 柏油路
  COBBLE: 2,   // 市中心鹅卵石
  PLAZA: 3,    // 广场铺装
  WATER: 4,    // 水系
};

// 建筑类型 (区分度加大)
const BLDG = {
  RES_S: 'res_s', // 小户型
  RES_M: 'res_m', // 中户型带院子
  COMM:  'comm',  // 商业楼
  CIVIC: 'civic', // 市政地标 (大)
};

// --- 2. 配色 (淡雅 + 对比) ---
const COLORS = {
  // 环境
  GRASS_BG: '#e8f5e9', GRASS_FG: '#c8e6c9',
  ROAD:     '#eceff1', ROAD_EDGE:'#cfd8dc',
  COBBLE:   '#e0e0e0', // 市中心地面更冷硬
  PLAZA:    '#fff8e1', // 广场暖色
  WATER:    '#b3e5fc',

  // 建筑材质
  WALL_RES: '#fffdfb',  // 暖白民居墙
  WALL_CIVIC:'#f5f5f5', // 冷灰石材墙
  WALL_COMM:'#fafafa',  // 现代商业墙
  
  // 屋顶区分
  ROOF_RES_A:'#ffccbc', // 陶土色
  ROOF_RES_B:'#cfd8dc', // 蓝灰色
  ROOF_COMM: '#b2dfdb', // 薄荷绿平顶
  ROOF_CIVIC:'#b0bec5', // 庄重石材顶/圆顶

  // 细节
  DOOR_WOOD:'#8d6e63', DOOR_MTL:'#546e7a',
  WINDOW:   '#bbdefb',
  FENCE:    '#d7ccc8', // 木栅栏
};

// --- 噪声函数 (用于生成有机区域) ---
const hash = (x: number, y: number) => { let s=Math.sin(x*12.9898+y*78.233)*43758.5453; return s-Math.floor(s); };
const lerp = (a: number, b: number, t: number) => a+t*(b-a);
const smoothNoise = (x: number, y: number) => {
    const ix=Math.floor(x), iy=Math.floor(y); const fx=x-ix, fy=y-iy;
    const ux=fx*fx*(3.0-2.0*fx), uy=fy*fy*(3.0-2.0*fy);
    const a=hash(ix,iy), b=hash(ix+1,iy), c=hash(ix,iy+1), d=hash(ix+1,iy+1);
    return lerp(lerp(a,b,ux), lerp(c,d,ux), uy);
};
const fbm = (x: number, y: number) => smoothNoise(x,y)*0.5 + smoothNoise(x*2,y*2)*0.25;

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 有机城市生成器 (Organic City Gen) ---
  const cityData = useMemo(() => {
    const grid = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(TILES.GRASS);
    const buildings: any[] = [];
    const props: any[] = [];
    
    const centerX = MAP_WIDTH / 2;
    const centerY = MAP_HEIGHT / 2;

    // 工具函数
    const fillRect = (x: number, y: number, w: number, h: number, type: number) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) 
            if (ix>=0 && ix<MAP_WIDTH && iy>=0 && iy<MAP_HEIGHT) grid[iy*MAP_WIDTH+ix] = type;
    };
    const placeBldg = (x: number, y: number, w: number, h: number, type: string) => {
        buildings.push({ x, y, w, h, type });
    };

    // --- 规划阶段 ---
    
    // 1. 生成有机区域 (Zoning with Noise)
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            // 距离中心的距离 + 噪声扭曲
            const dist = Math.sqrt((x-centerX)**2 + (y-centerY)**2);
            const noise = fbm(x * 0.05, y * 0.05) * 20; // 扭曲强度
            const organicDist = dist + noise;

            if (organicDist < 25) {
                grid[y*MAP_WIDTH+x] = TILES.COBBLE; // 核心区：鹅卵石
            } else if (organicDist < 45) {
                grid[y*MAP_WIDTH+x] = TILES.ROAD; // 商业环区：普通路面
            } else {
                grid[y*MAP_WIDTH+x] = TILES.GRASS; // 外围：草地
            }
        }
    }

    // 2. 放置地标建筑 (Civic Core)
    // 市政厅 (中心大建筑)
    const hallW = 16, hallH = 12;
    fillRect(centerX-hallW/2-2, centerY-hallH/2-2, hallW+4, hallH+4, TILES.PLAZA); // 广场基底
    placeBldg(centerX-hallW/2, centerY-hallH/2, hallW, hallH, BLDG.CIVIC);
    
    // 图书馆/博物馆 (旁边两个中型)
    placeBldg(centerX-20, centerY-5, 10, 8, BLDG.CIVIC);
    placeBldg(centerX+12, centerY-5, 10, 8, BLDG.CIVIC);

    // 3. 填充商业与住宅 (基于区域类型)
    const blockS = 10; // 街区采样步长
    for (let y = 4; y < MAP_HEIGHT-blockS; y+=blockS) {
        for (let x = 4; x < MAP_WIDTH-blockS; x+=blockS) {
            const tileType = grid[(y+blockS/2)*MAP_WIDTH + (x+blockS/2)];
            const seed = Math.random();

            if (tileType === TILES.COBBLE) {
                // 核心区边缘：高密度商业
                 if (seed > 0.3) placeBldg(x+1, y+1, blockS-2, blockS-3, BLDG.COMM);
            } 
            else if (tileType === TILES.ROAD) {
                // 商业环区：商业+密集住宅
                if (seed > 0.5) placeBldg(x+1, y+1, 7, 6, BLDG.COMM);
                else placeBldg(x+2, y+2, 5, 5, BLDG.RES_M);
            }
            else if (tileType === TILES.GRASS) {
                // 外围住宅区：带院子的小房子，分布更稀疏
                if (seed > 0.4 && seed < 0.8) {
                    placeBldg(x+2, y+2, 5, 4, BLDG.RES_M);
                    // 种树
                    props.push({x: x+1, y: y+1, type:'tree'});
                    props.push({x: x+blockS-2, y: y+blockS-2, type:'tree'});
                }
            }
        }
    }

    // 4. 随机添加路灯和树木装饰
    for(let i=0; i<100; i++) {
        const rx = Math.floor(Math.random()*MAP_WIDTH);
        const ry = Math.floor(Math.random()*MAP_HEIGHT);
        if(grid[ry*MAP_WIDTH+rx] === TILES.ROAD || grid[ry*MAP_WIDTH+rx] === TILES.COBBLE) {
             if(Math.random()>0.8) props.push({x:rx, y:ry, type:'lamp'});
        }
    }

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 (增强建筑区分度) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = MAP_WIDTH * TILE_SIZE;
    const height = MAP_HEIGHT * TILE_SIZE;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 1. 地面渲染
    ctx.fillStyle = COLORS.GRASS_BG; ctx.fillRect(0, 0, width, height);
    const { grid, buildings, props } = cityData;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const type = grid[y * MAP_WIDTH + x];
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        if (type === TILES.ROAD) {
            ctx.fillStyle = COLORS.ROAD; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (type === TILES.COBBLE) {
            ctx.fillStyle = COLORS.COBBLE; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 鹅卵石纹理
            ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(px,py,TILE_SIZE,1); ctx.fillRect(px,py,1,TILE_SIZE);
        } else if (type === TILES.PLAZA) {
            ctx.fillStyle = COLORS.PLAZA; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 2. 装饰物渲染
    props.forEach(p => {
        const px = p.x*TILE_SIZE, py = p.y*TILE_SIZE, cx = px+TILE_SIZE/2, cy = py+TILE_SIZE/2;
        if (p.type === 'tree') {
            ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.ellipse(cx, cy+6, 6, 3, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#8d6e63'; ctx.fillRect(cx-2, cy-2, 4, 8);
            ctx.fillStyle = COLORS.TREE; ctx.beginPath(); ctx.arc(cx, cy-8, 10, 0, Math.PI*2); ctx.fill();
        } else if (p.type === 'lamp') {
            ctx.fillStyle = '#546e7a'; ctx.fillRect(cx-1, cy-4, 2, 8);
            ctx.fillStyle = '#ffecb3'; ctx.beginPath(); ctx.arc(cx, cy-6, 3, 0, Math.PI*2); ctx.fill();
        }
    });

    // 3. 建筑渲染 (核心升级：区分度)
    buildings.forEach(b => {
        const px = b.x*TILE_SIZE, py = b.y*TILE_SIZE, pw = b.w*TILE_SIZE, ph = b.h*TILE_SIZE;
        
        // --- A. 住宅 (带院子的小房子) ---
        if (b.type.startsWith('res')) {
            // 院子栅栏
            if (b.type === BLDG.RES_M) {
                ctx.strokeStyle = COLORS.FENCE; ctx.lineWidth = 2;
                ctx.strokeRect(px-2, py-2, pw+4, ph+4);
            }
            
            const wallH = ph * 0.5; const wallY = py + ph - wallH;
            // 墙体
            ctx.fillStyle = COLORS.WALL_RES; ctx.fillRect(px, wallY, pw, wallH);
            // 门窗
            ctx.fillStyle = COLORS.DOOR_WOOD; ctx.fillRect(px+pw/2-6, py+ph-14, 12, 14);
            ctx.fillStyle = COLORS.WINDOW; ctx.fillRect(px+6, wallY+6, 8, 8); ctx.fillRect(px+pw-14, wallY+6, 8, 8);
            
            // 尖顶屋顶
            ctx.fillStyle = b.type===BLDG.RES_M ? COLORS.ROOF_RES_A : COLORS.ROOF_RES_B;
            ctx.beginPath(); ctx.moveTo(px-4, wallY); ctx.lineTo(px+pw/2, py-8); ctx.lineTo(px+pw+4, wallY); ctx.fill();
        }
        
        // --- B. 商业 (平顶现代风格) ---
        else if (b.type === BLDG.COMM) {
            const wallH = ph * 0.6; const wallY = py + ph - wallH;
            ctx.fillStyle = COLORS.WALL_COMM; ctx.fillRect(px, wallY, pw, wallH);
            // 大橱窗
            ctx.fillStyle = COLORS.WINDOW; ctx.fillRect(px+4, wallY+4, pw-8, wallH-12);
            ctx.fillStyle = COLORS.DOOR_MTL; ctx.fillRect(px+pw/2-8, py+ph-16, 16, 16);
            // 平屋顶 + 女儿墙
            ctx.fillStyle = COLORS.ROOF_COMM; ctx.fillRect(px-2, wallY-4, pw+4, 8);
        }

        // --- C. 市政地标 (宏伟石材风格) ---
        else if (b.type === BLDG.CIVIC) {
            // 基座台阶
            ctx.fillStyle = '#bdbdbd'; ctx.fillRect(px-4, py+ph-4, pw+8, 6);
            
            const wallH = ph * 0.65; const wallY = py + ph - wallH - 4;
            ctx.fillStyle = COLORS.WALL_CIVIC; ctx.fillRect(px, wallY, pw, wallH);
            
            // 石柱门廊
            const colW = 6;
            ctx.fillStyle = '#eceff1';
            ctx.fillRect(px+8, wallY, colW, wallH); ctx.fillRect(px+pw-8-colW, wallY, colW, wallH);
            // 大门
            ctx.fillStyle = COLORS.DOOR_MTL; ctx.fillRect(px+pw/2-10, py+ph-20, 20, 20);

            // 宏伟屋顶 (带圆顶/三角楣)
            ctx.fillStyle = COLORS.ROOF_CIVIC;
            // 主体梯形顶
            ctx.beginPath(); ctx.moveTo(px-4, wallY); ctx.lineTo(px+4, py); ctx.lineTo(px+pw-4, py); ctx.lineTo(px+pw+4, wallY); ctx.fill();
            // 中央圆顶
            if (pw > 12*TILE_SIZE) {
                 ctx.beginPath(); ctx.arc(px+pw/2, py, pw*0.2, Math.PI, 0); ctx.fill();
            }
        }
    });

  }, [cityData]);

  // --- 3. Viewport Focus ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth, pH = containerRef.current.clientHeight;
      if (pW === 0) return;
      // 聚焦中心区域
      const targetCols = 50; 
      const scale = pW / (targetCols * TILE_SIZE);
      setViewState({ scale, x: (pW - MAP_WIDTH*TILE_SIZE*scale)/2, y: (pH - MAP_HEIGHT*TILE_SIZE*scale)/2 });
    };
    window.addEventListener('resize', handleResize); setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#fafafa] relative overflow-hidden select-none">
      <div className="absolute origin-center transition-transform duration-300 ease-out"
        style={{ width: MAP_WIDTH*TILE_SIZE, height: MAP_HEIGHT*TILE_SIZE, transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})` }}>
        
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-sm" />

        {agents.map((agent: any) => {
            const tx = (agent.x/100)*MAP_WIDTH, ty = (agent.y/100)*MAP_HEIGHT;
            return (
                <div key={agent.id} className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: tx*TILE_SIZE, top: ty*TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        {agent.actionLog && agent.actionLog.includes('“') && (
                            <div className="absolute bottom-full mb-1 bg-white border border-stone-200 px-1.5 py-0.5 rounded-md text-[8px] font-bold shadow-sm whitespace-nowrap z-50">💬</div>
                        )}
                        <div className={`w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${agent.job.includes('建筑')?'bg-orange-400':agent.job.includes('领袖')?'bg-blue-500':'bg-emerald-500'}`}>
                            <span className="text-[8px] text-white font-bold">{agent.name[0]}</span>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}