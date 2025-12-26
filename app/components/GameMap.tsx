'use client';
import React, { useMemo, useState } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Anchor, Mountain, Tent, Construction, ZoomIn, ZoomOut } from 'lucide-react';

// --- 视觉配置 ---
const TILE_SIZE = 40; // 每个小格子 40px
const GRID_COLS = 60; // 横向 60 个格子 = 2400px 宽
const GRID_ROWS = 40; // 纵向 40 个格子 = 1600px 高

// 区域颜色映射 (逻辑坐标 3x3 -> 视觉样式)
const ZONE_STYLES: any = {
  '深海': { bg: '#3b82f6', decor: 'wave' }, // 蓝色
  '浅滩': { bg: '#93c5fd', decor: 'wave' }, // 浅蓝
  '沙滩': { bg: '#fde047', decor: 'none' }, // 黄色
  '椰林': { bg: '#86efac', decor: 'tree' }, // 浅绿
  '草地': { bg: '#4ade80', decor: 'grass' }, // 鲜绿
  '密林': { bg: '#166534', decor: 'tree_dense' }, // 深绿
  '矿山': { bg: '#78716c', decor: 'rock' }, // 灰色
  '高塔': { bg: '#d6d3d1', decor: 'none' }, // 浅灰
  '广场': { bg: '#f5f5f4', decor: 'pave' }, // 铺路
};

// 建筑图标
const BUILDINGS: any = {
  'House': <Home className="text-orange-600 drop-shadow-md" size={48} />,
  'Warehouse': <Warehouse className="text-indigo-600 drop-shadow-md" size={56} />,
  'Clinic': <Ambulance className="text-red-600 drop-shadow-md" size={48} />,
  'Kitchen': <Utensils className="text-amber-700 drop-shadow-md" size={48} />,
  'Tower': <Castle className="text-stone-700 drop-shadow-xl" size={80} />,
};

// 伪随机函数 (保证同一个位置每次渲染生成的树都在同一个地方)
const randomSeed = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const [scale, setScale] = useState(0.8); // 默认缩放 0.8 以便看全貌
  
  if (!worldData) return <div className="w-full h-full bg-stone-900 flex items-center justify-center text-white font-mono">NO SATELLITE LINK</div>;
  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 1. 生成地貌装饰物 (树/石/草) ---
  // 这部分只计算一次，性能极高
  const decorations = useMemo(() => {
    const items = [];
    const zoneWidth = GRID_COLS / 3;
    const zoneHeight = GRID_ROWS / 3;

    // 遍历 3x3 个大区域
    for (let zx = 0; zx < 3; zx++) {
      for (let zy = 0; zy < 3; zy++) {
        const type = mapTypes[zx * 3 + zy];
        const style = ZONE_STYLES[type.includes('林') ? '密林' : type.includes('海') ? '深海' : type.includes('滩') ? '浅滩' : type.includes('矿') ? '矿山' : type.includes('塔') ? '高塔' : '草地'];
        
        // 在每个区域内随机生成装饰
        // 密度：每 100个格子生成多少装饰
        const density = type.includes('密林') ? 40 : type.includes('林') ? 15 : type.includes('矿') ? 10 : 2;
        
        for (let i = 0; i < density; i++) {
          // 伪随机位置
          const randX = Math.floor(randomSeed(zx * zy * i + 1) * zoneWidth);
          const randY = Math.floor(randomSeed(zx * zy * i + 2) * zoneHeight);
          
          // 绝对网格坐标
          const gridX = zx * zoneWidth + randX;
          const gridY = zy * zoneHeight + randY;

          let Icon = null;
          if (style.decor === 'tree' || style.decor === 'tree_dense') Icon = <Trees size={32} className="text-green-900/40" />;
          if (style.decor === 'rock') Icon = <Mountain size={28} className="text-stone-800/40" />;
          if (style.decor === 'wave') Icon = <Waves size={24} className="text-blue-800/20" />;

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
  }, []); // 空依赖，只生成一次

  // --- 2. 渲染建筑 (位于区域中心) ---
  const renderBuildings = () => {
    return buildings.map((b: any, i: number) => {
      // 3x3 区域的像素中心
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      const centerX = b.x * zoneW + zoneW / 2;
      const centerY = b.y * zoneH + zoneH / 2;

      return (
        <div 
          key={`b-${i}`} 
          className="absolute flex flex-col items-center justify-center z-10 hover:scale-110 transition-transform duration-300"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)' }}
        >
          {BUILDINGS[b.type] || <Construction className="text-gray-500" size={40} />}
          <div className="bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold border border-black/10 mt-1 shadow-sm whitespace-nowrap">
            {b.name} {b.status === 'blueprint' && '(施工中)'}
          </div>
        </div>
      );
    });
  };

  // --- 3. 渲染角色 (分散算法) ---
  const renderAgents = () => {
    return agents.map((agent: any) => {
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      
      // 基础偏移：基于区域左上角
      const baseX = agent.x * zoneW;
      const baseY = agent.y * zoneH;

      // 散布算法：利用 Agent ID 生成固定的随机偏移量
      // 让每个角色在自己的区域内有固定的位置，不会重叠，也不会乱跑
      // 偏移范围：区域宽度的 20% ~ 80%，避免贴边
      const spreadX = (randomSeed(agent.id * 111) * 0.6 + 0.2) * zoneW;
      const spreadY = (randomSeed(agent.id * 222) * 0.6 + 0.2) * zoneH;

      const finalX = baseX + spreadX;
      const finalY = baseY + spreadY;

      const hasSpeech = agent.actionLog && agent.actionLog.includes('“');
      const cleanText = agent.actionLog?.replace(/[“|”]/g, '') || '';

      return (
        <div
          key={agent.id}
          className="absolute flex flex-col items-center z-20 transition-all duration-1000 ease-in-out"
          style={{ left: finalX, top: finalY, transform: 'translate(-50%, -50%)' }}
        >
          {/* 对话气泡 (如果有话) */}
          {cleanText && (
            <div className={`absolute bottom-full mb-2 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs shadow-lg border animate-in fade-in zoom-in duration-300 z-30 ${hasSpeech ? 'bg-white text-black border-blue-400' : 'bg-black/70 text-white border-transparent'}`}>
              {cleanText}
            </div>
          )}

          {/* 角色本体 */}
          <div className="relative group">
            {/* 头像 */}
            <div className={`w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold shrink-0 ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-600' : 'bg-green-600'} text-white`}>
              {agent.job[0]}
            </div>
            {/* 名字标签 */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 bg-black/50 text-white text-[9px] px-1 rounded mt-0.5 whitespace-nowrap">
              {agent.name}
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="w-full h-full bg-[#1a1a1a] relative overflow-hidden flex flex-col">
      {/* 顶部工具栏 */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="bg-white/90 p-2 rounded shadow hover:bg-white"><ZoomIn size={20}/></button>
        <button onClick={() => setScale(s => Math.max(s - 0.1, 0.4))} className="bg-white/90 p-2 rounded shadow hover:bg-white"><ZoomOut size={20}/></button>
      </div>

      {/* 滚动容器 */}
      <div className="flex-1 overflow-auto cursor-grab active:cursor-grabbing p-10 bg-stone-800/50 flex items-center justify-center">
        
        {/* --- 游戏地图画布 --- */}
        <div 
          className="relative shadow-2xl bg-stone-200 transition-transform duration-200 origin-center"
          style={{
            width: GRID_COLS * TILE_SIZE,
            height: GRID_ROWS * TILE_SIZE,
            transform: `scale(${scale})`,
            // 核心魔法：使用 CSS 渐变绘制网格线，性能比渲染数千个 div 快100倍
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
            `,
            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`
          }}
        >
          {/* 0. 地形底色层 (9个大色块，避免渲染太多div) */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
            {Array.from({length: 9}).map((_, i) => (
              <div key={i} style={{ backgroundColor: ZONE_STYLES[mapTypes[i]]?.bg || '#ddd' }} className="border border-black/5" />
            ))}
          </div>

          {/* 1. 装饰层 (树/石) */}
          {decorations}

          {/* 2. 建筑层 */}
          {renderBuildings()}

          {/* 3. 角色层 */}
          {renderAgents()}

        </div>
      </div>
    </div>
  );
}