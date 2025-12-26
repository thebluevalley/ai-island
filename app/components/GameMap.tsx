'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Construction, Trees, Mountain } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 32;   // 32px 保证细节清晰
const MAP_SIZE = 80;    // 80x80

// --- 2. 扁平轴测配色 ---
const PALETTE: any = {
  WATER:      '#60a5fa', // 统一海面
  SAND:       '#fde047', // 沙滩
  GRASS:      '#86efac', // 草地
  FOREST:     '#4ade80', // 森林
  STONE:      '#9ca3af', // 矿区
};

// 建筑图标
const BUILDINGS: any = {
  'House': <Home className="text-orange-600 fill-orange-200" size={40} strokeWidth={1.5} />,
  'Warehouse': <Warehouse className="text-indigo-700 fill-indigo-200" size={48} strokeWidth={1.5} />,
  'Clinic': <Ambulance className="text-rose-600 fill-rose-200" size={40} strokeWidth={1.5} />,
  'Kitchen': <Utensils className="text-amber-600 fill-amber-200" size={32} strokeWidth={1.5} />,
  'Tower': <Castle className="text-stone-600 fill-stone-200" size={56} strokeWidth={1.5} />,
};

// --- 噪声算法 ---
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
    return lerp(lerp(hash(i_x, i_y), hash(i_x + 1, i_y), u_x), lerp(hash(i_x, i_y + 1), hash(i_x + 1, i_y + 1), u_x), u_y);
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

  // --- 1. 地形数据 (半岛形状) ---
  const terrainMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 坐标扭曲 + 对角线渐变 = 自然半岛
        const warpX = x + fbm(x * 0.03, y * 0.03) * 20;
        const warpY = y + fbm(x * 0.03, y * 0.03) * 20;
        const gradient = 1.1 - ((warpX + warpY) / (MAP_SIZE * 1.5));
        
        // 阈值判定
        let typeIdx = 0; // WATER
        if (gradient > 0.65) typeIdx = 4; // STONE
        else if (gradient > 0.45) typeIdx = 3; // FOREST
        else if (gradient > 0.22) typeIdx = 2; // GRASS
        else if (gradient > 0.15) typeIdx = 1; // SAND
        
        map[y * MAP_SIZE + x] = typeIdx;
      }
    }
    return map;
  }, []);

  // --- 2. Canvas 绘制 (纯平地形) ---
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

    const colors = [PALETTE.WATER, PALETTE.SAND, PALETTE.GRASS, PALETTE.FOREST, PALETTE.STONE];

    // 绘制底色
    ctx.fillStyle = PALETTE.WATER;
    ctx.fillRect(0, 0, size, size);

    // 绘制色块
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const typeIdx = terrainMap[y * MAP_SIZE + x];
        if (typeIdx === 0) continue; 
        ctx.fillStyle = colors[typeIdx];
        // +0.5 消除缝隙
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
      }
    }

    // 绘制网格 (增加轴测图的结构感)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)'; // 非常淡的网格
    ctx.lineWidth = 1;
    for (let i = 0; i <= MAP_SIZE; i++) {
        const p = i * TILE_SIZE;
        ctx.moveTo(p, 0); ctx.lineTo(p, size);
        ctx.moveTo(0, p); ctx.lineTo(size, p);
    }
    ctx.stroke();

  }, [terrainMap]);

  // --- 3. Isometric Auto-Fit (轴测全屏适配) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapW = MAP_SIZE * TILE_SIZE;
      
      // 轴测图不仅要考虑宽，还要考虑旋转后的菱形对角线
      // 简单粗暴的算法：放大到原来的 1.5 倍通常能填满
      const scale = Math.max(pW, pH) / mapW * 1.6;
      
      setViewState({
        scale,
        // 这里的居中需要考虑旋转中心
        x: (pW - mapW * scale) / 2, 
        y: (pH - mapW * scale) / 2 
      });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100); // 确保容器 ready
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换
  const getRealCoord = (lx: number, ly: number) => {
      // 映射到左上方的陆地区域
      const spread = TILE_SIZE * 8; 
      const start = MAP_SIZE * TILE_SIZE * 0.2;
      return {
          x: start + lx * spread,
          y: start + ly * spread
      };
  };

  if (!worldData) return <div className="w-full h-full bg-[#60a5fa] flex items-center justify-center text-white/50 text-xs font-mono">BUILDING ISOMETRIC VIEW...</div>;

  return (
    // 背景色与海水一致，实现无缝填充
    <div ref={containerRef} className="w-full h-full bg-[#60a5fa] relative overflow-hidden select-none">
      
      <div 
        className="absolute origin-center transition-transform duration-500 ease-out"
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          // 核心：平移 -> 缩放 -> 轴测旋转
          transform: `
            translate3d(${viewState.x}px, ${viewState.y}px, 0) 
            scale(${viewState.scale}) 
            rotateX(60deg) rotateZ(45deg)
          `,
        }}
      >
        {/* Canvas 地面 */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0" />

        {/* 建筑层 (反向旋转以直立) */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-10 flex flex-col items-center justify-center pointer-events-none"
                    style={{ 
                        left: pos.x, 
                        top: pos.y,
                        // Counter-Rotate: 抵消父容器的旋转，让物体“站”起来
                        transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg)',
                        transformOrigin: 'bottom center' // 锚点在底部
                    }}
                >
                    {/* 建筑阴影 (平贴在地上) */}
                    <div className="absolute top-[80%] left-1/2 -translate-x-1/2 w-10 h-4 bg-black/20 rounded-full blur-[2px] z-[-1]" 
                         style={{ transform: 'rotateX(60deg) rotateZ(45deg)' }}></div> {/* 阴影不需要反向旋转，而是贴地 */}
                    
                    {BUILDINGS[b.type] || <Construction className="text-stone-600" size={32} />}
                    
                    <div className="mt-4 px-1.5 py-0.5 bg-white/90 backdrop-blur rounded text-[8px] font-bold text-stone-700 shadow-sm whitespace-nowrap border border-stone-200">
                        {b.name}
                    </div>
                </div>
            );
        })}

        {/* 角色层 (反向旋转以直立) */}
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
                    style={{ 
                        left: basePos.x + offsetX, 
                        top: basePos.y + offsetY,
                        // Counter-Rotate
                        transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg)',
                        transformOrigin: 'bottom center'
                    }}
                >
                    <div className="relative flex flex-col items-center group cursor-pointer hover:scale-125 transition-transform hover:z-50">
                        {isTalking && (
                            <div className="absolute bottom-full mb-2 bg-white border border-stone-300 px-2 py-1 rounded-xl text-[10px] shadow-md whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 text-stone-800 font-bold">
                                💬 ...
                            </div>
                        )}
                        
                        {/* 角色立绘 */}
                        <div className={`
                            w-6 h-9 rounded-full rounded-b-md border-2 border-white shadow-sm flex items-center justify-center
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'}
                        `}>
                            <span className="text-[10px] text-white font-black">{agent.job[0]}</span>
                        </div>

                        {/* 脚底阴影 (需要特殊处理才能贴地) */}
                        {/* 实际上在反向旋转的容器里很难做贴地阴影，这里用一个简单的底部圆片代替 */}
                        <div className="absolute -bottom-1 w-5 h-1.5 bg-black/40 rounded-full blur-[1px]"></div>

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