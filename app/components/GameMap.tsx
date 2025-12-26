'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Construction, Anchor, Trees, Mountain } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 32;   // 格子变大，看得更清
const MAP_SIZE = 80;    // 80x80 地图，足够大

// --- 2. 纯净配色 ---
const PALETTE: any = {
  WATER:      '#60a5fa', // 浅蓝海面
  SAND:       '#fde047', // 沙滩
  GRASS:      '#86efac', // 草地
  FOREST:     '#4ade80', // 森林
  STONE:      '#9ca3af', // 矿石
};

const BUILDINGS: any = {
  'House': <Home className="text-orange-700 fill-orange-300" size={28} />,
  'Warehouse': <Warehouse className="text-indigo-800 fill-indigo-300" size={32} />,
  'Clinic': <Ambulance className="text-rose-700 fill-rose-300" size={28} />,
  'Kitchen': <Utensils className="text-amber-700 fill-amber-300" size={24} />,
  'Tower': <Castle className="text-stone-700 fill-stone-300" size={40} />,
};

// 基础哈希
const hash = (x: number, y: number) => {
    let s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
};

// 线性插值
const lerp = (a: number, b: number, t: number) => a + t * (b - a);

// 平滑噪声
const smoothNoise = (x: number, y: number) => {
    const i_x = Math.floor(x);
    const i_y = Math.floor(y);
    const f_x = x - i_x;
    const f_y = y - i_y;

    const u_x = f_x * f_x * (3.0 - 2.0 * f_x);
    const u_y = f_y * f_y * (3.0 - 2.0 * f_y);

    const a = hash(i_x, i_y);
    const b = hash(i_x + 1, i_y);
    const c = hash(i_x, i_y + 1);
    const d = hash(i_x + 1, i_y + 1);

    return lerp(lerp(a, b, u_x), lerp(c, d, u_x), u_y);
};

const fbm = (x: number, y: number) => {
    let total = 0;
    total += smoothNoise(x, y) * 0.5;
    total += smoothNoise(x * 2, y * 2) * 0.25;
    total += smoothNoise(x * 4, y * 4) * 0.125;
    return total; 
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents, buildings } = worldData || { agents: [], buildings: [] };

  // --- 1. 生成地形数据 ---
  const terrainMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
    const center = MAP_SIZE / 2;
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        const dx = x - center;
        const dy = y - center;
        // 放大岛屿半径，让陆地占满大部分区域
        // 原来除以 2.2，现在除以 2.8，这意味着岛屿半径变大了
        const dist = Math.sqrt(dx*dx + dy*dy) / (MAP_SIZE / 2.8);

        const n = fbm(x * 0.03, y * 0.03); // 更低频噪声，地形更平缓
        const height = n - (dist * dist * 0.5); // 边缘衰减变慢

        let typeIdx = 0; // WATER
        if (height > 0.50) typeIdx = 4;      // STONE
        else if (height > 0.35) typeIdx = 3; // FOREST
        else if (height > 0.02) typeIdx = 2; // GRASS
        else if (height > -0.05) typeIdx = 1; // SAND
        
        map[y * MAP_SIZE + x] = typeIdx;
      }
    }
    return map;
  }, []);

  // --- 2. Canvas 绘制 (地形 + 网格线) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // 设置实际分辨率
    canvas.width = MAP_SIZE * TILE_SIZE * dpr;
    canvas.height = MAP_SIZE * TILE_SIZE * dpr;
    ctx.scale(dpr, dpr);
    
    // 设置 CSS 显示尺寸
    canvas.style.width = `${MAP_SIZE * TILE_SIZE}px`;
    canvas.style.height = `${MAP_SIZE * TILE_SIZE}px`;

    const colors = [PALETTE.WATER, PALETTE.SAND, PALETTE.GRASS, PALETTE.FOREST, PALETTE.STONE];

    // 1. 绘制底色
    ctx.fillStyle = PALETTE.WATER;
    ctx.fillRect(0, 0, MAP_SIZE * TILE_SIZE, MAP_SIZE * TILE_SIZE);

    // 2. 绘制地形块
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const typeIdx = terrainMap[y * MAP_SIZE + x];
        if (typeIdx === 0) continue; 

        ctx.fillStyle = colors[typeIdx];
        // 稍微画大一点消除缝隙
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
      }
    }

    // 3. 绘制满铺网格线 (Grid Lines)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'; // 10% 透明度的黑线
    ctx.lineWidth = 1;

    // 竖线
    for (let x = 0; x <= MAP_SIZE; x++) {
        const pos = x * TILE_SIZE;
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, MAP_SIZE * TILE_SIZE);
    }
    // 横线
    for (let y = 0; y <= MAP_SIZE; y++) {
        const pos = y * TILE_SIZE;
        ctx.moveTo(0, pos);
        ctx.lineTo(MAP_SIZE * TILE_SIZE, pos);
    }
    ctx.stroke();

  }, [terrainMap]);

  // --- 3. 自动聚焦视口 (Zoom In) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapTotalW = MAP_SIZE * TILE_SIZE;
      const mapTotalH = MAP_SIZE * TILE_SIZE;

      // 核心修改：不再显示全图，而是聚焦
      // 目标：屏幕宽度大约显示 35 个格子 (35 * 32px = 1120px)
      // 如果屏幕是 1920，scale 就是 1920 / 1120 ≈ 1.7
      // 如果屏幕是 800，scale 就是 800 / 1120 ≈ 0.7
      const targetVisibleTiles = 35; 
      const scale = pW / (targetVisibleTiles * TILE_SIZE);
      
      // 始终居中
      const x = (pW - mapTotalW * scale) / 2;
      const y = (pH - mapTotalH * scale) / 2;
      
      setViewState({ scale, x, y });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换
  const getRealCoord = (lx: number, ly: number) => {
      // 映射逻辑坐标到地图中心区域
      const center = (MAP_SIZE * TILE_SIZE) / 2;
      const spread = (MAP_SIZE * TILE_SIZE) / 6; // 分散系数
      return {
          x: center + (lx - 1) * spread,
          y: center + (ly - 1) * spread
      };
  };

  if (!worldData) return <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-300 font-mono text-xs">LOADING TERRAIN...</div>;

  return (
    // 外层容器：使用海水的颜色作为底色，这样即使地图没铺满也不会穿帮
    <div ref={containerRef} className="w-full h-full bg-[#60a5fa] relative overflow-hidden select-none">
      
      <div 
        className="absolute origin-top-left shadow-2xl" 
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
          // 移除了圆角，让地图充满
        }}
      >
        {/* 地形 + 网格 Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0" />

        {/* 建筑层 */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-10 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: pos.x, top: pos.y }}
                >
                    {/* 建筑本身 */}
                    {BUILDINGS[b.type] || <Construction className="text-stone-600" size={32} />}
                    {/* 建筑名称 */}
                    <div className="mt-1 px-1.5 py-0.5 bg-white/90 backdrop-blur rounded text-[10px] font-bold text-stone-700 shadow-sm whitespace-nowrap border border-stone-200">
                        {b.name}
                    </div>
                </div>
            );
        })}

        {/* 角色层 */}
        {agents.map((agent: any) => {
            const basePos = getRealCoord(agent.x, agent.y);
            const seed = agent.id * 73;
            // 随机偏移量调大，因为 TILE_SIZE 变大了
            const offsetX = (Math.sin(seed) * TILE_SIZE * 2); 
            const offsetY = (Math.cos(seed) * TILE_SIZE * 2);
            
            const isTalking = agent.actionLog && agent.actionLog.includes('“');

            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[2000ms] ease-linear will-change-transform"
                    style={{ left: basePos.x + offsetX, top: basePos.y + offsetY }}
                >
                    <div className="relative flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 group hover:scale-125 transition-transform hover:z-50">
                        {/* 气泡 */}
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border border-stone-300 px-2 py-1 rounded-xl text-[10px] shadow-md whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 text-stone-800 font-medium">
                                💬 ...
                            </div>
                        )}
                        
                        {/* 角色圆点 - 变大一点 */}
                        <div className={`
                            w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-600' : 'bg-emerald-500'}
                        `}>
                            {/* 职业首字母 */}
                            <span className="text-[8px] text-white font-black">{agent.job[0]}</span>
                        </div>

                        {/* 名字 (常驻显示，不再隐藏) */}
                        <div className="absolute top-full mt-1 bg-black/60 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
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