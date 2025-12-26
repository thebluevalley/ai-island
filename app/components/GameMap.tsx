'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Mountain, Construction, Anchor, Flower2, Zap, Tent } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 36; // 格子大小
const MAP_SIZE = 40;  // 地图尺寸 40x40 (共1600个格子)

// --- 2. 地形视觉样式 (自然配色) ---
const TERRAIN_CONFIG: any = {
  'DEEP_WATER': { color: '#3b82f6', height: 0, shadow: '#1d4ed8', icon: null },
  'WATER':      { color: '#60a5fa', height: 0, shadow: '#2563eb', icon: Waves }, // 浅滩
  'SAND':       { color: '#fde047', height: 1, shadow: '#d97706', icon: null },  // 沙滩
  'GRASS':      { color: '#86efac', height: 1, shadow: '#16a34a', icon: Flower2 }, // 草地
  'FOREST':     { color: '#4ade80', height: 1, shadow: '#15803d', icon: Trees },   // 森林
  'DENSE':      { color: '#22c55e', height: 1, shadow: '#14532d', icon: Trees },   // 密林
  'STONE':      { color: '#a8a29e', height: 2, shadow: '#57534e', icon: Mountain },// 高地/矿山
  'SNOW':       { color: '#f3f4f6', height: 3, shadow: '#d1d5db', icon: null }     // 雪山(极少)
};

// 建筑图标映射
const BUILDINGS: any = {
  'House': <Home className="fill-orange-400 text-orange-800" size={48} strokeWidth={1.5} />,
  'Warehouse': <Warehouse className="fill-indigo-400 text-indigo-900" size={56} strokeWidth={1.5} />,
  'Clinic': <Ambulance className="fill-rose-400 text-rose-900" size={48} strokeWidth={1.5} />,
  'Kitchen': <Utensils className="fill-amber-500 text-amber-900" size={42} strokeWidth={1.5} />,
  'Tower': <Castle className="fill-stone-400 text-stone-800" size={64} strokeWidth={1.5} />,
};

// 简易伪随机噪声函数 (模拟 Perlin Noise)
const noise = (x: number, y: number, seed: number = 1) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return s - Math.floor(s);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ scale: 0.6, x: 0, y: 0 });

  // --- Auto-Fit 逻辑 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if(pW===0) return;

      const mapPixelSize = MAP_SIZE * TILE_SIZE;
      // 计算缩放，稍微留点边距
      const scale = Math.min(pW, pH) / mapPixelSize * 1.5; 
      
      setViewState({
        scale: scale,
        x: (pW - mapPixelSize) / 2,
        y: (pH - mapPixelSize) / 2
      });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!worldData) return <div className="w-full h-full bg-[#3b82f6] flex items-center justify-center text-white/50 font-bold tracking-widest">GENERATING TERRAIN...</div>;

  const { agents, buildings } = worldData;

  // --- 1. 核心：生成自然岛屿地形 ---
  const terrainMap = useMemo(() => {
    const map = [];
    const center = MAP_SIZE / 2;
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 1. 计算到中心的距离 (归一化 0~1)
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx*dx + dy*dy) / (MAP_SIZE / 1.5);

        // 2. 生成叠加噪声 (细节)
        const n1 = noise(x * 0.1, y * 0.1, 123);
        const n2 = noise(x * 0.3, y * 0.3, 456);
        const baseHeight = (n1 + n2 * 0.5) / 1.5;

        // 3. 核心公式：高度 = 噪声 - 距离
        // 距离越远，高度越低，形成岛屿形状
        let elevation = baseHeight - dist;

        // 4. 确定地形类型
        let type = 'DEEP_WATER';
        if (elevation > 0.8) type = 'SNOW';
        else if (elevation > 0.6) type = 'STONE';
        else if (elevation > 0.35) type = 'DENSE';
        else if (elevation > 0.15) type = 'FOREST';
        else if (elevation > 0.05) type = 'GRASS';
        else if (elevation > 0.02) type = 'SAND'; // 海岸线
        else if (elevation > -0.2) type = 'WATER'; // 浅滩

        // 装饰物概率
        const hasDecor = noise(x, y, 789) > 0.6;

        map.push({ x, y, type, elevation, hasDecor });
      }
    }
    // 按照渲染顺序排序 (Z-index hack: 渲染顺序决定遮挡)
    // 轴测图中，x+y 越大的越靠前
    return map.sort((a,b) => (a.x + a.y) - (b.x + b.y));
  }, []);

  // --- 2. 渲染功能函数 ---
  
  // 将逻辑坐标 (0-2) 映射到 真实地图坐标 (0-40)
  // 我们将 3x3 的逻辑区域映射到岛屿的平原区域
  const getRealCoord = (logicX: number, logicY: number) => {
      const center = MAP_SIZE / 2;
      const offset = 8; // 偏移量
      // 0->-1, 1->0, 2->1
      const lx = logicX - 1; 
      const ly = logicY - 1;
      return {
          x: (center + lx * offset) * TILE_SIZE,
          y: (center + ly * offset) * TILE_SIZE
      };
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#3b82f6] relative overflow-hidden flex items-center justify-center select-none shadow-inner">
      
      {/* 舞台容器 */}
      <div 
        className="relative transition-transform duration-500 ease-out"
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
        {/* --- 层级 1: 地形块 --- */}
        {terrainMap.map((tile, i) => {
            const style = TERRAIN_CONFIG[tile.type];
            // 计算厚度投影
            const shadowHeight = style.height * 6; // 6px 厚度
            const boxShadow = style.height > 0 
                ? `-${shadowHeight}px ${shadowHeight}px 0 ${style.shadow}` 
                : 'none';
            
            // 随机装饰物
            let DecorIcon = null;
            if (tile.hasDecor && style.icon) DecorIcon = style.icon;
            
            // 简单的水面动画效果
            const isWater = tile.type.includes('WATER');
            const waterAnim = isWater ? 'animate-pulse' : '';

            return (
                <div
                    key={i}
                    className={`absolute transition-colors duration-500 ${waterAnim}`}
                    style={{
                        left: tile.x * TILE_SIZE,
                        top: tile.y * TILE_SIZE,
                        width: TILE_SIZE + 1, // 消除缝隙
                        height: TILE_SIZE + 1,
                        backgroundColor: style.color,
                        boxShadow: boxShadow,
                        zIndex: Math.floor(tile.elevation * 10), // 高度决定遮挡
                        transform: `translateZ(${style.height * 10}px)`
                    }}
                >
                    {/* 地面装饰 (反向旋转以直立) */}
                    {DecorIcon && (
                        <div className="absolute bottom-0 right-0 origin-bottom transform -translate-x-1/2 -translate-y-1/2 -rotate-45 scale-125 opacity-40 text-black/50 pointer-events-none">
                            <DecorIcon size={20} className="fill-current" />
                        </div>
                    )}
                </div>
            );
        })}

        {/* --- 层级 2: 建筑 --- */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-50 flex flex-col items-center justify-center pointer-events-none"
                    style={{ 
                        left: pos.x, 
                        top: pos.y,
                        transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg) scale(1.5)', 
                        transformOrigin: 'bottom center'
                    }}
                >
                    {/* 建筑底座阴影 */}
                    <div className="absolute bottom-2 w-12 h-4 bg-black/30 rounded-full blur-[3px]"></div>
                    {BUILDINGS[b.type] || <Construction className="text-stone-600" size={40} />}
                    {b.status === 'blueprint' && <div className="absolute -top-4 bg-yellow-400 text-black text-[8px] px-1 rounded font-bold animate-bounce">BUILDING</div>}
                </div>
            );
        })}

        {/* --- 层级 3: 角色 --- */}
        {agents.map((agent: any) => {
            const basePos = getRealCoord(agent.x, agent.y);
            // 加上一点随机游走偏移
            const seed = agent.id * 99;
            const offsetX = (noise(seed, 0) - 0.5) * TILE_SIZE * 3;
            const offsetY = (noise(0, seed) - 0.5) * TILE_SIZE * 3;

            const isTalking = agent.actionLog && agent.actionLog.includes('“');
            
            return (
                <div
                    key={agent.id}
                    className="absolute z-[60] transition-all duration-[3000ms] ease-in-out"
                    style={{ 
                        left: basePos.x + offsetX, 
                        top: basePos.y + offsetY,
                        transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg)',
                        transformOrigin: 'bottom center'
                    }}
                >
                    <div className="relative flex flex-col items-center group cursor-pointer hover:scale-125 transition-transform hover:z-[100]">
                        {/* 气泡 */}
                        {isTalking && (
                            <div className="absolute -top-8 bg-white border border-stone-200 px-2 py-1 rounded-xl text-[8px] font-bold shadow-lg whitespace-nowrap animate-in fade-in zoom-in">
                                💬 ...
                            </div>
                        )}

                        {/* 小人 */}
                        <div className={`
                            w-5 h-8 rounded-full border-b-4 border-black/20 flex items-center justify-center text-[10px] font-black text-white shadow-sm
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'}
                        `}>
                            {agent.job[0]}
                        </div>
                        
                        {/* 影子 */}
                        <div className="absolute -bottom-1 w-4 h-1.5 bg-black/40 rounded-full blur-[1px]"></div>
                        
                        {/* 名字标签 */}
                        <div className="absolute top-full mt-1 bg-black/50 text-white text-[8px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
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