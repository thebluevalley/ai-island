'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, User, Coffee, BookOpen, Building2 } from 'lucide-react';

// --- 1. 大都会配置 ---
const TILE_SIZE = 32;
const MAP_WIDTH = 100; 
const MAP_HEIGHT = 80; // 稍微扁一点，符合宽屏构图

// 地块类型
const TILES = {
  GRASS: 0,
  ROAD: 1,
  PAVEMENT: 2, // 铺装路面(广场/商业区)
  WATER: 3,
  FLOWER: 4,
};

// 建筑类型
const BLDG = {
  HOME_S: 'home_s',
  HOME_M: 'home_m',
  SHOP: 'shop',
  OFFICE: 'office',
  CIVIC: 'civic', // 市政/公共建筑
};

// --- 2. 淡雅配色 (Morandi / Pastel Style) ---
const COLORS = {
  // 环境色
  GRASS_BG: '#e8f5e9',      // 极淡的抹茶绿
  GRASS_FG: '#c8e6c9',      // 稍深一点的草绿装饰
  ROAD:     '#f5f5f5',      // 暖灰白道路
  ROAD_EDGE:'#e0e0e0',      // 道路边缘
  PAVEMENT: '#fff8e1',      // 米色铺装地面 (商业区)
  WATER:    '#b3e5fc',      // 淡蓝湖水
  
  // 建筑配色 (低饱和度)
  WALL:     '#fffdfb',      // 暖白墙面
  WALL_S:   '#eceff1',      // 墙面阴影
  
  // 屋顶 (莫兰迪色系)
  ROOF_RES_A: '#ffccbc',    // 淡陶土色
  ROOF_RES_B: '#cfd8dc',    // 蓝灰色
  ROOF_COM:   '#b2dfdb',    // 薄荷蓝 (商店)
  ROOF_PUB:   '#ffe0b2',    // 淡杏色 (公共)
  ROOF_CIVIC: '#d7ccc8',    // 灰褐色 (市政)

  // 细节
  DOOR:     '#8d6e63',      // 木门
  WINDOW:   '#bbdefb',      // 窗户反光
  TREE:     '#a5d6a7',      // 树冠 (淡绿)
  TREE_TRUNK:'#d7ccc8',     // 树干
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 程序化城市生成器 (Metropolis Algorithm) ---
  const cityData = useMemo(() => {
    const grid = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(TILES.GRASS);
    const buildings: any[] = [];
    const props: any[] = [];

    // 工具：铺路
    const drawRoad = (x: number, y: number, w: number, h: number) => {
        for(let iy=y; iy<y+h; iy++) {
            for(let ix=x; ix<x+w; ix++) {
                if (ix>=0 && ix<MAP_WIDTH && iy>=0 && iy<MAP_HEIGHT) grid[iy * MAP_WIDTH + ix] = TILES.ROAD;
            }
        }
    };

    // 工具：铺地砖
    const drawPavement = (x: number, y: number, w: number, h: number) => {
        for(let iy=y; iy<y+h; iy++) {
            for(let ix=x; ix<x+w; ix++) {
                if (ix>=0 && ix<MAP_WIDTH && iy>=0 && iy<MAP_HEIGHT) grid[iy * MAP_WIDTH + ix] = TILES.PAVEMENT;
            }
        }
    };

    // 工具：造水池
    const drawPool = (x: number, y: number, w: number, h: number) => {
        for(let iy=y; iy<y+h; iy++) {
            for(let ix=x; ix<x+w; ix++) {
                grid[iy * MAP_WIDTH + ix] = TILES.WATER;
            }
        }
    };

    // 工具：放置建筑
    const placeBuilding = (x: number, y: number, w: number, h: number, type: string, label: string) => {
        buildings.push({ x, y, w, h, type, label });
    };

    // --- 规划布局 ---
    
    // 1. 主干道网格 (Main Arteries)
    const roadGapX = 20; // 街区宽度
    const roadGapY = 16; // 街区高度
    const mainRoadW = 2; // 主干道宽

    for (let x = 4; x < MAP_WIDTH; x += roadGapX) drawRoad(x, 0, mainRoadW, MAP_HEIGHT);
    for (let y = 4; y < MAP_HEIGHT; y += roadGapY) drawRoad(0, y, MAP_WIDTH, mainRoadW);

    // 2. 区域功能定义与填充
    for (let gy = 4; gy < MAP_HEIGHT - roadGapY; gy += roadGapY) {
        for (let gx = 4; gx < MAP_WIDTH - roadGapX; gx += roadGapX) {
            
            // 街区内部边界
            const bx = gx + mainRoadW;
            const by = gy + mainRoadW;
            const bw = roadGapX - mainRoadW;
            const bh = roadGapY - mainRoadW;

            // 根据坐标决定区域功能
            // 中央区域(40-60)为商业/行政，四周为住宅，右下角为公园
            const centerX = MAP_WIDTH / 2;
            const centerY = MAP_HEIGHT / 2;
            const distToCenter = Math.sqrt(Math.pow(gx - centerX, 2) + Math.pow(gy - centerY, 2));

            // 行道树 (在街区边缘)
            for(let i=0; i<bw; i+=3) props.push({x: bx+i, y: by-1, type: 'tree'}); // 上边
            for(let i=0; i<bw; i+=3) props.push({x: bx+i, y: by+bh, type: 'tree'}); // 下边

            if (gx > 60 && gy > 50) { 
                // === 城市公园 (City Park) ===
                // 只有树、花和水
                drawPool(bx + 4, by + 4, bw - 8, bh - 8); // 中心湖
                // 随机种树
                for(let k=0; k<15; k++) {
                    props.push({
                        x: bx + Math.random() * bw,
                        y: by + Math.random() * bh,
                        type: Math.random()>0.7 ? 'flower' : 'tree'
                    });
                }

            } else if (distToCenter < 25) {
                // === 中央商务区 (CBD) ===
                drawPavement(bx, by, bw, bh); // 铺地砖
                
                if ((gx+gy)%3 === 0) {
                    // 大型市政建筑 (图书馆/市政厅)
                    placeBuilding(bx + 2, by + 2, bw - 4, bh - 4, BLDG.CIVIC, "City Hall");
                } else {
                    // 紧凑的商店街
                    placeBuilding(bx + 1, by + 1, 6, 5, BLDG.SHOP, "Cafe");
                    placeBuilding(bx + 8, by + 1, 6, 5, BLDG.SHOP, "Mart");
                    placeBuilding(bx + 1, by + 7, 6, 5, BLDG.OFFICE, "Tech");
                    placeBuilding(bx + 8, by + 7, 6, 5, BLDG.OFFICE, "Bank");
                }

            } else {
                // === 住宅区 (Residential) ===
                // 铺设内部小路
                drawRoad(bx + Math.floor(bw/2), by, 1, bh); // 竖向小路
                
                // 左侧房子
                placeBuilding(bx + 1, by + 2, 5, 4, BLDG.HOME_M, "House");
                placeBuilding(bx + 1, by + 8, 5, 4, BLDG.HOME_S, "House");
                // 右侧房子
                placeBuilding(bx + bw - 6, by + 2, 5, 4, BLDG.HOME_S, "House");
                placeBuilding(bx + bw - 6, by + 8, 5, 4, BLDG.HOME_M, "House");
                
                // 院子里的装饰
                props.push({x: bx+1, y: by+1, type: 'flower'});
                props.push({x: bx+bw-2, y: by+bh-2, type: 'tree'});
            }
        }
    }

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 (2.5D Pastel Style) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = MAP_WIDTH * TILE_SIZE;
    const height = MAP_HEIGHT * TILE_SIZE;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 1. 绘制地面 (Layer 0)
    const { grid, buildings, props } = cityData;
    
    // 背景填充
    ctx.fillStyle = COLORS.GRASS_BG;
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const type = grid[y * MAP_WIDTH + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (type === TILES.ROAD) {
            ctx.fillStyle = COLORS.ROAD;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 极淡的边线
            ctx.fillStyle = COLORS.ROAD_EDGE;
            if (grid[(y+1)*MAP_WIDTH+x] !== TILES.ROAD) ctx.fillRect(px, py+TILE_SIZE-1, TILE_SIZE, 1);
        } else if (type === TILES.PAVEMENT) {
            ctx.fillStyle = COLORS.PAVEMENT;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (type === TILES.WATER) {
            ctx.fillStyle = COLORS.WATER;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 2. 绘制装饰物 (Layer 1)
    props.forEach(p => {
        const px = p.x * TILE_SIZE;
        const py = p.y * TILE_SIZE;
        const cx = px + TILE_SIZE/2;
        const cy = py + TILE_SIZE/2;

        if (p.type === 'tree') {
            // 树影
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.beginPath(); ctx.ellipse(cx+2, cy+10, 8, 3, 0, 0, Math.PI*2); ctx.fill();
            // 树干
            ctx.fillStyle = COLORS.TREE_TRUNK;
            ctx.fillRect(cx-2, cy, 4, 8);
            // 树冠 (圆形，淡雅绿)
            ctx.fillStyle = COLORS.TREE;
            ctx.beginPath(); ctx.arc(cx, cy-6, 10, 0, Math.PI*2); ctx.fill();
        } else if (p.type === 'flower') {
            ctx.fillStyle = '#ffccbc'; // 淡粉花
            ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
        }
    });

    // 3. 绘制建筑 (Layer 2) - 核心逻辑：画出淡雅的房子
    buildings.forEach(b => {
        const px = b.x * TILE_SIZE;
        const py = b.y * TILE_SIZE;
        const pw = b.w * TILE_SIZE;
        const ph = b.h * TILE_SIZE;

        // 建筑阴影 (非常淡)
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(px + 4, py + ph - 2, pw, 6);

        // --- 墙体绘制 ---
        const wallH = ph * 0.55; 
        const roofH = ph * 0.5; 
        const wallY = py + ph - wallH;

        ctx.fillStyle = COLORS.WALL;
        ctx.fillRect(px, wallY, pw, wallH);
        
        // 墙体底部阴影条
        ctx.fillStyle = COLORS.WALL_S;
        ctx.fillRect(px, wallY + wallH - 2, pw, 2);

        // --- 门窗绘制 ---
        const doorW = 10;
        const doorH = 14;
        const doorX = px + pw/2 - doorW/2;
        const doorY = py + ph - doorH;
        
        ctx.fillStyle = COLORS.DOOR;
        ctx.fillRect(doorX, doorY, doorW, doorH);

        // 窗户 (大一点，淡蓝色)
        if (b.type !== BLDG.CIVIC) {
            ctx.fillStyle = COLORS.WINDOW;
            const winSize = 8;
            const winY = wallY + 8;
            if (pw > 40) {
                ctx.fillRect(px + 8, winY, winSize, winSize);
                ctx.fillRect(px + pw - 8 - winSize, winY, winSize, winSize);
            }
        }

        // --- 屋顶绘制 (2.5D 效果) ---
        let roofColor = COLORS.ROOF_RES_A;
        if (b.type === BLDG.HOME_M) roofColor = COLORS.ROOF_RES_B;
        if (b.type === BLDG.SHOP) roofColor = COLORS.ROOF_COM;
        if (b.type === BLDG.OFFICE) roofColor = COLORS.ROOF_PUB;
        if (b.type === BLDG.CIVIC) roofColor = COLORS.ROOF_CIVIC;

        ctx.fillStyle = roofColor;
        
        if (b.type === BLDG.CIVIC || b.type === BLDG.OFFICE) {
            // 平顶/梯形顶 (公共建筑)
            ctx.beginPath();
            ctx.moveTo(px - 2, wallY);
            ctx.lineTo(px + 4, py);
            ctx.lineTo(px + pw - 4, py);
            ctx.lineTo(px + pw + 2, wallY);
            ctx.fill();
            
            // 加一个二层小楼在中间
            const topW = pw * 0.6;
            const topX = px + (pw - topW)/2;
            ctx.fillStyle = COLORS.WALL; // 二层墙
            ctx.fillRect(topX, py - 10, topW, 15);
            ctx.fillStyle = roofColor; // 二层顶
            ctx.beginPath();
            ctx.moveTo(topX - 2, py - 10);
            ctx.lineTo(topX + topW/2, py - 20);
            ctx.lineTo(topX + topW + 2, py - 10);
            ctx.fill();

        } else {
            // 三角尖顶 (民居)
            ctx.beginPath();
            const overhang = 4;
            ctx.moveTo(px - overhang, wallY);
            ctx.lineTo(px + pw/2, py - 5);
            ctx.lineTo(px + pw + overhang, wallY);
            ctx.fill();
            
            // 屋顶侧面厚度 (让它看起来立体)
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.beginPath();
            ctx.moveTo(px - overhang, wallY);
            ctx.lineTo(px + pw + overhang, wallY);
            ctx.lineTo(px + pw + overhang, wallY + 3);
            ctx.lineTo(px - overhang, wallY + 3);
            ctx.fill();
        }

        // 标签 (简单绘制)
        /*
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, px + pw/2, wallY - 4);
        */
    });

  }, [cityData]);

  // --- 3. Viewport Focus ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapW = MAP_WIDTH * TILE_SIZE;
      
      // 计算缩放：确保能看到整个大都会的宽度，或者至少一大半
      // 100个格子太宽了，为了看清细节，我们只显示 45 个格子宽
      const targetCols = 45; 
      const scale = pW / (targetCols * TILE_SIZE);
      
      // 居中
      const x = (pW - mapW * scale) / 2;
      const y = (pH - MAP_HEIGHT * TILE_SIZE * scale) / 2;
      
      setViewState({ scale, x, y });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#fcfcfc] relative overflow-hidden select-none cursor-grab active:cursor-grabbing">
      
      <div 
        className="absolute origin-center transition-transform duration-300 ease-out"
        style={{
          width: MAP_WIDTH * TILE_SIZE,
          height: MAP_HEIGHT * TILE_SIZE,
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
          // 取消 pixelated，让淡雅风格更柔和
        }}
      >
        {/* 底层 Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-sm" />

        {/* 顶层：角色 Entity */}
        {agents.map((agent: any) => {
            // 坐标映射 0-100 -> 0-MAP_WIDTH
            const tx = (agent.x / 100) * MAP_WIDTH;
            const ty = (agent.y / 100) * MAP_HEIGHT;
            
            const px = tx * TILE_SIZE;
            const py = ty * TILE_SIZE;

            const isTalking = agent.actionLog && agent.actionLog.includes('“');

            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: px, top: py, width: TILE_SIZE, height: TILE_SIZE }}
                >
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        {/* 名字标签 */}
                        <div className="absolute top-[-12px] bg-white/80 text-stone-600 text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border border-stone-100">
                            {agent.name}
                        </div>

                        {/* 气泡 */}
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border border-stone-200 px-2 py-1 rounded-xl text-[10px] text-stone-600 shadow-sm whitespace-nowrap z-50">
                                💬
                            </div>
                        )}

                        {/* 角色 Sprite (扁平圆点风，更显现代) */}
                        <div className={`
                            w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center
                            ${agent.job.includes('建筑') ? 'bg-[#ffcc80]' : agent.job.includes('领袖') ? 'bg-[#90caf9]' : 'bg-[#a5d6a7]'}
                        `}>
                            <span className="text-[10px] text-white font-bold">{agent.name[0]}</span>
                        </div>
                        
                        {/* 阴影 */}
                        <div className="absolute bottom-0 w-4 h-1 bg-black/10 rounded-full"></div>
                    </div>
                </div>
            );
        })}

      </div>
    </div>
  );
}