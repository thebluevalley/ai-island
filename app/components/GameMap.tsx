'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Mountain, Construction, MapPin, Tent } from 'lucide-react';

// --- 1. 超高精度配置 ---
const TILE_SIZE = 10;   // 格子非常小，像像素点一样
const MAP_SIZE = 120;   // 120x120 = 14400 个格子，提供极高分辨率

// --- 2. 扁平化写实配色 (去除高饱和度) ---
const PALETTE: any = {
  DEEP_WATER: '#3b82f6', // 深海
  WATER:      '#60a5fa', // 浅海
  SAND:       '#fde047', // 沙滩
  GRASS:      '#86efac', // 草地 (底色)
  FOREST:     '#4ade80', // 森林 (稍深)
  DENSE:      '#22c55e', // 密林 (深绿)
  MOUNTAIN:   '#a8a29e', // 岩石
  SNOW:       '#f3f4f6', // 雪顶
};

// 建筑图标映射
const BUILDINGS: any = {
  'House': <Home className="text-orange-700 fill-orange-400" size={24} />,
  'Warehouse': <Warehouse className="text-indigo-800 fill-indigo-400" size={28} />,
  'Clinic': <Ambulance className="text-rose-700 fill-rose-400" size={24} />,
  'Kitchen': <Utensils className="text-amber-700 fill-amber-500" size={20} />,
  'Tower': <Castle className="text-stone-700 fill-stone-400" size={32} />,
};

// 简易噪声
const noise = (x: number, y: number, seed: number = 1) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return s - Math.floor(s);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents, buildings } = worldData || { agents: [], buildings: [] };

  // --- 1. 生成地形数据 ---
  const terrainMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE); // 使用数组存储类型索引以节省内存
    const center = MAP_SIZE / 2;
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 距离场：圆形岛屿
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx*dx + dy*dy) / (MAP_SIZE / 2.1);

        // 极低频噪声：生成大片连续区域
        const n1 = noise(x * 0.03, y * 0.03, 111); 
        const n2 = noise(x * 0.1, y * 0.1, 222);
        
        // 高度计算
        const height = (n1 * 0.8 + n2 * 0.2) - dist;

        // 类型判定 (0-7 对应不同地形)
        let typeIdx = 0; // DEEP_WATER
        if (height > 0.65) typeIdx = 7; // SNOW
        else if (height > 0.5) typeIdx = 6; // MOUNTAIN
        else if (height > 0.35) typeIdx = 5; // DENSE
        else if (height > 0.15) typeIdx = 4; // FOREST
        else if (height > 0.02) typeIdx = 3; // GRASS
        else if (height > -0.05) typeIdx = 2; // SAND
        else if (height > -0.2) typeIdx = 1; // WATER
        
        map[y * MAP_SIZE + x] = typeIdx;
      }
    }
    return map;
  }, []);

  // --- 2. Canvas 绘制地形 (解决 DOM 过多导致的卡顿) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const colors =Object.values(PALETTE) as string[];

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const typeIdx = terrainMap[y * MAP_SIZE + x];
        ctx.fillStyle = colors[typeIdx];
        // 稍微画大一点点(0.5px)防止缝隙
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
      }
    }
  }, [terrainMap]);

  // --- 3. Auto-Fit 逻辑 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapPixelW = MAP_SIZE * TILE_SIZE;
      const mapPixelH = MAP_SIZE * TILE_SIZE;
      
      // 计算缩放，留出 5% 边距
      const scale = Math.min(pW / mapPixelW, pH / mapPixelH) * 0.95; 
      
      setViewState({
        scale: scale,
        x: (pW - mapPixelW * scale) / 2,
        y: (pH - mapPixelH * scale) / 2
      });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换：逻辑坐标 -> 像素坐标
  const getRealCoord = (lx: number, ly: number) => {
      // 将 3x3 逻辑网格映射到 120x120 的中心区域 (范围 40-80)
      const center = (MAP_SIZE * TILE_SIZE) / 2;
      const spread = (MAP_SIZE * TILE_SIZE) / 4; // 分散范围
      return {
          x: center + (lx - 1) * spread,
          y: center + (ly - 1) * spread
      };
  };

  if (!worldData) return <div className="w-full h-full bg-[#f0f9ff] flex items-center justify-center text-blue-300 font-mono text-xs">SATELLITE CONNECTING...</div>;

  return (
    <div ref={containerRef} className="w-full h-full bg-[#e0f2fe] relative overflow-hidden select-none">
      
      {/* 变换容器 */}
      <div 
        className="absolute origin-top-left shadow-2xl bg-white"
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
        }}
      >
        {/* 层级 0: Canvas 地形 (静态背景) */}
        <canvas 
            ref={canvasRef} 
            width={MAP_SIZE * TILE_SIZE} 
            height={MAP_SIZE * TILE_SIZE} 
            className="absolute inset-0 z-0"
        />

        {/* 层级 1: 网格线 (可选，增加科技感) */}
        <div 
            className="absolute inset-0 z-0 pointer-events-none opacity-10"
            style={{
                backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                backgroundSize: `${TILE_SIZE * 5}px ${TILE_SIZE * 5}px` // 每5个格子一条粗线
            }}
        ></div>

        {/* 层级 2: 建筑层 (DOM) */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-10 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: pos.x, top: pos.y }}
                >
                    {BUILDINGS[b.type] || <Construction className="text-stone-600" size={24} />}
                    <div className="mt-1 px-1.5 py-0.5 bg-white/80 backdrop-blur rounded text-[8px] font-bold text-stone-700 shadow-sm whitespace-nowrap border border-stone-200">
                        {b.name}
                    </div>
                </div>
            );
        })}

        {/* 层级 3: 角色层 (DOM) */}
        {agents.map((agent: any) => {
            const basePos = getRealCoord(agent.x, agent.y);
            // 随机散布，避免重叠
            const seed = agent.id * 999;
            const offsetX = (noise(seed, 0) - 0.5) * TILE_SIZE * 8; 
            const offsetY = (noise(0, seed) - 0.5) * TILE_SIZE * 8;
            
            const isTalking = agent.actionLog && agent.actionLog.includes('“');

            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[2000ms] ease-linear will-change-transform"
                    style={{ 
                        left: basePos.x + offsetX, 
                        top: basePos.y + offsetY,
                    }}
                >
                    <div className="relative flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 group">
                        {/* 气泡 */}
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border border-stone-200 px-2 py-1 rounded-xl text-[8px] shadow-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 max-w-[100px] overflow-hidden text-ellipsis">
                                💬 ...
                            </div>
                        )}
                        
                        {/* 头像圆点 (类似 Google Maps 用户位置) */}
                        <div className={`
                            w-4 h-4 rounded-full border-2 border-white shadow-md flex items-center justify-center
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-600' : 'bg-emerald-500'}
                        `}>
                            {/* 职业首字母 */}
                            <span className="text-[6px] font-bold text-white leading-none">{agent.job[0]}</span>
                        </div>

                        {/* 名字 (悬浮显示) */}
                        <div className="absolute top-full mt-1 bg-stone-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
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