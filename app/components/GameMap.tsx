'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Map, Clock } from 'lucide-react';

// --- 1. 配置 (100x80 大地图) ---
const TILE_SIZE = 32;
const MAP_WIDTH = 100; 
const MAP_HEIGHT = 80;

// 地块类型
const TILES = {
  GRASS: 0,    // 郊区草地
  ROAD: 1,     // 柏油路
  COBBLE: 2,   // 市中心鹅卵石/商业区地面
  PLAZA: 3,    // 核心广场铺装
  WATER: 4,    // 公园湖泊
};

// 建筑类型 (高辨识度)
const BLDG = {
  RES_S: 'res_s', // 联排小民居
  RES_M: 'res_m', // 独立中型民居
  COMM:  'comm',  // 商业店铺
  CIVIC: 'civic', // 市政地标 (超大)
};

// --- 2. 配色 (保持淡雅风格，增加对比) ---
const COLORS = {
  // 环境
  GRASS_BG: '#e8f5e9', GRASS_FG: '#c8e6c9',
  ROAD:     '#eceff1', ROAD_EDGE:'#cfd8dc',
  COBBLE:   '#e0e0e0',
  PLAZA:    '#fff3e0', // 广场暖黄
  WATER:    '#b3e5fc',
  TREE:     '#a5d6a7', 

  // 建筑材质
  WALL_RES: '#fffdfb',  // 暖白民居墙
  WALL_CIVIC:'#f0f4f8', // 冷灰庄重墙
  WALL_COMM:'#fafafa',  // 现代商业墙
  
  // 屋顶 (多样化)
  ROOF_RES_A:'#ffccbc', // 陶土红
  ROOF_RES_B:'#b0bec5', // 石板灰
  ROOF_COMM: '#80cbc4', // 商业青
  ROOF_CIVIC:'#90a4ae', // 市政深灰

  // 细节
  DOOR_WOOD:'#8d6e63', DOOR_MTL:'#546e7a',
  WINDOW:   '#bbdefb',
  FENCE:    '#d7ccc8',
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 初始缩放调整为能看到大部分城市全景
  const [viewState, setViewState] = useState({ scale: 0.6, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 高密度城市生成器 (High-Density City Gen) ---
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
    
    // 1. 生成主干路网 (Major Grid)
    const blockW = 18; // 街区宽度
    const blockH = 14; // 街区高度
    const roadW = 2;   // 道路宽度

    for (let x = 2; x < MAP_WIDTH; x += blockW) fillRect(x, 0, roadW, MAP_HEIGHT, TILES.ROAD);
    for (let y = 2; y < MAP_HEIGHT; y += blockH) fillRect(0, y, MAP_WIDTH, roadW, TILES.ROAD);

    // 2. 填充街区 (Block Filling Strategy)
    for (let gy = 2; gy < MAP_HEIGHT - blockH; gy += blockH) {
        for (let gx = 2; gx < MAP_WIDTH - blockW; gx += blockW) {
            // 街区内部范围
            const bx = gx + roadW, by = gy + roadW;
            const bw = blockW - roadW, bh = blockH - roadW;
            const dist = Math.sqrt((gx-centerX)**2 + (gy-centerY)**2);
            const seed = Math.sin(gx*gy); // 随机种子

            // A. 核心区：广场与地标
            if (dist < 20) {
                fillRect(bx, by, bw, bh, TILES.PLAZA);
                if ((gx+gy)%4 === 0) {
                    // 大型市政建筑 (占据整个街区)
                    placeBldg(bx+1, by+1, bw-2, bh-2, BLDG.CIVIC);
                } else {
                    // 广场喷泉/纪念碑空地 (不做建筑)
                    if(seed > 0.5) props.push({x: bx+bw/2, y:by+bh/2, type:'fountain'});
                }
            }
            // B. 商业环区：高密度店铺
            else if (dist < 40) {
                fillRect(bx, by, bw, bh, TILES.COBBLE); // 商业地面硬化
                // 填充两排紧凑的商店
                const shopW = 5, shopH = 4;
                // Row 1
                for(let i=0; i<bw-shopW; i+=shopW+1) placeBldg(bx+i, by+1, shopW, shopH, BLDG.COMM);
                // Row 2
                for(let i=0; i<bw-shopW; i+=shopW+1) placeBldg(bx+i, by+bh-shopH-1, shopW, shopH, BLDG.COMM);
            }
            // C. 外围区：住宅与公园
            else {
                // 随机生成大公园/森林
                if (seed > 0.85) {
                    // 森林公园
                    for(let i=0; i<20; i++) props.push({x: bx+Math.random()*bw, y: by+Math.random()*bh, type:'tree'});
                    if(seed > 0.92) fillRect(bx+2, by+2, bw-4, bh-4, TILES.WATER); // 湖泊
                } else {
                    // 高密度住宅区 (联排)
                    // 中间加一条小巷
                    fillRect(bx, by + bh/2, bw, 1, TILES.ROAD); 
                    
                    const houseW = 4, houseH = 4;
                    // Row 1 (Top)
                    for(let i=0; i<bw-houseW; i+=houseW+1) {
                        placeBldg(bx+i, by+1, houseW, houseH, Math.random()>0.3?BLDG.RES_S:BLDG.RES_M);
                        props.push({x:bx+i, y:by+houseH+1, type:'tree'}); // 房前树
                    }
                    // Row 2 (Bottom)
                    for(let i=0; i<bw-houseW; i+=houseW+1) {
                        placeBldg(bx+i, by+bh-houseH-1, houseW, houseH, Math.random()>0.3?BLDG.RES_S:BLDG.RES_M);
                    }
                }
            }
        }
    }

    // 3. 全局路灯装饰
    for(let y=0; y<MAP_HEIGHT; y+=blockH/2) {
        for(let x=0; x<MAP_WIDTH; x+=blockW/2) {
            if(grid[y*MAP_WIDTH+x] === TILES.ROAD) props.push({x,y,type:'lamp'});
        }
    }

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 (保持不变，复用之前的2.5D逻辑) ---
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
            ctx.fillStyle = 'rgba(0,0,0,0.03)'; ctx.fillRect(px,py,TILE_SIZE,1); ctx.fillRect(px,py,1,TILE_SIZE);
        } else if (type === TILES.PLAZA) {
            ctx.fillStyle = COLORS.PLAZA; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (type === TILES.WATER) {
            ctx.fillStyle = COLORS.WATER; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
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
        } else if (p.type === 'fountain') {
             ctx.fillStyle = COLORS.WATER; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
        }
    });

    // 3. 建筑渲染
    buildings.forEach(b => {
        const px = b.x*TILE_SIZE, py = b.y*TILE_SIZE, pw = b.w*TILE_SIZE, ph = b.h*TILE_SIZE;
        
        // A. 住宅
        if (b.type.startsWith('res')) {
            if (b.type === BLDG.RES_M) {
                ctx.strokeStyle = COLORS.FENCE; ctx.lineWidth = 2; ctx.strokeRect(px-2, py-2, pw+4, ph+4);
            }
            const wallH = ph * 0.55; const wallY = py + ph - wallH;
            ctx.fillStyle = COLORS.WALL_RES; ctx.fillRect(px, wallY, pw, wallH);
            ctx.fillStyle = COLORS.DOOR_WOOD; ctx.fillRect(px+pw/2-6, py+ph-14, 12, 14);
            ctx.fillStyle = COLORS.WINDOW; ctx.fillRect(px+4, wallY+6, 6, 8); ctx.fillRect(px+pw-10, wallY+6, 6, 8);
            
            ctx.fillStyle = (b.x%3===0) ? COLORS.ROOF_RES_A : COLORS.ROOF_RES_B;
            ctx.beginPath(); ctx.moveTo(px-2, wallY); ctx.lineTo(px+pw/2, py-6); ctx.lineTo(px+pw+2, wallY); ctx.fill();
        }
        // B. 商业
        else if (b.type === BLDG.COMM) {
            const wallH = ph * 0.65; const wallY = py + ph - wallH;
            ctx.fillStyle = COLORS.WALL_COMM; ctx.fillRect(px, wallY, pw, wallH);
            ctx.fillStyle = COLORS.WINDOW; ctx.fillRect(px+2, wallY+4, pw-4, wallH-14);
            ctx.fillStyle = COLORS.DOOR_MTL; ctx.fillRect(px+pw/2-6, py+ph-14, 12, 14);
            ctx.fillStyle = COLORS.ROOF_COMM; ctx.fillRect(px-1, wallY-3, pw+2, 6);
        }
        // C. 市政
        else if (b.type === BLDG.CIVIC) {
            ctx.fillStyle = '#bdbdbd'; ctx.fillRect(px-2, py+ph-4, pw+4, 6);
            const wallH = ph * 0.7; const wallY = py + ph - wallH - 4;
            ctx.fillStyle = COLORS.WALL_CIVIC; ctx.fillRect(px, wallY, pw, wallH);
            const colW = 6; ctx.fillStyle = '#eceff1'; ctx.fillRect(px+6, wallY, colW, wallH); ctx.fillRect(px+pw-6-colW, wallY, colW, wallH);
            ctx.fillStyle = COLORS.DOOR_MTL; ctx.fillRect(px+pw/2-8, py+ph-20, 16, 20);
            ctx.fillStyle = COLORS.ROOF_CIVIC;
            ctx.beginPath(); ctx.moveTo(px-2, wallY); ctx.lineTo(px+4, py); ctx.lineTo(px+pw-4, py); ctx.lineTo(px+pw+2, wallY); ctx.fill();
            if (pw > 10*TILE_SIZE) { ctx.beginPath(); ctx.arc(px+pw/2, py+2, pw*0.15, Math.PI, 0); ctx.fill(); }
        }
    });

  }, [cityData]);

  // --- 3. Viewport Focus (调整为全景) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth, pH = containerRef.current.clientHeight;
      if (pW === 0) return;
      // 目标：看到 70% 的地图宽度，形成全景
      const targetCols = MAP_WIDTH * 0.7; 
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
                        <div className={`w-4 h-4 rounded-full border border-white shadow-sm flex items-center justify-center ${agent.job.includes('建筑')?'bg-orange-400':agent.job.includes('领袖')?'bg-blue-500':'bg-emerald-500'}`}>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}