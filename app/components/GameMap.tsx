'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Mountain, Construction, Anchor, Tent, Flag } from 'lucide-react';

// --- 1. 高精度配置 ---
const TILE_SIZE = 16;  // 格子变小，精度变高
const MAP_SIZE = 80;   // 地图变大 80x80 = 6400个单位

// --- 2. 地形配置 (写实风格配色) ---
const TERRAIN_CONFIG: any = {
  'DEEP_WATER': { color: '#3b82f6', height: 0, z:0, shadow: 'none' },
  'WATER':      { color: '#60a5fa', height: 0, z:0, shadow: 'none' },
  'SAND':       { color: '#fcd34d', height: 1, z:1, shadow: '#d97706' },
  'GRASS':      { color: '#86efac', height: 1, z:1, shadow: '#16a34a' },
  'FOREST':     { color: '#4ade80', height: 1, z:1, shadow: '#15803d' }, // 稍微深一点的绿
  'MOUNTAIN':   { color: '#a8a29e', height: 3, z:2, shadow: '#78716c' }, // 高地
  'SNOW':       { color: '#f3f4f6', height: 5, z:3, shadow: '#d1d5db' }  // 雪顶
};

// 建筑图标
const BUILDINGS: any = {
  'House': <Home className="fill-orange-400 text-orange-900" size={32} strokeWidth={1.5} />,
  'Warehouse': <Warehouse className="fill-indigo-400 text-indigo-900" size={40} strokeWidth={1.5} />,
  'Clinic': <Ambulance className="fill-rose-400 text-rose-900" size={32} strokeWidth={1.5} />,
  'Kitchen': <Utensils className="fill-amber-500 text-amber-900" size={28} strokeWidth={1.5} />,
  'Tower': <Castle className="fill-stone-300 text-stone-800" size={48} strokeWidth={1.5} />,
};

// 平滑噪声函数
const noise = (x: number, y: number, seed: number = 1) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return s - Math.floor(s);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  // --- Auto-Fit 逻辑 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapPixelSize = MAP_SIZE * TILE_SIZE;
      // 这里的 1.8 是缩放系数，为了让高分地图在屏幕上显示得更完整
      const scale = Math.min(pW, pH) / mapPixelSize * 1.8; 
      
      setViewState({
        scale: scale,
        x: (pW - mapPixelSize) / 2,
        y: (pH - mapPixelSize) / 2
      });
    };
    window.addEventListener('resize', handleResize);
    // 延时触发以确保容器布局完成
    setTimeout(handleResize, 200);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!worldData) return <div className="w-full h-full bg-[#3b82f6] flex items-center justify-center text-white/50 font-mono text-xs">RENDERING HIGH-RES TERRAIN...</div>;

  const { agents, buildings } = worldData;

  // --- 1. 生成高精度岛屿地形 ---
  const terrainMap = useMemo(() => {
    const map = [];
    const center = MAP_SIZE / 2;
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 距离场：形成圆形岛屿基础
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx*dx + dy*dy) / (MAP_SIZE / 2.2);

        // 叠加多层噪声，使边缘更自然但不过于破碎
        const n1 = noise(x * 0.05, y * 0.05, 123); // 低频大尺度
        const n2 = noise(x * 0.2, y * 0.2, 456);   // 高频细节
        
        // 地形高度计算
        const baseHeight = (n1 * 0.8 + n2 * 0.2);
        let elevation = baseHeight - dist; // 核心：高度 - 距离

        // 类型判定 (阈值调整以生成大片平地)
        let type = 'DEEP_WATER';
        if (elevation > 0.6) type = 'SNOW';
        else if (elevation > 0.45) type = 'MOUNTAIN';
        else if (elevation > 0.15) type = 'FOREST'; // 森林成片
        else if (elevation > 0.05) type = 'GRASS';  // 广阔平原
        else if (elevation > 0.02) type = 'SAND';   // 海岸线
        else if (elevation > -0.1) type = 'WATER';  // 浅水区

        // 装饰物逻辑 (只在特定区域生成，避免杂乱)
        let hasDecor = false;
        let decorType = null;
        
        const decorNoise = noise(x, y, 789);
        if (type === 'FOREST' && decorNoise > 0.4) { hasDecor = true; decorType = 'tree'; }
        if (type === 'MOUNTAIN' && decorNoise > 0.7) { hasDecor = true; decorType = 'rock'; }
        if (type === 'GRASS' && decorNoise > 0.96) { hasDecor = true; decorType = 'grass'; }

        map.push({ x, y, type, elevation, hasDecor, decorType });
      }
    }
    // Z-Sort: 渲染顺序极其重要，防止遮挡错误
    return map.sort((a,b) => (a.x + a.y) - (b.x + b.y));
  }, []);

  // 坐标转换工具
  const getRealCoord = (logicX: number, logicY: number) => {
      // 将逻辑坐标(0-2) 映射到地图中心的一片平原区域
      // 范围扩大，因为地图分辨率变高了
      const center = MAP_SIZE / 2;
      const scaleFactor = 10; // 间距拉大
      return {
          x: (center + (logicX - 1) * scaleFactor) * TILE_SIZE,
          y: (center + (logicY - 1) * scaleFactor) * TILE_SIZE
      };
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#3b82f6] relative overflow-hidden flex items-center justify-center select-none shadow-inner">
      
      <div 
        className="relative transition-transform duration-300 ease-out will-change-transform"
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          transform: `
            translate(${viewState.x}px, ${viewState.y}px) 
            scale(${viewState.scale}) 
            rotateX(60deg) rotateZ(45deg)
          `,
          transformOrigin: 'center center'
        }}
      >
        {/* --- 地形渲染 (静态高精度) --- */}
        {terrainMap.map((tile, i) => {
            const style = TERRAIN_CONFIG[tile.type];
            // 仅仅对陆地计算厚度，减少渲染压力
            const isLand = style.height > 0;
            const shadowHeight = style.height * 4; 
            const boxShadow = isLand 
                ? `-${shadowHeight}px ${shadowHeight}px 0 ${style.shadow}` 
                : 'none';
            
            // 仅渲染视野内的 tile (简单裁剪逻辑可以后续加，现在直接全渲染)
            return (
                <div
                    key={i}
                    className="absolute"
                    style={{
                        left: tile.x * TILE_SIZE,
                        top: tile.y * TILE_SIZE,
                        width: TILE_SIZE + 0.5, // 稍微重叠消除缝隙
                        height: TILE_SIZE + 0.5,
                        backgroundColor: style.color,
                        boxShadow: boxShadow,
                        zIndex: Math.floor(tile.elevation * 10),
                        // 陆地抬升效果
                        transform: isLand ? `translateZ(${style.height * 2}px)` : 'none' 
                    }}
                >
                    {/* 装饰物 (极简像素点，性能优化) */}
                    {tile.hasDecor && tile.decorType === 'tree' && (
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-800/40 rounded-full transform -translate-x-1 -translate-y-1"></div>
                    )}
                    {tile.hasDecor && tile.decorType === 'rock' && (
                        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-stone-700/50 rounded-full transform -translate-x-1 -translate-y-1"></div>
                    )}
                </div>
            );
        })}

        {/* --- 装饰层 (独立渲染大图标，如森林) --- */}
        {terrainMap.filter(t => t.hasDecor && t.decorType === 'tree' && Math.random() > 0.7).map((t, i) => (
             <div 
                key={`tree-${i}`}
                className="absolute pointer-events-none z-[100]"
                style={{
                    left: t.x * TILE_SIZE,
                    top: t.y * TILE_SIZE,
                    // 反向旋转，立起来
                    transform: 'translate(-50%, -80%) rotateZ(-45deg) rotateX(-60deg) scale(0.8)'
                }}
             >
                <Trees size={18} className="text-green-800 fill-green-600 drop-shadow-sm" strokeWidth={1}/>
             </div>
        ))}
        {terrainMap.filter(t => t.hasDecor && t.decorType === 'rock' && Math.random() > 0.8).map((t, i) => (
             <div 
                key={`rock-${i}`}
                className="absolute pointer-events-none z-[100]"
                style={{
                    left: t.x * TILE_SIZE,
                    top: t.y * TILE_SIZE,
                    transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg) scale(0.6)'
                }}
             >
                <Mountain size={14} className="text-stone-600 fill-stone-400" strokeWidth={1}/>
             </div>
        ))}


        {/* --- 建筑层 --- */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-[200] flex flex-col items-center justify-center pointer-events-none"
                    style={{ 
                        left: pos.x, 
                        top: pos.y,
                        transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg) scale(1.5)', 
                        transformOrigin: 'bottom center'
                    }}
                >
                    {/* 地基 */}
                    <div className="absolute bottom-2 w-10 h-3 bg-black/20 rounded-full blur-[2px]"></div>
                    {BUILDINGS[b.type] || <Construction className="text-stone-600" size={32} />}
                    <div className="absolute top-full text-[6px] bg-black/20 text-white px-1 rounded mt-[-4px]">{b.name}</div>
                </div>
            );
        })}

        {/* --- 角色层 --- */}
        {agents.map((agent: any) => {
            const basePos = getRealCoord(agent.x, agent.y);
            // 随机偏移 (在 TILE_SIZE * 5 的范围内，因为地图分辨率高了)
            const seed = agent.id * 999;
            const offsetX = (noise(seed, 0) - 0.5) * TILE_SIZE * 6; 
            const offsetY = (noise(0, seed) - 0.5) * TILE_SIZE * 6;

            const isTalking = agent.actionLog && agent.actionLog.includes('“');
            
            return (
                <div
                    key={agent.id}
                    className="absolute z-[300] transition-all duration-[2000ms] ease-linear"
                    style={{ 
                        left: basePos.x + offsetX, 
                        top: basePos.y + offsetY,
                        transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg)',
                        transformOrigin: 'bottom center'
                    }}
                >
                    <div className="relative flex flex-col items-center group cursor-pointer hover:scale-125 transition-transform hover:z-[400]">
                        {isTalking && (
                            <div className="absolute -top-6 bg-white border border-stone-200 px-1.5 py-0.5 rounded text-[6px] font-bold shadow-sm whitespace-nowrap animate-pulse text-black">
                                ...
                            </div>
                        )}
                        
                        <div className={`
                            w-3 h-5 rounded-sm border-b-2 border-black/20 flex items-center justify-center text-[6px] font-black text-white shadow-sm
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'}
                        `}>
                        </div>
                        
                        <div className="absolute -bottom-0.5 w-3 h-1 bg-black/40 rounded-full blur-[1px]"></div>
                        
                        <div className="absolute top-full mt-0.5 bg-black/50 text-white text-[6px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
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