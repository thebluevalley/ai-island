'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Mountain, Construction } from 'lucide-react';

// --- 视觉配置 ---
const TILE_SIZE = 40; 
// 保持高精度网格，但我们会自动缩放它以适应屏幕
const GRID_COLS = 60; 
const GRID_ROWS = 40; 

// 区域颜色映射
const ZONE_STYLES: any = {
  '深海': { bg: '#60a5fa', decor: 'wave' },
  '浅滩': { bg: '#bae6fd', decor: 'wave' },
  '沙滩': { bg: '#fef08a', decor: 'none' },
  '椰林': { bg: '#bbf7d0', decor: 'tree' },
  '草地': { bg: '#86efac', decor: 'grass' },
  '密林': { bg: '#22c55e', decor: 'tree_dense' },
  '矿山': { bg: '#a8a29e', decor: 'rock' },
  '高塔': { bg: '#e7e5e4', decor: 'none' },
  '广场': { bg: '#f5f5f4', decor: 'pave' },
};

const BUILDINGS: any = {
  'House': <Home className="text-orange-500 drop-shadow-sm" size={48} />,
  'Warehouse': <Warehouse className="text-indigo-500 drop-shadow-sm" size={56} />,
  'Clinic': <Ambulance className="text-rose-500 drop-shadow-sm" size={48} />,
  'Kitchen': <Utensils className="text-amber-600 drop-shadow-sm" size={48} />,
  'Tower': <Castle className="text-stone-600 drop-shadow-md" size={80} />,
};

const randomSeed = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // --- Auto-Fit 逻辑: 自动计算缩放比例以填满容器 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const parentWidth = containerRef.current.clientWidth;
      const parentHeight = containerRef.current.clientHeight;
      const mapWidth = GRID_COLS * TILE_SIZE;
      const mapHeight = GRID_ROWS * TILE_SIZE;

      // 计算宽和高的缩放比例，取较小值以保证完全显示
      // 乘以 0.95 留一点点边距，看起来不那么局促
      const scaleX = parentWidth / mapWidth;
      const scaleY = parentHeight / mapHeight;
      const newScale = Math.min(scaleX, scaleY) * 0.95; 

      setScale(newScale);

      // 计算居中偏移量
      const newX = (parentWidth - mapWidth * newScale) / 2;
      const newY = (parentHeight - mapHeight * newScale) / 2;
      
      setPosition({ x: newX, y: newY });
    };

    // 初始化和窗口大小改变时触发
    window.addEventListener('resize', handleResize);
    handleResize(); // 立即执行一次

    // 创建一个 ResizeObserver 监听容器本身的大小变化 (更精准)
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  
  if (!worldData) return <div className="w-full h-full bg-stone-50 flex items-center justify-center text-stone-400 font-mono animate-pulse">CONNECTING SATELLITE...</div>;
  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 1. 地貌装饰 ---
  const decorations = useMemo(() => {
    const items = [];
    const zoneWidth = GRID_COLS / 3;
    const zoneHeight = GRID_ROWS / 3;

    for (let zx = 0; zx < 3; zx++) {
      for (let zy = 0; zy < 3; zy++) {
        const type = mapTypes[zx * 3 + zy];
        const style = ZONE_STYLES[type.includes('林') ? '密林' : type.includes('海') ? '深海' : type.includes('滩') ? '浅滩' : type.includes('矿') ? '矿山' : type.includes('塔') ? '高塔' : '草地'];
        const density = type.includes('密林') ? 40 : type.includes('林') ? 15 : type.includes('矿') ? 10 : 2;
        
        for (let i = 0; i < density; i++) {
          const randX = Math.floor(randomSeed(zx * zy * i + 1) * zoneWidth);
          const randY = Math.floor(randomSeed(zx * zy * i + 2) * zoneHeight);
          const gridX = zx * zoneWidth + randX;
          const gridY = zy * zoneHeight + randY;

          let Icon = null;
          if (style.decor === 'tree' || style.decor === 'tree_dense') Icon = <Trees size={32} className="text-green-700/20" />;
          if (style.decor === 'rock') Icon = <Mountain size={28} className="text-stone-600/20" />;
          if (style.decor === 'wave') Icon = <Waves size={24} className="text-blue-600/20" />;

          if (Icon) {
            items.push(
              <div key={`dec-${gridX}-${gridY}`} className="absolute pointer-events-none" style={{ left: gridX * TILE_SIZE, top: gridY * TILE_SIZE }}>
                {Icon}
              </div>
            );
          }
        }
      }
    }
    return items;
  }, []);

  // --- 2. 建筑渲染 ---
  const renderBuildings = () => {
    return buildings.map((b: any, i: number) => {
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      const centerX = b.x * zoneW + zoneW / 2;
      const centerY = b.y * zoneH + zoneH / 2;

      return (
        <div 
          key={`b-${i}`} 
          className="absolute flex flex-col items-center justify-center z-10 hover:scale-110 transition-transform duration-300 group"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)' }}
        >
          {BUILDINGS[b.type] || <Construction className="text-stone-500" size={40} />}
          <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold border border-stone-200 mt-1 shadow-sm whitespace-nowrap text-stone-700">
            {b.name} {b.status === 'blueprint' && '(施工中)'}
          </div>
        </div>
      );
    });
  };

  // --- 3. 角色渲染 ---
  const renderAgents = () => {
    return agents.map((agent: any) => {
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      const baseX = agent.x * zoneW;
      const baseY = agent.y * zoneH;
      const spreadX = (randomSeed(agent.id * 111) * 0.6 + 0.2) * zoneW;
      const spreadY = (randomSeed(agent.id * 222) * 0.6 + 0.2) * zoneH;
      const finalX = baseX + spreadX;
      const finalY = baseY + spreadY;

      const rawText = agent.actionLog || "";
      const isTalk = rawText.includes('“');
      let cleanText = rawText.replace(/[“|”|\[|\]]/g, '').trim();
      if (['Idle', 'Standby', 'Working', 'Resting'].includes(cleanText)) cleanText = '';
      const shortText = cleanText.length > 10 ? cleanText.substring(0, 10) + '..' : cleanText;

      return (
        <div
          key={agent.id}
          className="absolute flex flex-col items-center z-20 transition-all duration-[2000ms] ease-in-out"
          style={{ left: finalX, top: finalY, transform: 'translate(-50%, -50%)' }}
        >
          {shortText && (
            <div className={`
              absolute bottom-full mb-1 whitespace-nowrap px-2 py-1 rounded-lg text-[10px] font-medium shadow-sm border backdrop-blur-sm
              ${isTalk ? 'bg-white/90 text-stone-800 border-blue-200' : 'bg-stone-800/80 text-white border-transparent'}
              max-w-[150px] overflow-hidden text-ellipsis z-30
            `}>
              {shortText}
            </div>
          )}

          <div className="relative group cursor-pointer hover:z-50 hover:scale-125 transition-transform duration-300">
            <div className={`w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold shrink-0 ${agent.job.includes('建筑') ? 'bg-amber-400' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'} text-white`}>
              {agent.job[0]}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] px-2 py-1 rounded mt-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              <div className="font-bold mb-0.5">{agent.name}</div>
              <div className="text-stone-300">{cleanText || "Thinking..."}</div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    // 外层容器：ref 用于计算大小，overflow-hidden 禁止滚动
    <div ref={containerRef} className="w-full h-full bg-stone-100 relative overflow-hidden flex items-start justify-start rounded-2xl shadow-inner select-none">
      
      {/* 这里的 transform-origin: top left 是配合我们计算好的 x,y 偏移量使用的 */}
      <div 
        className="relative shadow-2xl bg-white transition-transform duration-300 ease-out rounded-xl overflow-hidden border-[8px] border-white"
        style={{
          width: GRID_COLS * TILE_SIZE,
          height: GRID_ROWS * TILE_SIZE,
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'top left', // 关键：从左上角开始缩放和偏移
          backgroundImage: `
            linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`
        }}
      >
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
          {Array.from({length: 9}).map((_, i) => (
            <div key={i} style={{ backgroundColor: ZONE_STYLES[mapTypes[i]]?.bg || '#f5f5f4' }} />
          ))}
        </div>

        {decorations}
        {renderBuildings()}
        {renderAgents()}
      </div>
    </div>
  );
}