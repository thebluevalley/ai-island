'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Construction } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 32;   // 大格子保持清晰度
const MAP_SIZE = 80;    // 80x80 地图基础尺寸

// --- 2. 纯净配色 ---
const PALETTE: any = {
  WATER:      '#60a5fa', // 浅蓝海面
  SAND:       '#fde047', // 沙滩
  GRASS:      '#86efac', // 草地 (广阔腹地)
  FOREST:     '#4ade80', // 森林 (连接内陆)
  STONE:      '#9ca3af', // 矿石 (高地)
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

// 分形噪声
const fbm = (x: number, y: number) => {
    let total = 0;
    total += smoothNoise(x, y) * 0.5;
    total += smoothNoise(x * 2.03, y * 2.03) * 0.25;
    total += smoothNoise(x * 4.07, y * 4.07) * 0.125;
    return total; 
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 初始 scale 设大一点，避免加载瞬间看到边缘
  const [viewState, setViewState] = useState({ scale: 1.5, x: 0, y: 0 });

  const { agents, buildings } = worldData || { agents: [], buildings: [] };

  // --- 1. 生成自然半岛地形 (核心算法改进) ---
  const terrainMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 关键改进：坐标扭曲 (Domain Warping)
        // 使用低频噪声来扭曲采样坐标，创造出蜿蜒自然的海岸线
        const warpX = x + fbm(x * 0.02, y * 0.02) * 25;
        const warpY = y + fbm(x * 0.02 + 5.2, y * 0.02 + 1.3) * 25;

        // 基于扭曲后坐标的对角线渐变
        // 使得陆地主要集中在左上方，但边界不规则
        const gradient = 1.2 - ((warpX + warpY * 0.9) / (MAP_SIZE * 1.6));

        // 添加一点高频细节噪声，让沙滩边缘更碎一点
        const detail = smoothNoise(x * 0.1, y * 0.1) * 0.08;
        
        const height = gradient + detail;

        // 重新校准阈值，确保有大片陆地和自然过渡
        let typeIdx = 0; // WATER (右下深海)
        if (height > 0.70) typeIdx = 4;      // STONE (内陆高地)
        else if (height > 0.48) typeIdx = 3; // FOREST (大片森林)
        else if (height > 0.25) typeIdx = 2; // GRASS (广阔平原)
        else if (height > 0.18) typeIdx = 1; // SAND (海岸线)
        
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

    const dpr = window.devicePixelRatio || 1;
    const totalPixelSize = MAP_SIZE * TILE_SIZE;

    canvas.width = totalPixelSize * dpr;
    canvas.height = totalPixelSize * dpr;
    ctx.scale(dpr, dpr);
    
    canvas.style.width = `${totalPixelSize}px`;
    canvas.style.height = `${totalPixelSize}px`;

    const colors = [PALETTE.WATER, PALETTE.SAND, PALETTE.GRASS, PALETTE.FOREST, PALETTE.STONE];

    // 绘制底色
    ctx.fillStyle = PALETTE.WATER;
    ctx.fillRect(0, 0, totalPixelSize, totalPixelSize);

    // 绘制地形块
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const typeIdx = terrainMap[y * MAP_SIZE + x];
        if (typeIdx === 0) continue; 

        ctx.fillStyle = colors[typeIdx];
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
      }
    }

    // 绘制网格线 (加深一点点以保持质感)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)'; 
    ctx.lineWidth = 1;

    for (let x = 0; x <= MAP_SIZE; x++) {
        const pos = x * TILE_SIZE;
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, totalPixelSize);
    }
    for (let y = 0; y <= MAP_SIZE; y++) {
        const pos = y * TILE_SIZE;
        ctx.moveTo(0, pos);
        ctx.lineTo(totalPixelSize, pos);
    }
    ctx.stroke();

  }, [terrainMap]);

  // --- 3. Auto-Fit View (核心改动：覆盖模式 Cover Mode) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0 || pH === 0) return;

      const mapTotalSize = MAP_SIZE * TILE_SIZE;

      // 计算宽和高的缩放比
      const scaleX = pW / mapTotalSize;
      const scaleY = pH / mapTotalSize;

      // 关键改动：使用 Math.max 来确保填满容器
      // 乘以 1.02 是为了留一点余量，防止计算误差导致边缘露白
      const scale = Math.max(scaleX, scaleY) * 1.02; 
      
      // 居中显示
      const x = (pW - mapTotalSize * scale) / 2;
      const y = (pH - mapTotalSize * scale) / 2;
      
      setViewState({ scale, x, y });
    };
    // 监听 resize，并立即执行一次
    window.addEventListener('resize', handleResize);
    handleResize(); 
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换 (映射到陆地较多的区域)
  const getRealCoord = (lx: number, ly: number) => {
      // 将逻辑坐标映射到地图左上方的陆地区域
      const spread = TILE_SIZE * 10; 
      const offsetX = MAP_SIZE * TILE_SIZE * 0.25;
      const offsetY = MAP_SIZE * TILE_SIZE * 0.25;
      return {
          x: offsetX + lx * spread,
          y: offsetY + ly * spread
      };
  };

  if (!worldData) return <div className="w-full h-full bg-[#60a5fa] flex items-center justify-center text-white/50 font-mono text-xs">GENERATING WORLD...</div>;

  return (
    // 外层容器背景色设为深海色，虽然理论上不会露出来
    <div ref={containerRef} className="w-full h-full bg-[#3b82f6] relative overflow-hidden select-none">
      
      <div 
        // 移除所有阴影和圆角，确保无缝填满
        className="absolute origin-center transition-transform duration-300 ease-out bg-[#60a5fa]"
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          // 使用 translate3d 开启硬件加速
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
        }}
      >
        {/* 地形 Canvas */}
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
                    <div className="transform scale-110 origin-bottom">
                        {BUILDINGS[b.type] || <Construction className="text-stone-600" size={32} />}
                    </div>
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
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border border-stone-300 px-2 py-1 rounded-xl text-[10px] shadow-md whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 text-stone-800 font-medium">
                                💬 ...
                            </div>
                        )}
                        
                        <div className={`
                            w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center transform scale-110
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-600' : 'bg-emerald-500'}
                        `}>
                            <span className="text-[9px] text-white font-black">{agent.job[0]}</span>
                        </div>

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