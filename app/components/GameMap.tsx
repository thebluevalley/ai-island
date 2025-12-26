'use client';
import React, { useMemo, useState } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Waves, Anchor, Mountain, Construction, ZoomIn, ZoomOut, MapPin } from 'lucide-react';

// --- 视觉配置 (浅色系优化) ---
const TILE_SIZE = 40; 
const GRID_COLS = 60; 
const GRID_ROWS = 40; 

// 区域颜色映射 (高亮清新版)
const ZONE_STYLES: any = {
  '深海': { bg: '#60a5fa', decor: 'wave' }, // 亮蓝
  '浅滩': { bg: '#bae6fd', decor: 'wave' }, // 浅蓝
  '沙滩': { bg: '#fef08a', decor: 'none' }, // 柠檬黄
  '椰林': { bg: '#bbf7d0', decor: 'tree' }, // 嫩绿
  '草地': { bg: '#86efac', decor: 'grass' }, // 亮绿
  '密林': { bg: '#22c55e', decor: 'tree_dense' }, // 鲜绿
  '矿山': { bg: '#a8a29e', decor: 'rock' }, // 浅灰
  '高塔': { bg: '#e7e5e4', decor: 'none' }, // 亮灰
  '广场': { bg: '#f5f5f4', decor: 'pave' }, // 纯白
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
  const [scale, setScale] = useState(0.8);
  
  if (!worldData) return <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 font-mono">WAITING FOR SATELLITE...</div>;
  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 1. 地貌装饰 (浅色适配) ---
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
          // 装饰物颜色加深一点，以便在浅色背景显眼
          if (style.decor === 'tree' || style.decor === 'tree_dense') Icon = <Trees size={32} className="text-green-700/30" />;
          if (style.decor === 'rock') Icon = <Mountain size={28} className="text-stone-600/30" />;
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

  // --- 3. 角色渲染 (防重叠 + 简洁气泡) ---
  const renderAgents = () => {
    return agents.map((agent: any) => {
      const zoneW = (GRID_COLS * TILE_SIZE) / 3;
      const zoneH = (GRID_ROWS * TILE_SIZE) / 3;
      const baseX = agent.x * zoneW;
      const baseY = agent.y * zoneH;

      // 增大分散范围 (20%~80%)，防止挤在中心
      const spreadX = (randomSeed(agent.id * 111) * 0.6 + 0.2) * zoneW;
      const spreadY = (randomSeed(agent.id * 222) * 0.6 + 0.2) * zoneH;
      const finalX = baseX + spreadX;
      const finalY = baseY + spreadY;

      // 文本处理：截断
      const rawText = agent.actionLog || "";
      const isTalk = rawText.includes('“');
      let cleanText = rawText.replace(/[“|”|\[|\]]/g, '').trim();
      
      // 过滤无用信息
      if (cleanText === 'Idle' || cleanText === 'Standby' || cleanText === 'Working') cleanText = '';
      
      // 强制截断：最多显示 8 个字
      const shortText = cleanText.length > 8 ? cleanText.substring(0, 8) + '..' : cleanText;

      return (
        <div
          key={agent.id}
          className="absolute flex flex-col items-center z-20 transition-all duration-1000 ease-in-out"
          style={{ left: finalX, top: finalY, transform: 'translate(-50%, -50%)' }}
        >
          {/* 极简气泡：只有在有话时显示，且限制宽度 */}
          {shortText && (
            <div className={`
              absolute bottom-full mb-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium shadow-sm border 
              ${isTalk ? 'bg-white text-stone-800 border-blue-200' : 'bg-stone-800/80 text-white border-transparent'}
              max-w-[120px] overflow-hidden text-ellipsis z-30 opacity-90
            `}>
              {shortText}
            </div>
          )}

          {/* 角色头像 */}
          <div className="relative group cursor-pointer hover:z-50 hover:scale-110 transition-transform">
            <div className={`w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold shrink-0 ${agent.job.includes('建筑') ? 'bg-amber-400' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'} text-white`}>
              {agent.job[0]}
            </div>
            {/* 悬停才显示全名和完整状态 */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[9px] px-2 py-1 rounded mt-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <span className="font-bold">{agent.name}</span>: {cleanText || "..."}
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="w-full h-full bg-stone-50 relative overflow-hidden flex flex-col">
      {/* 缩放按钮 (浅色版) */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="bg-white p-2 rounded-lg shadow-sm border border-stone-200 hover:bg-stone-50 text-stone-600"><ZoomIn size={18}/></button>
        <button onClick={() => setScale(s => Math.max(s - 0.1, 0.4))} className="bg-white p-2 rounded-lg shadow-sm border border-stone-200 hover:bg-stone-50 text-stone-600"><ZoomOut size={18}/></button>
      </div>

      <div className="flex-1 overflow-auto cursor-grab active:cursor-grabbing p-10 bg-stone-100 flex items-center justify-center">
        
        {/* 画布 */}
        <div 
          className="relative shadow-xl bg-white transition-transform duration-200 origin-center rounded-xl overflow-hidden border-4 border-white"
          style={{
            width: GRID_COLS * TILE_SIZE,
            height: GRID_ROWS * TILE_SIZE,
            transform: `scale(${scale})`,
            // 浅色网格线
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`
          }}
        >
          {/* 地形底色 */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
            {Array.from({length: 9}).map((_, i) => (
              <div key={i} style={{ backgroundColor: ZONE_STYLES[mapTypes[i]]?.bg || '#f5f5f4' }} className="border border-black/5" />
            ))}
          </div>

          {decorations}
          {renderBuildings()}
          {renderAgents()}

        </div>
      </div>
    </div>
  );
}