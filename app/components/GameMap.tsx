'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Mountain, Construction, Tent, Box, Anchor, Flower2, Zap } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 40; 
const GRID_COLS = 60; 
const GRID_ROWS = 40; 

// --- 2. 视觉样式配置 (模拟像素素材风格) ---
// 我们用 CSS 渐变模拟纹理，不需要下载图片
const TERRAIN_PATTERNS: any = {
  '深海': { 
    bg: '#3b82f6', 
    pattern: 'radial-gradient(circle, #60a5fa 2px, transparent 2.5px)', 
    size: '20px 20px',
    decorColor: 'text-blue-300/30' 
  },
  '浅滩': { 
    bg: '#93c5fd', 
    pattern: 'radial-gradient(circle, #bae6fd 2px, transparent 2.5px)', 
    size: '10px 10px',
    decorColor: 'text-blue-200/50' 
  },
  '沙滩': { 
    bg: '#fde047', 
    pattern: 'repeating-linear-gradient(45deg, #fef08a 0, #fef08a 2px, transparent 0, transparent 50%)', 
    size: '10px 10px',
    decorColor: 'text-yellow-600/20' 
  },
  '椰林': { 
    bg: '#86efac', 
    pattern: 'radial-gradient(circle, #4ade80 1px, transparent 1px)', 
    size: '8px 8px',
    decorColor: 'text-green-700/60' 
  },
  '草地': { 
    bg: '#4ade80', 
    pattern: 'linear-gradient(to right, #22c55e 1px, transparent 1px), linear-gradient(to bottom, #22c55e 1px, transparent 1px)', 
    size: '40px 40px', // 网格线
    decorColor: 'text-green-800/40' 
  },
  '密林': { 
    bg: '#166534', 
    pattern: 'radial-gradient(circle, #15803d 3px, transparent 3.5px)', 
    size: '12px 12px',
    decorColor: 'text-green-900/60' 
  },
  '矿山': { 
    bg: '#a8a29e', 
    pattern: 'linear-gradient(45deg, #78716c 25%, transparent 25%, transparent 75%, #78716c 75%, #78716c), linear-gradient(45deg, #78716c 25%, transparent 25%, transparent 75%, #78716c 75%, #78716c)', 
    size: '20px 20px',
    decorColor: 'text-stone-600/50' 
  },
  '高塔': { bg: '#e5e7eb', pattern: 'none', size: '0 0', decorColor: '' },
  '广场': { 
    bg: '#f5f5f4', 
    pattern: 'linear-gradient(45deg, #e7e5e4 25%, transparent 25%, transparent 75%, #e7e5e4 75%, #e7e5e4)', 
    size: '20px 20px', // 棋盘格地板
    decorColor: '' 
  },
};

// 建筑图标 (使用 Lucide 模拟 RPG 贴图)
// fill: 填充色, stroke: 描边色
const BUILDINGS: any = {
  'House': <Home className="fill-orange-400 text-orange-800 drop-shadow-xl" size={64} strokeWidth={1.5} />,
  'Warehouse': <Warehouse className="fill-indigo-400 text-indigo-900 drop-shadow-xl" size={72} strokeWidth={1.5} />,
  'Clinic': <Ambulance className="fill-rose-400 text-rose-900 drop-shadow-xl" size={64} strokeWidth={1.5} />,
  'Kitchen': <Utensils className="fill-amber-500 text-amber-900 drop-shadow-xl" size={56} strokeWidth={1.5} />,
  'Tower': <Castle className="fill-stone-400 text-stone-800 drop-shadow-2xl" size={96} strokeWidth={1.5} />,
};

const randomSeed = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // --- Auto-Fit 逻辑 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parentWidth = containerRef.current.clientWidth;
      const parentHeight = containerRef.current.clientHeight;
      const mapWidth = GRID_COLS * TILE_SIZE;
      const mapHeight = GRID_ROWS * TILE_SIZE;

      const scaleX = parentWidth / mapWidth;
      const scaleY = parentHeight / mapHeight;
      const newScale = Math.min(scaleX, scaleY) * 0.98; // 留一点边距

      setScale(newScale);
      const newX = (parentWidth - mapWidth * newScale) / 2;
      const newY = (parentHeight - mapHeight * newScale) / 2;
      setPosition({ x: newX, y: newY });
    };

    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize(); // 立即执行

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  
  if (!worldData) return <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 font-mono animate-pulse">SATELLITE LINK ESTABLISHING...</div>;
  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 1. 生成高密度地形装饰 (核心视觉升级) ---
  const decorations = useMemo(() => {
    const items = [];
    const zoneWidth = GRID_COLS / 3;
    const zoneHeight = GRID_ROWS / 3;

    for (let zx = 0; zx < 3; zx++) {
      for (let zy = 0; zy < 3; zy++) {
        const type = mapTypes[zx * 3 + zy];
        let styleKey = '草地';
        if (type.includes('林')) styleKey = type.includes('密') ? '密林' : '椰林';
        else if (type.includes('海') || type.includes('沉')) styleKey = '深海';
        else if (type.includes('滩') || type.includes('溪')) styleKey = '浅滩';
        else if (type.includes('矿')) styleKey = '矿山';
        else if (type.includes('塔')) styleKey = '高塔';
        else if (type.includes('广场')) styleKey = '广场';
        
        const style = TERRAIN_PATTERNS[styleKey];
        
        // 密度控制：密林最多，广场最少
        const density = styleKey === '密林' ? 60 : styleKey === '椰林' ? 25 : styleKey === '矿山' ? 15 : 5;
        
        for (let i = 0; i < density; i++) {
          const randX = Math.floor(randomSeed(zx * zy * i + 1) * zoneWidth);
          const randY = Math.floor(randomSeed(zx * zy * i + 2) * zoneHeight);
          const gridX = zx * zoneWidth + randX;
          const gridY = zy * zoneHeight + randY;

          // 随机选择装饰图标
          let Icon = null;
          let iconSize = 24 + randomSeed(i) * 16; // 随机大小
          let opacity = 0.4 + randomSeed(i*2) * 0.4; // 随机透明度

          if (styleKey.includes('林')) Icon = Trees;
          else if (styleKey === '矿山') Icon = Mountain;
          else if (styleKey.includes('海') || styleKey.includes('滩')) Icon = Waves;
          else if (styleKey === '草地' && i % 3 === 0) Icon = Flower2; // 草地偶尔有花
          else if (styleKey === '草地') Icon = Zap; // 用 Zap 模拟小草丛 (抽象)
          else if (type.includes('沉')) Icon = Anchor;

          if (Icon) {
            items.push(
              <div 
                key={`dec-${gridX}-${gridY}`} 
                className={`absolute pointer-events-none flex flex-col items-center justify-end ${style.decorColor}`} 
                style={{ 
                  left: gridX * TILE_SIZE, 
                  top: gridY * TILE_SIZE,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  opacity: opacity,
                  transform: `scale(${0.8 + randomSeed(i)*0.4})` // 随机缩放
                }}
              >
                {/* 使用 fill 属性让图标看起来像实体物体，而不是线条 */}
                <Icon size={iconSize} strokeWidth={2} className="fill-current" />
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
          className="absolute flex flex-col items-center justify-center z-10 transition-transform duration-300 group"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)' }}
        >
          {/* 建筑主体 */}
          <div className="relative hover:scale-110 transition-transform duration-200 cursor-pointer">
             {BUILDINGS[b.type] || <Construction className="fill-gray-400 text-gray-700" size={50} />}
             
             {/* 状态标签 (悬浮显示) */}
             <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
               {b.name} <span className="text-gray-400">{b.status === 'blueprint' ? '(Construction)' : '(Active)'}</span>
             </div>
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
      let cleanText = rawText.replace(/[“|”|\[|\]]/g, '').trim();
      if (['Idle', 'Standby', 'Working', 'Resting'].includes(cleanText)) cleanText = '';
      const shortText = cleanText.length > 8 ? cleanText.substring(0, 8) + '..' : cleanText;
      const isTalk = rawText.includes('“');

      return (
        <div
          key={agent.id}
          className="absolute flex flex-col items-center z-20 transition-all duration-[2000ms] ease-in-out"
          style={{ left: finalX, top: finalY, transform: 'translate(-50%, -50%)' }}
        >
          {shortText && (
            <div className={`
              absolute bottom-full mb-1 whitespace-nowrap px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg border-2
              ${isTalk ? 'bg-white text-black border-stone-800' : 'bg-stone-800 text-white border-stone-600'}
              max-w-[120px] overflow-hidden text-ellipsis z-30
            `}>
              {shortText}
            </div>
          )}

          <div className="relative group cursor-pointer hover:z-50 hover:scale-110 transition-transform duration-200">
            {/* 角色身体 (模拟像素小人) */}
            <div className={`w-10 h-10 rounded-lg border-2 border-stone-900 shadow-[0_4px_0_rgba(0,0,0,0.2)] flex items-center justify-center text-xs font-black shrink-0 ${agent.job.includes('建筑') ? 'bg-amber-400' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'} text-white`}>
              {agent.job[0]}
            </div>
            
            {/* 脚下阴影 */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 rounded-full blur-[2px] mt-[-2px]"></div>

            {/* 悬浮详情 */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] px-2 py-1.5 rounded mt-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-stone-700">
              <div className="font-bold text-amber-400 mb-0.5">{agent.name}</div>
              <div className="text-stone-300">{cleanText || "..."}</div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#1e1e1e] relative overflow-hidden flex items-start justify-start select-none shadow-inner">
      {/* 游戏世界容器 */}
      <div 
        className="relative transition-transform duration-300 ease-out origin-top-left shadow-2xl border-4 border-black"
        style={{
          width: GRID_COLS * TILE_SIZE,
          height: GRID_ROWS * TILE_SIZE,
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        }}
      >
        {/* 0. 背景层 (地形底色 + CSS纹理) */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({length: 9}).map((_, i) => {
             const type = mapTypes[i];
             let styleKey = '草地';
             if (type.includes('林')) styleKey = type.includes('密') ? '密林' : '椰林';
             else if (type.includes('海') || type.includes('沉')) styleKey = '深海';
             else if (type.includes('滩') || type.includes('溪')) styleKey = '浅滩';
             else if (type.includes('矿')) styleKey = '矿山';
             else if (type.includes('塔')) styleKey = '高塔';
             else if (type.includes('广场')) styleKey = '广场';
             else if (type.includes('沙')) styleKey = '沙滩';

             const style = TERRAIN_PATTERNS[styleKey];
             return (
              <div 
                key={i} 
                style={{ 
                  backgroundColor: style.bg,
                  backgroundImage: style.pattern,
                  backgroundSize: style.size
                }} 
                className="relative"
              >
                {/* 区域边界线 (模拟地图区块感) */}
                <div className="absolute inset-0 border border-black/5 opacity-50"></div>
              </div>
             );
          })}
        </div>

        {/* 1. 装饰层 */}
        {decorations}

        {/* 2. 建筑层 */}
        {renderBuildings()}

        {/* 3. 角色层 */}
        {renderAgents()}
        
      </div>
    </div>
  );
}