'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Mountain, Construction, Tent } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 8;    // 格子更小，更细腻
const MAP_SIZE = 150;   // 150x150 = 22500 格，超大地图

// --- 2. 纯净配色 (去除杂色，追求整洁) ---
const PALETTE: any = {
  WATER:      '#60a5fa', // 浅蓝海面
  SAND:       '#fde047', // 明亮的沙滩
  GRASS:      '#86efac', // 主体草地 (大面积)
  FOREST:     '#4ade80', // 森林 (点缀)
  STONE:      '#9ca3af', // 矿石 (极少)
};

// 建筑图标
const BUILDINGS: any = {
  'House': <Home className="text-orange-700 fill-orange-300" size={20} />,
  'Warehouse': <Warehouse className="text-indigo-800 fill-indigo-300" size={24} />,
  'Clinic': <Ambulance className="text-rose-700 fill-rose-300" size={20} />,
  'Kitchen': <Utensils className="text-amber-700 fill-amber-300" size={18} />,
  'Tower': <Castle className="text-stone-700 fill-stone-300" size={28} />,
};

// --- 3. 核心算法：平滑值噪声 (Value Noise) ---
// 简单的 Math.sin 是白噪声(噪点)，必须用插值才能生成连续的大地块

// 基础哈希
const hash = (x: number, y: number) => {
    let s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
};

// 线性插值
const lerp = (a: number, b: number, t: number) => a + t * (b - a);

// 平滑噪声生成器
const smoothNoise = (x: number, y: number) => {
    const i_x = Math.floor(x);
    const i_y = Math.floor(y);
    const f_x = x - i_x;
    const f_y = y - i_y;

    // 平滑曲线 (Smoothstep)
    const u_x = f_x * f_x * (3.0 - 2.0 * f_x);
    const u_y = f_y * f_y * (3.0 - 2.0 * f_y);

    // 四个角的随机值
    const a = hash(i_x, i_y);
    const b = hash(i_x + 1, i_y);
    const c = hash(i_x, i_y + 1);
    const d = hash(i_x + 1, i_y + 1);

    // 双线性插值
    return lerp(lerp(a, b, u_x), lerp(c, d, u_x), u_y);
};

// 分形噪声 (叠加多层让边缘更自然)
const fbm = (x: number, y: number) => {
    let total = 0;
    total += smoothNoise(x, y) * 0.5;
    total += smoothNoise(x * 2, y * 2) * 0.25;
    total += smoothNoise(x * 4, y * 4) * 0.125;
    return total; // 范围 0.0 ~ 0.9
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents, buildings } = worldData || { agents: [], buildings: [] };

  // --- 1. 生成平滑地形 ---
  const terrainMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
    const center = MAP_SIZE / 2;
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 距离场：圆形岛屿遮罩
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx*dx + dy*dy) / (MAP_SIZE / 2.2);

        // 使用低频噪声生成大地块 (0.04 是非常平缓的频率)
        const n = fbm(x * 0.04, y * 0.04);
        
        // 高度 = 噪声 - 距离 (越远越低)
        const height = n - (dist * dist * 0.8); // 距离平方让边缘衰减更快

        // 类型判定 (大幅增加 GRASS 的范围)
        let typeIdx = 0; // WATER
        if (height > 0.55) typeIdx = 4;      // STONE (极少)
        else if (height > 0.40) typeIdx = 3; // FOREST (中心)
        else if (height > 0.05) typeIdx = 2; // GRASS (绝大部分是草地)
        else if (height > 0.00) typeIdx = 1; // SAND (窄边)
        
        map[y * MAP_SIZE + x] = typeIdx;
      }
    }
    return map;
  }, []);

  // --- 2. Canvas 绘制 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = MAP_SIZE * TILE_SIZE;
    canvas.height = MAP_SIZE * TILE_SIZE;

    // 颜色映射数组
    const colors = [PALETTE.WATER, PALETTE.SAND, PALETTE.GRASS, PALETTE.FOREST, PALETTE.STONE];

    // 填充背景
    ctx.fillStyle = PALETTE.WATER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const typeIdx = terrainMap[y * MAP_SIZE + x];
        if (typeIdx === 0) continue; // 水不用画，用背景色

        ctx.fillStyle = colors[typeIdx];
        // 稍微画大一点(0.2px)消除缝隙
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 0.2, TILE_SIZE + 0.2);
      }
    }
  }, [terrainMap]);

  // --- 3. Auto-Fit ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapW = MAP_SIZE * TILE_SIZE;
      const scale = Math.min(pW / mapW, pH / mapW) * 0.9; // 留 10% 边距
      
      setViewState({
        scale: scale,
        x: (pW - mapW * scale) / 2,
        y: (pH - mapW * scale) / 2
      });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换
  const getRealCoord = (lx: number, ly: number) => {
      const center = (MAP_SIZE * TILE_SIZE) / 2;
      const spread = (MAP_SIZE * TILE_SIZE) / 5; // 稍微集中一点
      return {
          x: center + (lx - 1) * spread,
          y: center + (ly - 1) * spread
      };
  };

  if (!worldData) return <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-300 font-mono text-xs">GENERATING WORLD...</div>;

  return (
    <div ref={containerRef} className="w-full h-full bg-[#bfdbfe] relative overflow-hidden select-none">
      
      <div 
        className="absolute origin-top-left shadow-xl bg-[#60a5fa] rounded-full" // 圆形裁切让岛屿更好看
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
          borderRadius: '50%'
        }}
      >
        {/* 地形层 */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0 rounded-full" />

        {/* 建筑层 */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-10 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: pos.x, top: pos.y }}
                >
                    {BUILDINGS[b.type] || <Construction className="text-stone-600" size={20} />}
                    <div className="mt-0.5 px-1 py-0.5 bg-white/80 backdrop-blur rounded text-[6px] font-bold text-stone-600 shadow-sm border border-stone-200">
                        {b.name}
                    </div>
                </div>
            );
        })}

        {/* 角色层 */}
        {agents.map((agent: any) => {
            const basePos = getRealCoord(agent.x, agent.y);
            // 简单随机偏移
            const seed = agent.id * 73;
            const offsetX = (Math.sin(seed) * 20); 
            const offsetY = (Math.cos(seed) * 20);
            
            const isTalking = agent.actionLog && agent.actionLog.includes('“');

            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[2000ms] ease-linear will-change-transform"
                    style={{ left: basePos.x + offsetX, top: basePos.y + offsetY }}
                >
                    <div className="relative flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 group">
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border border-stone-200 px-1.5 py-0.5 rounded text-[6px] shadow-sm animate-in fade-in zoom-in">
                                💬
                            </div>
                        )}
                        <div className={`
                            w-3 h-3 rounded-full border-2 border-white shadow-sm flex items-center justify-center
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'}
                        `}></div>
                        <div className="absolute top-full mt-0.5 bg-stone-800/80 text-white text-[6px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
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