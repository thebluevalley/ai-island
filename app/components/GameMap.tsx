'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Mountain, Construction } from 'lucide-react';

// --- 1. 像素风配置 ---
const TILE_SIZE = 32;   // 经典 RPG 格子大小
const MAP_SIZE = 64;    // 64x64，适合像素风的尺度

// --- 2. AI Town 风格配色 (明亮、复古) ---
const PALETTE = {
  WATER:      '#5dade2', // 像素蓝
  WATER_EDGE: '#45b39d', // 浅滩色
  SAND:       '#f5cba7', // 暖沙色
  GRASS:      '#abebc6', // 嫩绿 (主色调)
  FOREST:     '#58d68d', // 深绿
  STONE:      '#d5d8dc', // 岩石灰
  GRID:       'rgba(0,0,0,0.05)', // 网格线颜色
};

// 建筑图标 (俯视风格)
const BUILDINGS: any = {
  'House': <Home className="text-orange-600 fill-orange-100" size={24} />,
  'Warehouse': <Warehouse className="text-indigo-600 fill-indigo-100" size={28} />,
  'Clinic': <Ambulance className="text-rose-600 fill-rose-100" size={24} />,
  'Kitchen': <Utensils className="text-amber-600 fill-amber-100" size={20} />,
  'Tower': <Castle className="text-stone-600 fill-stone-200" size={32} />,
};

// --- 噪声算法 (保持不变，用于生成半岛) ---
const hash = (x: number, y: number) => {
    let s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
};
const lerp = (a: number, b: number, t: number) => a + t * (b - a);
const smoothNoise = (x: number, y: number) => {
    const i_x = Math.floor(x); const i_y = Math.floor(y);
    const f_x = x - i_x; const f_y = y - i_y;
    const u_x = f_x * f_x * (3.0 - 2.0 * f_x);
    const u_y = f_y * f_y * (3.0 - 2.0 * f_y);
    const a = hash(i_x, i_y); const b = hash(i_x + 1, i_y);
    const c = hash(i_x, i_y + 1); const d = hash(i_x + 1, i_y + 1);
    return lerp(lerp(a, b, u_x), lerp(c, d, u_x), u_y);
};
const fbm = (x: number, y: number) => {
    let total = 0;
    total += smoothNoise(x, y) * 0.5;
    total += smoothNoise(x * 2.0, y * 2.0) * 0.25;
    return total; 
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents, buildings } = worldData || { agents: [], buildings: [] };

  // --- 1. 生成半岛地形 ---
  const terrainMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 坐标扭曲：让海岸线更像 RPG 地图
        const warpX = x + fbm(x * 0.05, y * 0.05) * 10;
        const warpY = y + fbm(x * 0.05, y * 0.05) * 10;
        
        // 线性渐变：左上陆地，右下海洋
        const gradient = 1.2 - ((warpX + warpY) / (MAP_SIZE * 1.4));
        
        // 类型索引
        let typeIdx = 0; // WATER
        if (gradient > 0.65) typeIdx = 4;      // STONE (高地)
        else if (gradient > 0.45) typeIdx = 3; // FOREST (森林)
        else if (gradient > 0.25) typeIdx = 2; // GRASS (平原)
        else if (gradient > 0.18) typeIdx = 1; // SAND (沙滩)
        
        map[y * MAP_SIZE + x] = typeIdx;
      }
    }
    return map;
  }, []);

  // --- 2. Canvas 绘制 RPG 风格地图 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = MAP_SIZE * TILE_SIZE;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    // 颜色映射
    const colors = [PALETTE.WATER, PALETTE.SAND, PALETTE.GRASS, PALETTE.FOREST, PALETTE.STONE];

    // 填充海洋背景
    ctx.fillStyle = PALETTE.WATER;
    ctx.fillRect(0, 0, size, size);

    // 绘制格子
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const typeIdx = terrainMap[y * MAP_SIZE + x];
        if (typeIdx === 0) continue; // 水域跳过，露底色

        const posX = x * TILE_SIZE;
        const posY = y * TILE_SIZE;

        // 绘制地块主体
        ctx.fillStyle = colors[typeIdx];
        ctx.fillRect(posX, posY, TILE_SIZE, TILE_SIZE);

        // 绘制像素风边框 (Grid)
        ctx.strokeStyle = PALETTE.GRID;
        ctx.lineWidth = 1;
        ctx.strokeRect(posX, posY, TILE_SIZE, TILE_SIZE);

        // 装饰细节 (像素点缀)
        if (typeIdx === 3) { // 森林
           ctx.fillStyle = 'rgba(0,50,0,0.1)';
           ctx.beginPath();
           ctx.arc(posX + TILE_SIZE/2, posY + TILE_SIZE/2, 4, 0, Math.PI*2);
           ctx.fill();
        }
        if (typeIdx === 2 && (x+y)%7===0) { // 草地小花
           ctx.fillStyle = 'rgba(255,255,255,0.4)';
           ctx.fillRect(posX + 10, posY + 10, 4, 4);
        }
      }
    }
  }, [terrainMap]);

  // --- 3. Viewport Focus (聚焦模式) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapW = MAP_SIZE * TILE_SIZE;
      
      // 这里的缩放逻辑改为：确保屏幕能看到大约 30 格宽的区域
      // 这样能看清小人，又不会太近
      const targetTilesVisible = 32; 
      const scale = pW / (targetTilesVisible * TILE_SIZE);
      
      // 居中
      const x = (pW - mapW * scale) / 2;
      const y = (pH - mapW * scale) / 2;
      
      setViewState({ scale, x, y });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换 (映射到地图中心)
  const getRealCoord = (lx: number, ly: number) => {
      // 简单映射：将逻辑坐标分散在地图中间的草地区域
      const centerX = (MAP_SIZE * TILE_SIZE) / 2.5; 
      const centerY = (MAP_SIZE * TILE_SIZE) / 2.5; 
      const spread = TILE_SIZE * 5; 
      return {
          x: centerX + (lx - 1) * spread,
          y: centerY + (ly - 1) * spread
      };
  };

  if (!worldData) return <div className="w-full h-full bg-[#5dade2] flex items-center justify-center text-white font-mono text-sm">LOADING WORLD...</div>;

  return (
    <div ref={containerRef} className="w-full h-full bg-[#5dade2] relative overflow-hidden select-none">
      
      {/* 游戏世界容器 (2D Top-Down) */}
      <div 
        className="absolute origin-center transition-transform duration-300 ease-out will-change-transform"
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          // 纯 2D 变换，无旋转
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
        }}
      >
        {/* 层 1: 地形 Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0 image-pixelated" />

        {/* 层 2: 建筑 (RPG 风格) */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-10 flex flex-col items-center justify-center"
                    style={{ left: pos.x, top: pos.y, width: TILE_SIZE, height: TILE_SIZE }}
                >
                    {/* 建筑底座 (模拟占据一个格子) */}
                    <div className="absolute inset-0 bg-black/10 rounded-sm"></div>
                    {/* 图标 */}
                    <div className="relative z-10 -mt-2">
                       {BUILDINGS[b.type] || <Construction className="text-stone-600" size={24} />}
                    </div>
                    {/* 标签 */}
                    <div className="absolute top-full mt-1 px-1.5 py-0.5 bg-white/90 border border-stone-200 rounded text-[8px] font-bold text-stone-700 whitespace-nowrap shadow-sm z-20">
                        {b.name}
                    </div>
                </div>
            );
        })}

        {/* 层 3: 角色 (Token 风格) */}
        {agents.map((agent: any) => {
            const basePos = getRealCoord(agent.x, agent.y);
            // 随机游走偏移
            const seed = agent.id * 123;
            const offsetX = (Math.sin(seed) * TILE_SIZE); 
            const offsetY = (Math.cos(seed) * TILE_SIZE);
            const isTalking = agent.actionLog && agent.actionLog.includes('“');

            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[2000ms] ease-linear will-change-transform"
                    style={{ 
                        left: basePos.x + offsetX, 
                        top: basePos.y + offsetY,
                        width: TILE_SIZE,
                        height: TILE_SIZE
                    }}
                >
                    <div className="relative w-full h-full flex flex-col items-center justify-center group">
                        
                        {/* 对话气泡 (像素风) */}
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border-2 border-stone-800 px-2 py-1 rounded-lg text-[9px] font-bold shadow-lg whitespace-nowrap z-50 animate-bounce">
                                💬 ...
                            </div>
                        )}

                        {/* 角色 Token */}
                        <div className={`
                            w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center transform transition-transform group-hover:scale-110
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'}
                        `}>
                            {/* 头像简写 */}
                            <span className="text-[10px] text-white font-black">{agent.name[0]}</span>
                            
                            {/* 职业徽章 */}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center border border-stone-100 shadow-sm">
                               <span className="text-[8px] text-stone-600 font-bold">{agent.job[0]}</span>
                            </div>
                        </div>

                        {/* 名字标签 (常驻) */}
                        <div className="absolute top-full mt-1 bg-stone-800 text-white text-[8px] px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity">
                            {agent.name}
                        </div>
                    </div>
                </div>
            );
        })}

      </div>
    </div>
  );
}