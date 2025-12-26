'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Mountain, Construction, Anchor, Flower2, Zap } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 40; 
const GRID_COLS = 60; 
const GRID_ROWS = 40; 

// --- 2. 视觉样式 (高仿像素游戏材质) ---
const TERRAIN_STYLES: any = {
  '深海': { 
    bg: '#3b82f6', 
    // CSS模拟像素水波
    pattern: 'radial-gradient(circle, rgba(255,255,255,0.2) 2px, transparent 2.5px)', 
    size: '20px 20px',
    decor: 'wave', decorColor: 'text-blue-100' 
  },
  '浅滩': { 
    bg: '#93c5fd', 
    pattern: 'radial-gradient(circle, rgba(255,255,255,0.4) 2px, transparent 3px)', 
    size: '10px 10px',
    decor: 'wave', decorColor: 'text-white' 
  },
  '沙滩': { 
    bg: '#fde047', 
    pattern: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 2px, transparent 0, transparent 10px)', 
    size: '20px 20px',
    decor: 'none', decorColor: '' 
  },
  '椰林': { 
    bg: '#86efac', 
    pattern: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)', 
    size: '10px 10px',
    decor: 'tree', decorColor: 'text-green-700' 
  },
  '草地': { 
    bg: '#4ade80', // 鲜亮的草绿
    // 模拟草地噪点
    pattern: 'linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.05)), linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.05))', 
    size: '20px 20px', 
    decor: 'grass', decorColor: 'text-green-800' 
  },
  '密林': { 
    bg: '#15803d', 
    pattern: 'radial-gradient(circle, rgba(0,0,0,0.2) 4px, transparent 5px)', 
    size: '16px 16px',
    decor: 'tree', decorColor: 'text-green-950' 
  },
  '矿山': { 
    bg: '#a8a29e', 
    pattern: 'conic-gradient(#d6d3d1 90deg, transparent 0 270deg, #d6d3d1 0)', 
    size: '20px 20px',
    decor: 'rock', decorColor: 'text-stone-600' 
  },
  '高塔': { bg: '#e5e5e5', pattern: 'none', size: '0 0', decor: 'none', decorColor: '' },
  '广场': { 
    bg: '#f5f5f4', 
    pattern: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb)', 
    size: '40px 40px',
    decor: 'none', decorColor: '' 
  },
};

const randomSeed = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5); 
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // --- Auto-Fit 逻辑 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parentW = containerRef.current.clientWidth;
      const parentH = containerRef.current.clientHeight;
      
      // 防止除以0错误
      if (parentW === 0 || parentH === 0) return;

      const mapW = GRID_COLS * TILE_SIZE;
      const mapH = GRID_ROWS * TILE_SIZE;

      const scaleX = parentW / mapW;
      const scaleY = parentH / mapH;
      // 填满容器，留一点点边距
      const newScale = Math.min(scaleX, scaleY) * 0.98; 

      setScale(newScale);
      const newX = (parentW - mapW * newScale) / 2;
      const newY = (parentH - mapH * newScale) / 2;
      
      setPosition({ x: newX, y: newY });
    };

    window.addEventListener('resize', handleResize);
    // 延迟执行确保布局已完成
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  
  if (!worldData) return (
    <div className="w-full h-full bg-stone-100 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-stone-300 border-t-green-500 rounded-full animate-spin"></div>
      <div className="text-stone-500 font-bold text-xs">LOADING MAP ASSETS...</div>
    </div>
  );

  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 1. 装饰层 ---
  const decorations = useMemo(() => {
    const items = [];
    const zoneWidth = GRID_COLS / 3;
    const zoneHeight = GRID_ROWS / 3;

    for (let zx = 0; zx < 3; zx++) {
      for (let zy = 0; zy < 3; zy++) {
        const type = mapTypes[zx * 3 + zy];
        let styleKey = '草地';
        if (type.includes('密')) styleKey = '密林';
        else if (type.includes('椰') || type.includes('林')) styleKey = '椰林';
        else if (type.includes('海') || type.includes('沉')) styleKey = '深海';
        else if (type.includes('滩') || type.includes('溪')) styleKey = '浅滩';
        else if (type.includes('沙')) styleKey = '沙滩';
        else if (type.includes('矿')) styleKey = '矿山';
        else if (type.includes('塔')) styleKey = '高塔';
        else if (type.includes('广场')) styleKey = '广场';
        
        const style = TERRAIN_STYLES[styleKey];
        const density = styleKey === '密林' ? 50 : styleKey === '椰林' ? 25 : styleKey === '矿山' ? 15 : 5;
        
        for (let i = 0; i < density; i++) {
          const randX = Math.floor(randomSeed(zx * zy * i + 1) * zoneWidth);
          const randY = Math.floor(randomSeed(zx * zy * i + 2) * zoneHeight);
          const gridX = zx * zoneWidth + randX;
          const gridY = zy * zoneHeight + randY;

          let Icon = null;
          let size = 20 + randomSeed(i)*10;
          let rotate = randomSeed(i*2) * 20 - 10; 

          if (style.decor.includes('tree')) Icon = Trees;
          else if (style.decor === 'rock') Icon = Mountain;
          else if (style.decor === 'wave') Icon = Waves;
          else if (style.decor === 'grass' && i % 4 === 0) Icon = Zap; 
          else if (style.decor === 'grass' && i % 5 === 0) Icon = Flower2;
          if (type.includes('沉') && i === 0) Icon = Anchor;

          if (Icon) {
            items.push(
              <div 
                key={`dec-${gridX}-${gridY}`} 
                className={`absolute pointer-events-none flex items-end justify-center ${style.decorColor}`} 
                style={{ 
                  left: gridX * TILE_SIZE, 
                  top: gridY * TILE_SIZE,
                  width: TILE_SIZE, 
                  height: TILE_SIZE,
                  opacity: 0.6,
                  transform: `scale(${0.8 + randomSeed(i)*0.4}) rotate(${rotate}deg)`
                }}
              >
                <Icon size={size} strokeWidth={2.5} className="fill-current" />
              </div>
            );
          }
        }
      }
    }
    return items;
  }, []);

  // --- 2. 建筑 ---
  const renderBuildings = () => {
    return buildings.map((b: any, i: number) => {
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      const centerX = b.x * zoneW + zoneW / 2;
      const centerY = b.y * zoneH + zoneH / 2;

      let Icon = Construction;
      let colorClass = "text-stone-500 fill-stone-200";
      let size = 64;

      if (b.type === 'House') { Icon = Home; colorClass = "text-orange-600 fill-orange-300"; }
      if (b.type === 'Warehouse') { Icon = Warehouse; colorClass = "text-indigo-700 fill-indigo-300"; size=72; }
      if (b.type === 'Clinic') { Icon = Ambulance; colorClass = "text-rose-600 fill-rose-300"; }
      if (b.type === 'Kitchen') { Icon = Utensils; colorClass = "text-amber-600 fill-amber-300"; }
      if (b.type === 'Tower') { Icon = Castle; colorClass = "text-stone-700 fill-stone-300"; size=80; }

      return (
        <div 
          key={`b-${i}`} 
          className="absolute flex flex-col items-center justify-center z-10 hover:scale-110 transition-transform duration-300 cursor-pointer group"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)' }}
        >
          {/* 建筑阴影 */}
          <div className="absolute top-full w-2/3 h-3 bg-black/20 rounded-full blur-sm -mt-2"></div>
          
          <Icon className={`${colorClass} drop-shadow-xl`} size={size} strokeWidth={1.5} />
          
          <div className="absolute top-full mt-1 px-2 py-1 bg-white border border-stone-200 shadow-md rounded text-[10px] font-bold text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            {b.name}
          </div>
        </div>
      );
    });
  };

  // --- 3. 角色 ---
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
      const shortText = cleanText.length > 8 ? cleanText.substring(0, 8) + '..' : cleanText;

      return (
        <div
          key={agent.id}
          className="absolute flex flex-col items-center z-20 transition-all duration-[2000ms] ease-in-out"
          style={{ left: finalX, top: finalY, transform: 'translate(-50%, -50%)' }}
        >
          {shortText && (
            <div className={`
              absolute bottom-full mb-1 whitespace-nowrap px-2 py-1 rounded text-[10px] font-bold shadow-md border
              ${isTalk ? 'bg-white text-stone-900 border-stone-200' : 'bg-stone-800 text-white border-stone-600'}
              max-w-[120px] overflow-hidden text-ellipsis z-30
            `}>
              {shortText}
            </div>
          )}

          <div className="relative group cursor-pointer hover:z-50 hover:scale-125 transition-transform duration-200">
            <div className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-black shrink-0 ${agent.job.includes('建筑') ? 'bg-amber-400' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'} text-white`}>
              {agent.job[0]}
            </div>
            
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-5 h-1.5 bg-black/30 rounded-full blur-[1px] mt-0.5"></div>

            <div className="absolute top-full left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[10px] px-2 py-1 rounded mt-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-stone-600">
              <div className="font-bold text-amber-400 mb-0.5">{agent.name}</div>
              <div className="text-stone-300">{cleanText || "..."}</div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-stone-200 relative overflow-hidden flex items-start justify-start select-none shadow-inner rounded-xl border border-stone-300">
      <div 
        className="relative transition-transform duration-300 ease-out origin-top-left shadow-2xl bg-white border-4 border-white"
        style={{
          width: GRID_COLS * TILE_SIZE,
          height: GRID_ROWS * TILE_SIZE,
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        }}
      >
        {/* 地形层：使用 CSS 生成纹理 */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({length: 9}).map((_, i) => {
             const type = mapTypes[i];
             let styleKey = '草地';
             if (type.includes('密')) styleKey = '密林';
             else if (type.includes('椰') || type.includes('林')) styleKey = '椰林';
             else if (type.includes('海') || type.includes('沉')) styleKey = '深海';
             else if (type.includes('滩') || type.includes('溪')) styleKey = '浅滩';
             else if (type.includes('沙')) styleKey = '沙滩';
             else if (type.includes('矿')) styleKey = '矿山';
             else if (type.includes('塔')) styleKey = '高塔';
             else if (type.includes('广场')) styleKey = '广场';

             const style = TERRAIN_STYLES[styleKey];
             return (
              <div 
                key={i} 
                className="relative"
                style={{ 
                  backgroundColor: style.bg,
                  backgroundImage: style.pattern,
                  backgroundSize: style.size
                }} 
              >
                {/* 边界线，模拟区块感 */}
                <div className="absolute inset-0 border border-black/5 opacity-30"></div>
              </div>
             );
          })}
        </div>

        {/* 装饰层 */}
        {decorations}
        {/* 建筑层 */}
        {renderBuildings()}
        {/* 角色层 */}
        {renderAgents()}
      </div>
    </div>
  );
}