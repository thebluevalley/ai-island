'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Mountain, Construction, Anchor, Flower2, Zap, Tent, Box } from 'lucide-react';

// --- 1. 配置参数 ---
const TILE_SIZE = 40; 
const GRID_COLS = 60; 
const GRID_ROWS = 40; 

// --- 2. 程序化地形纹理 (CSS Procedural Textures) ---
// 核心魔法：用 CSS 渐变画出像素风的纹理，不需要下载图片
const TERRAIN_STYLES: any = {
  '深海': { 
    bg: '#2563eb', // 深蓝
    // CSS 径向渐变模拟水波纹点
    pattern: 'radial-gradient(circle, #3b82f6 2px, transparent 2.5px)', 
    patternSize: '20px 20px',
    decor: 'wave',
    decorColor: 'text-blue-300/20' 
  },
  '浅滩': { 
    bg: '#60a5fa', // 浅蓝
    pattern: 'radial-gradient(circle, #93c5fd 2px, transparent 2.5px)', 
    patternSize: '10px 10px',
    decor: 'wave',
    decorColor: 'text-blue-100/40' 
  },
  '沙滩': { 
    bg: '#fde047', // 沙黄
    // 斜线纹理模拟沙丘
    pattern: 'repeating-linear-gradient(45deg, #fef08a 0, #fef08a 2px, transparent 0, transparent 50%)', 
    patternSize: '8px 8px',
    decor: 'none',
    decorColor: 'text-yellow-700/20' 
  },
  '椰林': { 
    bg: '#86efac', // 嫩绿
    pattern: 'radial-gradient(circle, #4ade80 1.5px, transparent 2px)', 
    patternSize: '12px 12px',
    decor: 'tree_palm',
    decorColor: 'text-green-700/50' 
  },
  '草地': { 
    bg: '#4ade80', // 纯绿
    // 细微的网格纹理
    pattern: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)', 
    patternSize: '20px 20px', 
    decor: 'grass',
    decorColor: 'text-green-800/30' 
  },
  '密林': { 
    bg: '#15803d', // 深绿
    pattern: 'radial-gradient(circle, #166534 4px, transparent 5px)', 
    patternSize: '16px 16px',
    decor: 'tree_pine',
    decorColor: 'text-green-950/40' 
  },
  '矿山': { 
    bg: '#a8a29e', // 石灰
    // 棋盘格模拟岩石质感
    pattern: 'conic-gradient(#78716c 90deg, transparent 0 270deg, #78716c 0)', 
    patternSize: '20px 20px',
    decor: 'rock',
    decorColor: 'text-stone-700/50' 
  },
  '高塔': { bg: '#d6d3d1', pattern: 'none', patternSize: '0 0', decor: 'none' },
  '广场': { 
    bg: '#f5f5f4', // 灰白
    // 瓷砖纹理
    pattern: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb)', 
    patternSize: '20px 20px',
    decor: 'none' 
  },
};

// 伪随机数生成器 (保证地图每次刷新长得一样)
const randomSeed = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5); // 默认给个小缩放，防止计算前黑屏
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // --- Auto-Fit 核心逻辑 (修复黑屏的关键) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parentW = containerRef.current.clientWidth;
      const parentH = containerRef.current.clientHeight;
      
      // 如果父容器还没渲染好，先不计算
      if (parentW === 0 || parentH === 0) return;

      const mapW = GRID_COLS * TILE_SIZE;
      const mapH = GRID_ROWS * TILE_SIZE;

      // 计算缩放比例：让地图完整显示在容器内，留 2% 边距
      const scaleX = parentW / mapW;
      const scaleY = parentH / mapH;
      const newScale = Math.min(scaleX, scaleY) * 0.98; 

      setScale(newScale);
      
      // 居中偏移
      const newX = (parentW - mapW * newScale) / 2;
      const newY = (parentH - mapH * newScale) / 2;
      setPosition({ x: newX, y: newY });
      setReady(true);
    };

    // 监听窗口和容器变化
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    
    // 稍微延迟一下确保 DOM 已挂载
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  
  // 数据加载中显示Loading
  if (!worldData) return (
    <div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-stone-600 border-t-emerald-500 rounded-full animate-spin"></div>
        <div className="font-mono text-xs text-stone-500 tracking-widest uppercase">Initializing Satellite...</div>
      </div>
    </div>
  );

  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 1. 生成高密度环境装饰 (Trees, Rocks, Waves) ---
  const decorations = useMemo(() => {
    const items = [];
    const zoneWidth = GRID_COLS / 3;
    const zoneHeight = GRID_ROWS / 3;

    for (let zx = 0; zx < 3; zx++) {
      for (let zy = 0; zy < 3; zy++) {
        const type = mapTypes[zx * 3 + zy];
        
        // 映射逻辑坐标到视觉风格
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
        
        // 装饰密度：密林最密，广场最稀
        const density = styleKey === '密林' ? 50 : styleKey === '椰林' ? 25 : styleKey === '矿山' ? 15 : 5;
        
        for (let i = 0; i < density; i++) {
          // 伪随机坐标
          const randX = Math.floor(randomSeed(zx * zy * i + 1) * zoneWidth);
          const randY = Math.floor(randomSeed(zx * zy * i + 2) * zoneHeight);
          const gridX = zx * zoneWidth + randX;
          const gridY = zy * zoneHeight + randY;

          // 选择图标
          let Icon = null;
          let size = 20 + randomSeed(i)*10;
          let rotate = randomSeed(i*2) * 20 - 10; // 随机旋转

          if (style.decor.includes('tree')) Icon = Trees;
          else if (style.decor === 'rock') Icon = Mountain;
          else if (style.decor === 'wave') Icon = Waves;
          else if (style.decor === 'grass' && i % 4 === 0) Icon = Zap; // 模拟草丛
          else if (style.decor === 'grass' && i % 5 === 0) Icon = Flower2; // 模拟花朵
          if (type.includes('沉') && i === 0) Icon = Anchor; // 沉船区放个锚

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
                  transform: `scale(${0.8 + randomSeed(i)*0.4}) rotate(${rotate}deg)`
                }}
              >
                {/* fill-current 让图标填充颜色，看起来像实心物体 */}
                <Icon size={size} strokeWidth={2.5} className="fill-current opacity-70" />
              </div>
            );
          }
        }
      }
    }
    return items;
  }, []);

  // --- 2. 建筑图层 ---
  const renderBuildings = () => {
    return buildings.map((b: any, i: number) => {
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      const centerX = b.x * zoneW + zoneW / 2;
      const centerY = b.y * zoneH + zoneH / 2;

      let Icon = Construction;
      let colorClass = "text-stone-500 fill-stone-300";
      let size = 64;

      if (b.type === 'House') { Icon = Home; colorClass = "text-orange-700 fill-orange-400"; }
      if (b.type === 'Warehouse') { Icon = Warehouse; colorClass = "text-indigo-800 fill-indigo-400"; size=72; }
      if (b.type === 'Clinic') { Icon = Ambulance; colorClass = "text-rose-700 fill-rose-400"; }
      if (b.type === 'Kitchen') { Icon = Utensils; colorClass = "text-amber-700 fill-amber-500"; }
      if (b.type === 'Tower') { Icon = Castle; colorClass = "text-stone-800 fill-stone-400"; size=80; }

      return (
        <div 
          key={`b-${i}`} 
          className="absolute flex flex-col items-center justify-center z-10 transition-transform duration-300 hover:scale-110 cursor-pointer group"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)' }}
        >
          {/* 建筑阴影 */}
          <div className="absolute top-full w-full h-4 bg-black/30 rounded-full blur-sm"></div>
          
          <Icon className={`${colorClass} drop-shadow-lg`} size={size} strokeWidth={1.5} />
          
          {/* 标签 */}
          <div className="absolute top-full mt-2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-white/20">
            {b.name}
            {b.status === 'blueprint' && <span className="text-yellow-400 ml-1">(施工中)</span>}
          </div>
        </div>
      );
    });
  };

  // --- 3. 角色图层 ---
  const renderAgents = () => {
    return agents.map((agent: any) => {
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      const baseX = agent.x * zoneW;
      const baseY = agent.y * zoneH;
      // 分散算法，避免重叠
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
          {/* 气泡 */}
          {shortText && (
            <div className={`
              absolute bottom-full mb-1 whitespace-nowrap px-2 py-1 rounded text-[10px] font-bold shadow-md border
              ${isTalk ? 'bg-white text-black border-stone-300' : 'bg-stone-900 text-white border-stone-600'}
              max-w-[120px] overflow-hidden text-ellipsis z-30
            `}>
              {shortText}
            </div>
          )}

          {/* 角色本体 */}
          <div className="relative group cursor-pointer hover:z-50 hover:scale-125 transition-transform duration-200">
            {/* 头像框 */}
            <div className={`w-9 h-9 rounded-md border-2 border-stone-800 shadow-[0_3px_0_rgba(0,0,0,0.3)] flex items-center justify-center text-xs font-black shrink-0 ${agent.job.includes('建筑') ? 'bg-amber-400' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'} text-white`}>
              {agent.job[0]}
            </div>
            
            {/* 影子 */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-6 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>

            {/* 悬浮详情 */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] px-2 py-1 rounded mt-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-stone-600 shadow-xl">
              <div className="font-bold text-amber-400 mb-0.5">{agent.name}</div>
              <div className="text-stone-300 font-mono">{cleanText || "..."}</div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-[#111] relative overflow-hidden flex items-start justify-start select-none shadow-inner"
    >
      {/* 只有在计算好 scale 后才显示地图，避免闪烁或黑屏 */}
      <div 
        className={`relative transition-all duration-300 ease-out origin-top-left shadow-2xl border-4 border-black bg-stone-800 ${ready ? 'opacity-100' : 'opacity-0'}`}
        style={{
          width: GRID_COLS * TILE_SIZE,
          height: GRID_ROWS * TILE_SIZE,
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        }}
      >
        {/* 0. 地形层 (Background Grid) */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({length: 9}).map((_, i) => {
             const type = mapTypes[i];
             // 逻辑类型 -> 样式类型的映射
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
                className="relative border-r border-b border-black/10"
                style={{ 
                  backgroundColor: style.bg,
                  backgroundImage: style.pattern,
                  backgroundSize: style.patternSize
                }} 
              >
                {/* 区域文字标记 (淡淡的) */}
                <div className="absolute bottom-2 right-2 text-black/10 font-black text-4xl uppercase tracking-widest pointer-events-none">
                  {type}
                </div>
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