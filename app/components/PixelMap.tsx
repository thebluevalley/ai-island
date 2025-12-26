'use client';
import React, { useMemo } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Construction, Trees, Waves, Anchor, Mountain, MapPin } from 'lucide-react';

// --- 配置区域 ---

// 地形像素颜色 (Tailwind class)
const PIXEL_COLORS: any = {
  '深海': 'bg-blue-600',
  '浅滩': 'bg-blue-300',
  '沙滩': 'bg-yellow-200',
  '草地': 'bg-green-400',
  '森林': 'bg-green-700',
  '山地': 'bg-stone-500',
  '高塔基座': 'bg-amber-300',
};

// 建筑图标
const BUILDING_ICONS: any = {
  'House': <Home className="text-orange-500 drop-shadow-sm" size={28} />,
  'Warehouse': <Warehouse className="text-indigo-500 drop-shadow-sm" size={28} />,
  'Clinic': <Ambulance className="text-red-500 drop-shadow-sm" size={28} />,
  'Kitchen': <Utensils className="text-amber-600 drop-shadow-sm" size={28} />,
  'Tower': <Castle className="text-stone-600 drop-shadow-sm" size={32} />,
};

// 地形装饰图标 (可选)
const TERRAIN_DECOR: any = {
  '椰林': <Trees className="text-green-800 opacity-30" size={20} />,
  '密林': <Trees className="text-green-900 opacity-40" size={20} />,
  '沉船': <Anchor className="text-indigo-800 opacity-30" size={20} />,
  '矿山': <Mountain className="text-stone-700 opacity-30" size={20} />,
};

// 小头像组件
const MiniAvatar = ({ job }: { job: string }) => {
  const color = job.includes('建筑') ? 'bg-amber-500' : 
                job.includes('医') ? 'bg-rose-500' :
                job.includes('领袖') ? 'bg-blue-600' : 'bg-stone-500';
  return (
    <div className={`w-6 h-6 ${color} rounded-full border-2 border-white shadow-md flex items-center justify-center text-[8px] text-white font-bold shrink-0`}>
      {job[0]}
    </div>
  );
};

export default function PixelMap({ worldData }: { worldData: any }) {
  if (!worldData) return <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">NO SIGNAL</div>;
  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // --- 地图配置 ---
  const GRID_WIDTH = 80;  // 网格宽度（像素点数）
  const GRID_HEIGHT = 50; // 网格高度（像素点数）
  const CELL_SIZE = 8;    // 每个像素点的大小 (px)

  // 将 3x3 的逻辑坐标映射到高精度像素坐标
  // 返回一个区域的中心点
  const getPixelCoord = (logicX: number, logicY: number) => {
    const sectionWidth = GRID_WIDTH / 3;
    const sectionHeight = GRID_HEIGHT / 3;
    const pixelX = (logicY * sectionWidth) + (sectionWidth / 2);
    const pixelY = (logicX * sectionHeight) + (sectionHeight / 2);
    return { x: pixelX, y: pixelY };
  };

  // --- 1. 渲染底层高精度像素网格 ---
  // 使用 useMemo 缓存像素数据，避免不必要的重计算
  const pixelGrid = useMemo(() => {
    const pixels = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        // 简化的地形生成逻辑：基于坐标决定颜色
        let terrainType = '深海';
        if (x > 5 && x < GRID_WIDTH - 5 && y > 5 && y < GRID_HEIGHT - 5) terrainType = '浅滩';
        if (x > 10 && x < GRID_WIDTH - 10 && y > 10 && y < GRID_HEIGHT - 10) terrainType = '沙滩';
        if (x > 15 && x < GRID_WIDTH - 15 && y > 15 && y < GRID_HEIGHT - 15) terrainType = '草地';
        
        // 模拟一些随机的森林和山地
        const noise = Math.sin(x / 5) + Math.cos(y / 5);
        if (terrainType === '草地' && noise > 0.5) terrainType = '森林';
        if (terrainType === '草地' && noise < -0.8) terrainType = '山地';

        pixels.push(
          <div 
            key={`${x}-${y}`} 
            className={`w-full h-full ${PIXEL_COLORS[terrainType]}`} 
            style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
          />
        );
      }
    }
    return pixels;
  }, []);

  // --- 2. 渲染中层建筑图标 ---
  const renderBuildings = () => {
    return buildings.map((b: any, i: number) => {
      const { x, y } = getPixelCoord(b.x, b.y);
      const logicType = mapTypes[b.x * 3 + b.y];
      const decorIcon = TERRAIN_DECOR[logicType];

      return (
        <div 
          key={i} 
          className="absolute flex flex-col items-center justify-center z-10 transition-transform hover:scale-110 duration-300"
          style={{
            left: `${x * CELL_SIZE}px`,
            top: `${y * CELL_SIZE}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* 地形装饰 */}
          {decorIcon && <div className="absolute -z-10 scale-150">{decorIcon}</div>}
          {/* 建筑图标 */}
          {BUILDING_ICONS[b.type] || <Construction className="text-gray-500 drop-shadow-sm" size={24} />}
          <span className="text-[8px] font-bold text-gray-700 bg-white/70 px-1.5 py-0.5 rounded-full mt-1 backdrop-blur-sm border border-white/50 shadow-sm whitespace-nowrap">
            {b.name}{b.status === 'blueprint' && ' (施工)'}
          </span>
        </div>
      );
    });
  };

  // --- 3. 渲染顶层动态角色 ---
  const renderAgents = () => {
    return agents.map((agent: any) => {
      // 获取像素中心点
      const { x: baseX, y: baseY } = getPixelCoord(agent.x, agent.y);
      
      // 增加随机偏移，防止重叠
      const offsetX = ((agent.id * 37) % 30 - 15) * (CELL_SIZE / 4); 
      const offsetY = ((agent.id * 19) % 30 - 15) * (CELL_SIZE / 4);
      
      const finalX = (baseX * CELL_SIZE) + offsetX;
      const finalY = (baseY * CELL_SIZE) + offsetY;

      const hasSpeech = agent.actionLog && agent.actionLog.includes('“');
      const cleanText = agent.actionLog?.replace(/[“|”]/g, '') || '...';
      
      const bubbleStyle = hasSpeech 
        ? "bg-white text-gray-800 border-blue-200 shadow-md"
        : "bg-gray-800/90 text-gray-200 border-gray-700 shadow-sm";

      return (
        <div
          key={agent.id}
          className="absolute flex flex-col items-center justify-center transition-all duration-1000 ease-in-out z-20 will-change-transform"
          style={{
            left: `${finalX}px`,
            top: `${finalY}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* 对话气泡 */}
          {cleanText && (
            <div className={`absolute bottom-full mb-2 w-32 p-2 rounded-lg text-[9px] border animate-in fade-in slide-in-from-bottom-1 duration-300 ${bubbleStyle} pointer-events-none`}>
              <div className="line-clamp-3 leading-tight text-center font-medium">
                {cleanText}
              </div>
              <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-b border-r ${hasSpeech ? 'bg-white border-blue-200' : 'bg-gray-800/90 border-gray-700'}`}></div>
            </div>
          )}

          {/* 头像 */}
          <div className="relative group cursor-pointer hover:scale-125 hover:z-50 transition-transform duration-200">
             <MiniAvatar job={agent.job} />
             <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/60 backdrop-blur-md text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {agent.name}
             </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="w-full h-full bg-white flex flex-col relative select-none shadow-sm overflow-hidden">
      <div className="h-8 border-b flex items-center px-4 bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-widest justify-between shrink-0">
         <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> LIVE FEED</span>
         <span>PIXEL GRID: {GRID_WIDTH}x{GRID_HEIGHT}</span>
      </div>
      {/* 地图主体容器：允许滚动以适应宽屏 */}
      <div className="flex-1 relative bg-stone-800 overflow-auto flex items-center justify-center p-4">
        <div 
          className="relative shadow-2xl border-4 border-white bg-blue-600 rounded-xl overflow-hidden ring-1 ring-black/20"
          style={{ 
            width: `${GRID_WIDTH * CELL_SIZE}px`, 
            height: `${GRID_HEIGHT * CELL_SIZE}px`,
            // 强制 GPU 加速渲染
            transform: 'translateZ(0)'
          }}
        >
           {/* 1. 底层：像素网格 */}
           <div className="absolute inset-0 flex flex-wrap" style={{ width: `${GRID_WIDTH * CELL_SIZE}px` }}>
              {pixelGrid}
           </div>
           {/* 2. 中层：建筑 */}
           <div className="absolute inset-0 pointer-events-none">
              {renderBuildings()}
           </div>
           {/* 3. 顶层：角色 */}
           <div className="absolute inset-0 pointer-events-none">
              {renderAgents()}
           </div>
        </div>
      </div>
    </div>
  );
}