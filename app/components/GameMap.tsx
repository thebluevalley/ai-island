'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 大都会硬参数 ---
const TILE_SIZE = 32;
const MAP_WIDTH = 120; // 更宽，容纳更多街区
const MAP_HEIGHT = 100; // 更高

// 地块 ID
const TILES = {
  GRASS: 0,
  ROAD: 1,
  PAVEMENT: 2, // 商业区硬化地面
  WATER: 3,
  PARK_GRASS: 4,
};

// 建筑类型枚举
const BLDG = {
  RES_SMALL: 'res_s',   // 联排小别墅
  RES_LARGE: 'res_l',   // 独立大屋
  COMM_SHOP: 'shop',    // 商店
  COMM_OFFICE: 'office',// 办公楼
  CIVIC_HALL: 'hall',   // 市政厅
  CIVIC_LIB: 'lib',     // 图书馆
  FACTORY: 'factory',   // 工厂/仓库
};

// --- 2. 莫兰迪/RPG 高级配色 ---
const COLORS = {
  // 地面
  BG:        '#e0eadd', // 整体背景淡灰绿
  GRASS:     '#c5e1a5', // 公园亮绿
  ROAD:      '#eceff1', // 道路灰白
  ROAD_LINE: '#cfd8dc', // 道路标线
  PAVEMENT:  '#fff3e0', // 商业区暖色地砖
  WATER:     '#81d4fa', // 湖水

  // 建筑墙体 (区分功能)
  WALL_RES:  '#fff8e1', // 住宅：米黄
  WALL_COMM: '#f5f5f5', // 商业：冷白
  WALL_CIVIC:'#eceff1', // 市政：石材灰
  
  // 屋顶 (丰富色彩)
  ROOF_RED:  '#ffab91', // 陶土红
  ROOF_BLUE: '#90caf9', // 天空蓝
  ROOF_TEAL: '#80cbc4', // 青石色
  ROOF_GREY: '#b0bec5', // 深灰
  ROOF_GOLD: '#ffe082', // 金色/橙色

  // 细节
  SHADOW:    'rgba(0,0,0,0.1)',
  TREE:      '#66bb6a', // 树冠
  TRUNK:     '#8d6e63', // 树干
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 0.4, x: 0, y: 0 }); // 初始比例调小，确保看全

  const { agents } = worldData || { agents: [] };

  // --- 1. 强力城市生成器 (Dense City Algo) ---
  const cityData = useMemo(() => {
    const grid = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(TILES.GRASS);
    const buildings: any[] = [];
    const props: any[] = []; // 树、路灯等

    // 辅助：填充地块
    const fill = (x: number, y: number, w: number, h: number, t: number) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) 
            if(ix>=0 && ix<MAP_WIDTH && iy>=0 && iy<MAP_HEIGHT) grid[iy*MAP_WIDTH+ix] = t;
    };

    // 辅助：放置建筑 (存入列表)
    const addBuilding = (x: number, y: number, w: number, h: number, type: string) => {
        buildings.push({ x, y, w, h, type });
    };

    // === 第一步：路网规划 (Grid System) ===
    // 我们将地图划分为 5x4 个大区域 (Superblocks)
    const blockW = 20;
    const blockH = 20;
    const roadW = 2;

    // 绘制主干道
    for(let x=0; x<MAP_WIDTH; x+=blockW) fill(x, 0, roadW, MAP_HEIGHT, TILES.ROAD);
    for(let y=0; y<MAP_HEIGHT; y+=blockH) fill(0, y, MAP_WIDTH, roadW, TILES.ROAD);

    // === 第二步：区域填充 (Zoning) ===
    for(let by=0; by<MAP_HEIGHT; by+=blockH) {
        for(let bx=0; bx<MAP_WIDTH; bx+=blockW) {
            // 计算当前街区的中心坐标
            const cx = bx + blockW/2;
            const cy = by + blockH/2;
            
            // 排除地图边缘，防止溢出
            if (bx + blockW > MAP_WIDTH || by + blockH > MAP_HEIGHT) continue;

            // 街区内部可用区域
            const innerX = bx + roadW;
            const innerY = by + roadW;
            const innerW = blockW - roadW;
            const innerH = blockH - roadW;

            // 决定区域类型 (根据距离中心的距离)
            const distToMapCenter = Math.sqrt(Math.pow(cx - MAP_WIDTH/2, 2) + Math.pow(cy - MAP_HEIGHT/2, 2));
            
            // A. 市中心 (Civic Center) - 半径 20 以内
            if (distToMapCenter < 25) {
                fill(innerX, innerY, innerW, innerH, TILES.PAVEMENT); // 铺地砖
                // 建一个大建筑
                if ((bx+by)%3 === 0) {
                    addBuilding(innerX+2, innerY+2, innerW-4, innerH-4, BLDG.CIVIC_HALL); // 市政厅
                } else {
                    addBuilding(innerX+2, innerY+2, innerW-4, innerH-4, BLDG.COMM_OFFICE); // 写字楼
                }
            } 
            // B. 商业区 (Commercial) - 半径 25-45
            else if (distToMapCenter < 50) {
                fill(innerX, innerY, innerW, innerH, TILES.PAVEMENT);
                // 密集商店：上下两排
                const shopW = 5, shopH = 4;
                for(let i=1; i<innerW-shopW; i+=shopW+1) {
                    addBuilding(innerX+i, innerY+1, shopW, shopH, BLDG.COMM_SHOP); // 上排
                    addBuilding(innerX+i, innerY+innerH-shopH-1, shopW, shopH, BLDG.COMM_SHOP); // 下排
                }
                // 中间是步行街，种树
                for(let i=2; i<innerW; i+=4) props.push({x: innerX+i, y: innerY+innerH/2, type: 'tree'});
            }
            // C. 公园 (Park) - 随机几个街区
            else if (Math.random() > 0.85) {
                fill(innerX, innerY, innerW, innerH, TILES.PARK_GRASS);
                // 挖个湖
                fill(innerX+4, innerY+4, innerW-8, innerH-8, TILES.WATER);
                // 种一圈树
                for(let i=0; i<innerW; i+=2) {
                    props.push({x:innerX+i, y:innerY, type:'tree'});
                    props.push({x:innerX+i, y:innerY+innerH-1, type:'tree'});
                }
            }
            // D. 住宅区 (Residential) - 其他所有地方
            else {
                // 铺设内部小路 (十字形)
                fill(innerX + innerW/2, innerY, 1, innerH, TILES.ROAD);
                fill(innerX, innerY + innerH/2, innerW, 1, TILES.ROAD);

                // 分割成4个小地块，每个建一个房子
                const houseW = 6, houseH = 5;
                // 左上
                addBuilding(innerX+1, innerY+1, houseW, houseH, BLDG.RES_SMALL);
                // 右上
                addBuilding(innerX+innerW-houseW-1, innerY+1, houseW, houseH, BLDG.RES_LARGE);
                // 左下
                addBuilding(innerX+1, innerY+innerH-houseH-1, houseW, houseH, BLDG.RES_LARGE);
                // 右下
                addBuilding(innerX+innerW-houseW-1, innerY+innerH-houseH-1, houseW, houseH, BLDG.RES_SMALL);
                
                // 院子里种树
                props.push({x: innerX+1, y: innerY+innerH-2, type: 'tree'});
                props.push({x: innerX+innerW-2, y: innerY+1, type: 'tree'});
            }
        }
    }

    // 全局行道树
    for(let y=0; y<MAP_HEIGHT; y+=blockH) {
        for(let x=2; x<MAP_WIDTH; x+=4) {
            if(x%blockW !== 0) props.push({x: x, y: y+roadW, type: 'tree'});
        }
    }

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 (Drawing) ---
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

    // 背景
    ctx.fillStyle = COLORS.BG; ctx.fillRect(0, 0, width, height);

    const { grid, buildings, props } = cityData;

    // Layer 1: 地形 (Tilemap)
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = grid[y * MAP_WIDTH + x];
        const px = x*TILE_SIZE, py = y*TILE_SIZE;
        
        if (t === TILES.ROAD) {
            ctx.fillStyle = COLORS.ROAD; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 虚线
            if ((x+y)%2===0) { ctx.fillStyle = COLORS.ROAD_LINE; ctx.fillRect(px+14, py+14, 4, 4); }
        } else if (t === TILES.PAVEMENT) {
            ctx.fillStyle = COLORS.PAVEMENT; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#ffe0b2'; ctx.strokeRect(px,py,TILE_SIZE,TILE_SIZE);
        } else if (t === TILES.WATER) {
            ctx.fillStyle = COLORS.WATER; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (t === TILES.PARK_GRASS) {
            ctx.fillStyle = COLORS.GRASS; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Layer 2: 装饰 (Props)
    props.forEach(p => {
        const px = p.x*TILE_SIZE + TILE_SIZE/2;
        const py = p.y*TILE_SIZE + TILE_SIZE/2;
        if (p.type === 'tree') {
            // 阴影
            ctx.fillStyle = COLORS.SHADOW; ctx.beginPath(); ctx.ellipse(px+4, py+8, 8, 4, 0, 0, Math.PI*2); ctx.fill();
            // 树干
            ctx.fillStyle = COLORS.TRUNK; ctx.fillRect(px-2, py, 4, 8);
            // 树冠
            ctx.fillStyle = COLORS.TREE; ctx.beginPath(); ctx.arc(px, py-6, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#81c784'; ctx.beginPath(); ctx.arc(px-3, py-9, 4, 0, Math.PI*2); ctx.fill(); // 高光
        }
    });

    // Layer 3: 建筑 (Buildings) - 2.5D Draw
    buildings.forEach(b => {
        const px = b.x*TILE_SIZE;
        const py = b.y*TILE_SIZE;
        const pw = b.w*TILE_SIZE;
        const ph = b.h*TILE_SIZE;

        // 阴影
        ctx.fillStyle = COLORS.SHADOW; ctx.fillRect(px+6, py+6, pw, ph);

        // 墙体颜色选择
        let wallColor = COLORS.WALL_RES;
        if (b.type.includes('comm')) wallColor = COLORS.WALL_COMM;
        if (b.type.includes('civic')) wallColor = COLORS.WALL_CIVIC;

        // 墙体 (Main Body)
        ctx.fillStyle = wallColor;
        ctx.fillRect(px, py, pw, ph);
        // 墙底边缘
        ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(px, py+ph-4, pw, 4);

        // 门窗
        const doorW=12, doorH=16;
        ctx.fillStyle = '#5d4037'; // 门
        ctx.fillRect(px + pw/2 - doorW/2, py + ph - doorH, doorW, doorH);
        
        ctx.fillStyle = '#90caf9'; // 窗
        if (pw > 40) {
            ctx.fillRect(px + 8, py + 16, 10, 12);
            ctx.fillRect(px + pw - 18, py + 16, 10, 12);
        }

        // 屋顶 (Roof) - 简单的梯形或矩形
        let roofColor = COLORS.ROOF_RED;
        if (b.type === BLDG.RES_LARGE) roofColor = COLORS.ROOF_BLUE;
        if (b.type === BLDG.COMM_SHOP) roofColor = COLORS.ROOF_TEAL;
        if (b.type.includes('civic')) roofColor = COLORS.ROOF_GREY;

        ctx.fillStyle = roofColor;
        
        if (b.type.includes('civic') || b.type.includes('comm')) {
            // 平顶/复杂顶
            ctx.fillRect(px-2, py-2, pw+4, ph*0.6); // 大平顶
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; // 顶面高光
            ctx.fillRect(px+2, py+2, pw-4, ph*0.6-4);
        } else {
            // 尖顶 (Triangle/Trapezoid)
            ctx.beginPath();
            const roofH = 16;
            ctx.moveTo(px - 4, py);
            ctx.lineTo(px + pw/2, py - roofH);
            ctx.lineTo(px + pw + 4, py);
            ctx.fill();
        }
    });

  }, [cityData]);

  // --- 3. 强制全景 (Force Full View) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapW = MAP_WIDTH * TILE_SIZE;
      
      // 这里的逻辑：无论屏幕多大，都要看到至少 80% 的地图宽度
      // 这是一个非常“远”的视角
      const scale = pW / (mapW * 0.9); 
      
      setViewState({ 
          scale: scale, 
          x: (pW - mapW * scale) / 2, 
          y: (pH - MAP_HEIGHT * TILE_SIZE * scale) / 2 
      });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#cfd8dc] relative overflow-hidden select-none">
      <div className="absolute origin-center transition-transform duration-300 ease-out"
        style={{ width: MAP_WIDTH*TILE_SIZE, height: MAP_HEIGHT*TILE_SIZE, transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})` }}>
        
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-xl" />

        {/* 角色层 */}
        {agents.map((agent: any) => {
            const tx = (agent.x/100)*MAP_WIDTH, ty = (agent.y/100)*MAP_HEIGHT;
            return (
                <div key={agent.id} className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: tx*TILE_SIZE, top: ty*TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        {/* 缩小名字标签，避免在全景模式下太乱 */}
                        <div className="hidden md:block absolute top-[-8px] bg-white/90 px-1 rounded-[2px] text-[6px] text-black border border-black/10 whitespace-nowrap">
                            {agent.name}
                        </div>
                        <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full border border-white shadow-sm flex items-center justify-center ${agent.job.includes('建筑')?'bg-orange-500':agent.job.includes('领袖')?'bg-blue-600':'bg-emerald-500'}`}>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}