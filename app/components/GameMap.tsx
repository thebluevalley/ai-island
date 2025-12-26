'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, User } from 'lucide-react';

// --- 1. 配置 ---
const TILE_SIZE = 32;
const MAP_COLS = 60; 
const MAP_ROWS = 40; 

// 地块类型
const TILES = {
  GRASS: 0,
  ROAD: 1,
  WATER: 2,
};

// 建筑类型
const BUILDING_TYPES = {
  HOME_S: 'small_home',   // 小民居
  HOME_L: 'large_home',   // 大豪宅
  SHOP:   'shop',         // 商店
  SCHOOL: 'school',       // 学校/图书馆
  CAFE:   'cafe',         // 咖啡馆
};

// --- 2. 视觉配色 (AI Town / Pokemon 风格) ---
const COLORS = {
  GRASS_BG: '#76d7c4',      // 清新的薄荷绿 (草地)
  GRASS_D:  '#48c9b0',      // 深色草装饰
  ROAD:     '#e5e7e9',      // 灰白色路面
  ROAD_SHADOW:'#bdc3c7',    // 路面阴影
  WATER:    '#5dade2',      // 像素蓝
  
  // 建筑配色
  ROOF_RES: '#e74c3c',      // 民居红顶
  ROOF_COM: '#3498db',      // 商业蓝顶
  ROOF_PUB: '#f1c40f',      // 公共黄顶
  WALL:     '#fdfefe',      // 白墙
  WALL_SHADOW:'#d7dbdd',    // 墙面阴影
  DOOR:     '#5d4037',      // 深褐门
  WINDOW:   '#85c1e9',      // 窗户蓝
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 城市生成器 ---
  const cityData = useMemo(() => {
    // 地图网格
    const grid = new Uint8Array(MAP_COLS * MAP_ROWS).fill(TILES.GRASS);
    // 建筑列表 (独立于网格，方便渲染遮挡关系)
    const buildings: any[] = [];
    // 装饰物 (树)
    const props: any[] = [];

    // 辅助: 铺路
    const drawRoad = (x: number, y: number, w: number, h: number) => {
        for(let iy=y; iy<y+h; iy++) {
            for(let ix=x; ix<x+w; ix++) {
                if (ix>=0 && ix<MAP_COLS && iy>=0 && iy<MAP_ROWS) grid[iy * MAP_COLS + ix] = TILES.ROAD;
            }
        }
    };

    // 辅助: 放置建筑 (不修改 grid，只存入 buildings 列表)
    const placeBuilding = (x: number, y: number, w: number, h: number, type: string, label: string) => {
        // 建筑占地转换为路面或地基，避免草地穿帮
        // 这里我们让建筑下面也是草地，靠渲染层覆盖
        buildings.push({ x, y, w, h, type, label });
        
        // 门前铺一格路
        const doorX = x + Math.floor(w/2);
        const doorY = y + h;
        if (doorY < MAP_ROWS) grid[doorY * MAP_COLS + doorX] = TILES.ROAD;
    };

    // --- 规划布局 ---
    
    const roadWidth = 2;
    const blockW = 14;
    const blockH = 10;

    // 1. 生成井字形路网
    for (let x = 4; x < MAP_COLS; x += blockW) {
        drawRoad(x, 0, roadWidth, MAP_ROWS);
    }
    for (let y = 4; y < MAP_ROWS; y += blockH) {
        drawRoad(0, y, MAP_COLS, roadWidth);
    }

    // 2. 填充街区
    for (let gy = 4; gy < MAP_ROWS - blockH; gy += blockH) {
        for (let gx = 4; gx < MAP_COLS - blockW; gx += blockW) {
            // 街区内部坐标
            const bx = gx + roadWidth + 1;
            const by = gy + roadWidth + 1;
            
            // 随机决定用途
            const seed = Math.sin(gx * gy);
            
            if (seed > 0.6) {
                // 居民区：放两个小房子
                placeBuilding(bx, by, 4, 3, BUILDING_TYPES.HOME_S, "Home");
                placeBuilding(bx + 5, by + 2, 4, 3, BUILDING_TYPES.HOME_S, "Home");
            } else if (seed > 0.3) {
                // 商业区：放一个大店
                placeBuilding(bx + 1, by + 1, 6, 4, BUILDING_TYPES.SHOP, "Store");
            } else if (seed > 0.0) {
                // 豪宅
                placeBuilding(bx + 2, by + 1, 5, 4, BUILDING_TYPES.HOME_L, "Villa");
            } else {
                // 公园：种树
                for (let i=0; i<5; i++) {
                    props.push({ 
                        x: bx + Math.random() * (blockW - 4), 
                        y: by + Math.random() * (blockH - 4),
                        type: 'tree'
                    });
                }
            }
        }
    }

    // 3. 中央广场
    const cx = Math.floor(MAP_COLS/2) - 6;
    const cy = Math.floor(MAP_ROWS/2) - 6;
    drawRoad(cx, cy, 14, 12); // 铺满路作为广场地面
    placeBuilding(cx + 4, cy - 2, 6, 5, BUILDING_TYPES.SCHOOL, "Library"); // 广场北边的图书馆

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 (2.5D RPG Style) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = MAP_COLS * TILE_SIZE;
    const height = MAP_ROWS * TILE_SIZE;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 1. 绘制地面 (Layer 0)
    const { grid, buildings, props } = cityData;
    
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const type = grid[y * MAP_COLS + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (type === TILES.GRASS) {
            ctx.fillStyle = COLORS.GRASS_BG;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 草地纹理
            if ((x * y * 13) % 11 === 0) {
                ctx.fillStyle = COLORS.GRASS_D;
                ctx.fillRect(px + 8, py + 8, 4, 4);
                ctx.fillRect(px + 14, py + 10, 3, 3);
            }
        } else if (type === TILES.ROAD) {
            ctx.fillStyle = COLORS.ROAD;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 路缘阴影
            ctx.fillStyle = COLORS.ROAD_SHADOW;
            ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
        }
      }
    }

    // 2. 绘制装饰物 (Layer 1)
    props.forEach(p => {
        const px = p.x * TILE_SIZE;
        const py = p.y * TILE_SIZE;
        // 树阴影
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(px+16, py+28, 10, 4, 0, 0, Math.PI*2); ctx.fill();
        // 树干
        ctx.fillStyle = '#795548';
        ctx.fillRect(px+12, py+16, 8, 12);
        // 树冠 (两个圆叠起来)
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath(); ctx.arc(px+16, py+10, 14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.beginPath(); ctx.arc(px+16, py+4, 10, 0, Math.PI*2); ctx.fill();
    });

    // 3. 绘制建筑 (Layer 2) - 核心逻辑：画出房子形状
    buildings.forEach(b => {
        const px = b.x * TILE_SIZE;
        const py = b.y * TILE_SIZE;
        const pw = b.w * TILE_SIZE;
        const ph = b.h * TILE_SIZE;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(px + 4, py + ph - 4, pw, 8);

        // 墙体 (下半部分)
        const wallH = ph * 0.5; // 墙高
        const roofH = ph * 0.6; // 屋顶高 (稍微重叠)
        const wallY = py + ph - wallH;

        ctx.fillStyle = COLORS.WALL;
        ctx.fillRect(px, wallY, pw, wallH);
        // 墙体阴影/底边
        ctx.fillStyle = COLORS.WALL_SHADOW;
        ctx.fillRect(px, wallY + wallH - 4, pw, 4);

        // 门 (居中)
        const doorW = 12;
        const doorH = 18;
        const doorX = px + pw/2 - doorW/2;
        const doorY = py + ph - doorH;
        ctx.fillStyle = COLORS.DOOR;
        ctx.fillRect(doorX, doorY, doorW, doorH);

        // 窗户 (左右各一个)
        if (pw > 40) {
            ctx.fillStyle = COLORS.WINDOW;
            ctx.fillRect(px + 8, wallY + 8, 10, 10);
            ctx.fillRect(px + pw - 18, wallY + 8, 10, 10);
        }

        // 屋顶 (上半部分，梯形或三角形)
        let roofColor = COLORS.ROOF_RES;
        if (b.type === BUILDING_TYPES.SHOP) roofColor = COLORS.ROOF_COM;
        if (b.type === BUILDING_TYPES.SCHOOL) roofColor = COLORS.ROOF_PUB;

        ctx.fillStyle = roofColor;
        ctx.beginPath();
        // 模拟屋顶形状
        const overhang = 4; // 屋檐伸出
        ctx.moveTo(px - overhang, wallY);
        ctx.lineTo(px + pw/2, py - 10); // 屋脊
        ctx.lineTo(px + pw + overhang, wallY);
        ctx.closePath();
        ctx.fill();

        // 屋顶侧面/厚度
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; // 加深一点颜色做侧面
        ctx.beginPath();
        ctx.moveTo(px - overhang, wallY);
        ctx.lineTo(px + pw + overhang, wallY);
        ctx.lineTo(px + pw + overhang, wallY + 6);
        ctx.lineTo(px - overhang, wallY + 6);
        ctx.fill();

        // 建筑标签 (悬浮在屋顶)
        // 这种绘制在 Canvas 里文字可能不清晰，我们改用 DOM 覆盖在上面，或者简单的canvas文字
        /*
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, px + pw/2, py - 5);
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

      const mapW = MAP_COLS * TILE_SIZE;
      
      // 默认看中心
      const targetCols = 30; 
      const scale = pW / (targetCols * TILE_SIZE);
      
      const x = (pW - mapW * scale) / 2;
      const y = (pH - MAP_ROWS * TILE_SIZE * scale) / 2;
      
      setViewState({ scale, x, y });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#1e293b] relative overflow-hidden select-none">
      
      <div 
        className="absolute origin-center transition-transform duration-200 ease-out"
        style={{
          width: MAP_COLS * TILE_SIZE,
          height: MAP_ROWS * TILE_SIZE,
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
          imageRendering: 'pixelated'
        }}
      >
        {/* 底层 Canvas (地面+建筑) */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-2xl" />

        {/* 顶层：角色 Entity (保持 DOM 以便交互) */}
        {agents.map((agent: any) => {
            const tx = (agent.x / 100) * MAP_COLS;
            const ty = (agent.y / 100) * MAP_ROWS;
            
            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ 
                        left: tx * TILE_SIZE, 
                        top: ty * TILE_SIZE, 
                        width: TILE_SIZE, 
                        height: TILE_SIZE 
                    }}
                >
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        {/* 名字标签 */}
                        <div className="absolute top-[-10px] bg-black/60 text-white text-[8px] px-1.5 rounded-sm whitespace-nowrap backdrop-blur-sm border border-black/20">
                            {agent.name}
                        </div>

                        {/* 气泡 */}
                        {agent.actionLog && agent.actionLog.includes('“') && (
                            <div className="absolute bottom-full mb-1 bg-white border-2 border-black px-2 py-1 rounded-lg text-[9px] font-bold shadow-[2px_2px_0px_rgba(0,0,0,0.2)] whitespace-nowrap z-50">
                                💬
                            </div>
                        )}

                        {/* 角色 Sprite (像素小人) */}
                        <div className={`
                            w-6 h-8 rounded-sm border-2 border-black/30 shadow-sm flex flex-col items-center
                            ${agent.job.includes('建筑') ? 'bg-[#f39c12]' : agent.job.includes('领袖') ? 'bg-[#3498db]' : 'bg-[#e74c3c]'}
                        `}>
                            {/* 脸部 */}
                            <div className="w-full h-3 bg-[#f5cba7] border-b border-black/10"></div>
                            {/* 身体 */}
                            <div className="w-full h-4 flex justify-center">
                               <div className="w-0.5 h-full bg-black/20"></div>
                            </div>
                        </div>
                        
                        {/* 阴影 */}
                        <div className="absolute bottom-[-2px] w-5 h-1.5 bg-black/40 rounded-full blur-[1px]"></div>
                    </div>
                </div>
            );
        })}

      </div>
    </div>
  );
}