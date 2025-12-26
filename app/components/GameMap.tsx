'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Mountain, Construction, Anchor, Flower2, Zap } from 'lucide-react';

// --- 1. 核心配置 ---
const TILE_SIZE = 32; // 格子稍微小一点，让画面更精致
const GRID_COLS = 50; 
const GRID_ROWS = 50; 

// --- 2. Townscaper 风格配色 (马卡龙色系) ---
// top: 顶面颜色
// side: 侧面颜色 (用于 box-shadow 模拟厚度)
const THEME: any = {
  '深海': { top: '#60a5fa', side: '#3b82f6', height: 0 },   // 亮蓝
  '浅滩': { top: '#93c5fd', side: '#60a5fa', height: 0 },   // 浅蓝 (无厚度)
  '沙滩': { top: '#fde047', side: '#eab308', height: 1 },   // 柠檬黄 (有厚度)
  '椰林': { top: '#86efac', side: '#4ade80', height: 1 },   // 嫩绿
  '草地': { top: '#a7f3d0', side: '#6ee7b7', height: 1 },   // 薄荷绿
  '密林': { top: '#34d399', side: '#10b981', height: 1 },   // 翠绿
  '矿山': { top: '#d6d3d1', side: '#a8a29e', height: 2 },   // 浅灰 (更高)
  '高塔': { top: '#e5e7eb', side: '#d1d5db', height: 1 },   
  '广场': { top: '#f3f4f6', side: '#e5e7eb', height: 1 },   // 纯白
};

// 伪随机数 (保证地图固定)
const randomSeed = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ scale: 0.5, x: 0, y: 0 });

  // --- Auto-Fit: 完美适配菱形地图 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parentW = containerRef.current.clientWidth;
      const parentH = containerRef.current.clientHeight;
      if (parentW === 0 || parentH === 0) return;

      // 轴测投影后的宽度计算比较特殊
      // 菱形宽度 = GridWidth * TileSize * sqrt(2)
      // 但我们简单粗暴一点，直接缩放到能装下原来的正方形容器即可
      const mapRawSize = GRID_COLS * TILE_SIZE; 
      
      const scale = Math.min(parentW, parentH) / mapRawSize * 1.6; // 1.6 是经验系数，放大一点填满屏幕

      setViewState({
        scale: scale,
        x: (parentW - mapRawSize) / 2, // 居中偏移 X (不缩放时的偏移)
        y: (parentH - mapRawSize) / 4  // 居中偏移 Y (轴测图会被压扁，所以 Y 要往上提一点)
      });
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50); // 延时一帧确保容器已渲染
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!worldData) return (
    <div className="w-full h-full bg-[#a5f3fc] flex items-center justify-center">
      <div className="animate-bounce text-[#0891b2] font-bold tracking-widest text-sm">LOADING ISLAND...</div>
    </div>
  );

  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 1. 渲染地形块 (Blocks) ---
  const blocks = useMemo(() => {
    const items = [];
    const sectionW = GRID_COLS / 3;
    const sectionH = GRID_ROWS / 3;

    // 为了性能，我们不渲染全部 50x50=2500 个格子
    // 而是把同类地形合并，或者只在关键位置渲染“岛屿块”
    // 这里为了视觉效果，我们渲染所有陆地块，忽略深海块（用背景色代替）

    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        // 计算所属区域
        const zx = Math.floor(x / sectionW);
        const zy = Math.floor(y / sectionH);
        const typeIndex = Math.min(8, zx * 3 + zy);
        const type = mapTypes[typeIndex];

        // 映射样式
        let styleKey = '草地';
        if (type.includes('密')) styleKey = '密林';
        else if (type.includes('椰') || type.includes('林')) styleKey = '椰林';
        else if (type.includes('海') || type.includes('沉')) styleKey = '深海';
        else if (type.includes('滩') || type.includes('溪')) styleKey = '浅滩';
        else if (type.includes('沙')) styleKey = '沙滩';
        else if (type.includes('矿')) styleKey = '矿山';
        else if (type.includes('塔')) styleKey = '高塔';
        else if (type.includes('广场')) styleKey = '广场';

        const style = THEME[styleKey];
        
        // 优化：只渲染陆地和浅滩，深海直接透明
        if (styleKey === '深海') continue; 
        
        // 边缘噪点：让地形边缘不那么方正
        const noise = randomSeed(x * y);
        if (noise > 0.8 && styleKey === '浅滩') continue; // 随机镂空浅滩

        // 计算高度投影 (模拟 3D 厚度)
        const shadowY = style.height * 6; // 6px 厚度
        const boxShadow = style.height > 0 
          ? `-${shadowY}px ${shadowY}px 0 ${style.side}` 
          : 'none';

        items.push(
          <div 
            key={`${x}-${y}`}
            className="absolute transition-colors duration-500"
            style={{
              width: TILE_SIZE + 1, // +1 防止缝隙
              height: TILE_SIZE + 1,
              left: x * TILE_SIZE,
              top: y * TILE_SIZE,
              backgroundColor: style.top,
              boxShadow: boxShadow,
              zIndex: style.height // 高地形遮挡低地形
            }}
          >
             {/* 装饰物 (随机生成) */}
             {styleKey.includes('林') && noise > 0.7 && (
                <div className="absolute bottom-0 right-0 transform -translate-x-1/2 -translate-y-1/2 -rotate-45 scale-150 origin-bottom">
                  <Trees size={20} className="text-emerald-700/40 fill-current" />
                </div>
             )}
             {styleKey === '矿山' && noise > 0.8 && (
                <div className="absolute bottom-0 right-0 transform -translate-x-1/2 -translate-y-1/2 -rotate-45 scale-125 origin-bottom">
                  <Mountain size={18} className="text-stone-600/40 fill-current" />
                </div>
             )}
          </div>
        );
      }
    }
    return items;
  }, []);

  // --- 2. 渲染建筑 (立牌) ---
  const renderBuildings = () => {
    return buildings.map((b: any, i: number) => {
      const sectionW = (GRID_COLS * TILE_SIZE) / 3;
      const sectionH = (GRID_ROWS * TILE_SIZE) / 3;
      const left = b.x * sectionW + sectionW / 2;
      const top = b.y * sectionH + sectionH / 2;

      let Icon = Construction;
      let colorClass = "text-stone-500 fill-stone-200";
      let size = 64;

      if (b.type === 'House') { Icon = Home; colorClass = "text-orange-500 fill-orange-200"; }
      if (b.type === 'Warehouse') { Icon = Warehouse; colorClass = "text-indigo-600 fill-indigo-200"; size=72; }
      if (b.type === 'Clinic') { Icon = Ambulance; colorClass = "text-rose-500 fill-rose-200"; }
      if (b.type === 'Kitchen') { Icon = Utensils; colorClass = "text-amber-600 fill-amber-200"; }
      if (b.type === 'Tower') { Icon = Castle; colorClass = "text-stone-600 fill-stone-300"; size=80; }

      return (
        <div 
          key={`b-${i}`} 
          className="absolute z-20 flex flex-col items-center justify-center pointer-events-none"
          style={{ 
            left: left, 
            top: top,
            // 核心：反向旋转图标，让它立在地图上
            transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg) scale(1.5)', 
            transformOrigin: 'bottom center'
          }}
        >
          <Icon className={`${colorClass} drop-shadow-md`} size={size} strokeWidth={1.5} />
          {/* 建筑基座阴影 */}
          <div className="absolute bottom-2 w-10 h-3 bg-black/20 rounded-full blur-[2px]"></div>
        </div>
      );
    });
  };

  // --- 3. 渲染角色 (立牌) ---
  const renderAgents = () => {
    return agents.map((agent: any) => {
      const sectionW = (GRID_COLS * TILE_SIZE) / 3;
      const sectionH = (GRID_ROWS * TILE_SIZE) / 3;
      
      const baseX = agent.x * sectionW;
      const baseY = agent.y * sectionH;
      // 分散偏移
      const spreadX = (randomSeed(agent.id * 111) * 0.6 + 0.2) * sectionW;
      const spreadY = (randomSeed(agent.id * 222) * 0.6 + 0.2) * sectionH;

      const left = baseX + spreadX;
      const top = baseY + spreadY;
      
      const cleanText = agent.actionLog ? agent.actionLog.replace(/[“|”|\[|\]]/g, '').trim() : '';
      const shortText = cleanText.length > 6 ? cleanText.substring(0, 6) + '..' : cleanText;
      const isTalk = agent.actionLog?.includes('“');

      return (
        <div
          key={agent.id}
          className="absolute z-30 transition-all duration-[2000ms] ease-in-out"
          style={{ 
            left: left, 
            top: top,
            // 反向旋转以直立
            transform: 'translate(-50%, -50%) rotateZ(-45deg) rotateX(-60deg)',
            transformOrigin: 'bottom center'
          }}
        >
          {/* 角色整体容器 */}
          <div className="relative flex flex-col items-center group cursor-pointer hover:scale-125 transition-transform hover:z-50">
            
            {/* 气泡 (仅有话时显示) */}
            {shortText && (
               <div className={`
                 mb-1 px-2 py-0.5 rounded-full text-[8px] font-bold shadow-sm whitespace-nowrap
                 ${isTalk ? 'bg-white text-stone-800' : 'bg-black/60 text-white'}
               `}>
                 {shortText}
               </div>
            )}

            {/* 像素小人 (用 Lucide 图标模拟) */}
            <div className={`
              w-6 h-8 rounded-t-full rounded-b-md border-b-4 border-black/20 shadow-sm flex items-center justify-center text-[10px] font-bold text-white
              ${agent.job.includes('建筑') ? 'bg-amber-400' : agent.job.includes('领袖') ? 'bg-blue-400' : 'bg-emerald-400'}
            `}>
               {agent.job[0]}
            </div>

            {/* 脚下阴影 */}
            <div className="absolute -bottom-1 w-5 h-2 bg-black/30 rounded-full blur-[1px]"></div>
          </div>
        </div>
      );
    });
  };

  return (
    // 外层：海洋背景
    <div ref={containerRef} className="w-full h-full bg-[#60a5fa] relative overflow-hidden flex items-center justify-center">
      
      {/* 舞台容器：控制整体缩放和位置 */}
      <div 
        className="relative transition-transform duration-500 ease-out"
        style={{
          width: GRID_COLS * TILE_SIZE,
          height: GRID_ROWS * TILE_SIZE,
          // 核心魔法：1. 移到计算好的位置 2. 缩放 3. 旋转成轴测视角
          transform: `
            translate(${viewState.x}px, ${viewState.y}px) 
            scale(${viewState.scale}) 
            rotateX(60deg) rotateZ(45deg)
          `,
          transformOrigin: 'center center' // 从中心变换，方便居中
        }}
      >
        {/* 0. 阴影层 (整个地图在海面上的投影) */}
        <div className="absolute inset-0 bg-black/10 translate-x-4 translate-y-4 blur-xl rounded-full"></div>

        {/* 1. 地形层 (积木) */}
        {blocks}

        {/* 2. 建筑层 (立牌) */}
        {renderBuildings()}

        {/* 3. 角色层 (立牌) */}
        {renderAgents()}

      </div>
    </div>
  );
}