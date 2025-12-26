'use client';
import React from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Construction } from 'lucide-react';

// --- 配置区域 ---
const TERRAIN_COLORS: any = {
  '椰林': 'bg-emerald-100 border-emerald-200',
  '密林': 'bg-emerald-200 border-emerald-300',
  '浅滩': 'bg-blue-100 border-blue-200',
  '溪流': 'bg-cyan-100 border-cyan-200',
  '礁石': 'bg-slate-200 border-slate-300',
  '沉船': 'bg-indigo-100 border-indigo-200',
  '矿山': 'bg-stone-200 border-stone-300',
  '高塔': 'bg-amber-100 border-amber-200',
  '广场': 'bg-gray-50 border-gray-200',
};

const BUILDING_ICONS: any = {
  'House': <Home className="text-orange-500 drop-shadow-sm" size={32} />,
  'Warehouse': <Warehouse className="text-indigo-500 drop-shadow-sm" size={32} />,
  'Clinic': <Ambulance className="text-red-500 drop-shadow-sm" size={32} />,
  'Kitchen': <Utensils className="text-amber-600 drop-shadow-sm" size={32} />,
  'Tower': <Castle className="text-stone-600 drop-shadow-sm" size={36} />,
};

const MiniAvatar = ({ job }: { job: string }) => {
  const color = job.includes('建筑') ? 'bg-amber-500' : 
                job.includes('医') ? 'bg-rose-500' :
                job.includes('领袖') ? 'bg-blue-600' : 'bg-stone-500';
  return (
    <div className={`w-8 h-8 ${color} rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] text-white font-bold shrink-0`}>
      {job[0]}
    </div>
  );
};

export default function FlatMap({ worldData }: { worldData: any }) {
  if (!worldData) return <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">NO SIGNAL</div>;
  const { agents, buildings } = worldData;
  const mapTypes = ['礁石','浅滩','沉船','椰林','广场','溪流','密林','矿山','高塔'];

  // 1. 渲染底层网格
  const renderGrid = () => {
    return Array.from({ length: 9 }).map((_, i) => {
      const x = Math.floor(i / 3);
      const y = i % 3;
      const type = mapTypes[i];
      const style = TERRAIN_COLORS[type] || 'bg-gray-100 border-gray-200';
      const building = buildings.find((b: any) => b.x === x && b.y === y);

      return (
        <div key={i} className={`relative w-full h-full border ${style} flex items-center justify-center transition-colors duration-500`}>
           <span className="absolute bottom-1 right-2 text-[10px] text-black/10 font-mono font-bold select-none pointer-events-none uppercase tracking-widest">
             {type}
           </span>
           {building && (
             <div className="flex flex-col items-center z-0 scale-100 transition-transform hover:scale-110 duration-300">
               {BUILDING_ICONS[building.type] || <Construction className="text-gray-400" />}
               <span className="text-[9px] font-bold text-gray-600 bg-white/60 px-1.5 py-0.5 rounded-full mt-1 backdrop-blur-sm border border-white/50 shadow-sm">
                 {building.name}
                 {building.status === 'blueprint' && ' (施工中)'}
               </span>
             </div>
           )}
        </div>
      );
    });
  };

  // 2. 渲染顶层动态角色
  const renderAgents = () => {
    return agents.map((agent: any) => {
      // 计算偏移：基于 ID 的伪随机偏移，防止完全重叠，且位置固定不抖动
      const offsetX = (agent.id * 37) % 30 - 15; 
      const offsetY = (agent.id * 19) % 30 - 15;
      
      const top = (agent.x * 33.33) + 16.5;
      const left = (agent.y * 33.33) + 16.5;

      const hasSpeech = agent.actionLog && agent.actionLog.includes('“');
      const cleanText = agent.actionLog?.replace(/[“|”]/g, '') || '...';
      
      // 气泡样式区分：说话(白底) vs 状态(黑底)
      const bubbleStyle = hasSpeech 
        ? "bg-white text-gray-800 border-blue-200 shadow-xl"
        : "bg-gray-800/90 text-gray-200 border-gray-700 shadow-lg";

      return (
        <div
          key={agent.id}
          className="absolute flex flex-col items-center justify-center transition-all duration-1000 ease-in-out z-20 will-change-transform"
          style={{
            top: `${top}%`,
            left: `${left}%`,
            transform: `translate(${offsetX}px, ${offsetY}px)` 
          }}
        >
          {/* 对话气泡 */}
          {cleanText && (
            <div className={`absolute bottom-full mb-3 w-40 p-2.5 rounded-xl text-xs border animate-in fade-in slide-in-from-bottom-2 duration-300 ${bubbleStyle}`}>
              <div className="line-clamp-4 leading-relaxed text-center font-medium">
                {cleanText}
              </div>
              {/* 气泡小三角 */}
              <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-b border-r ${hasSpeech ? 'bg-white border-blue-200' : 'bg-gray-800/90 border-gray-700'}`}></div>
            </div>
          )}

          {/* 头像 */}
          <div className="relative group cursor-pointer hover:scale-110 hover:z-50 transition-transform duration-200">
             <MiniAvatar job={agent.job} />
             <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/60 backdrop-blur-md text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {agent.name}
             </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="w-full h-full bg-white flex flex-col relative select-none shadow-sm">
      <div className="h-10 border-b flex items-center px-4 bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-widest justify-between shrink-0">
         <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> SATELLITE FEED</span>
         <span>GRID: 3x3</span>
      </div>
      <div className="flex-1 relative p-6 flex items-center justify-center bg-stone-100/50 overflow-hidden">
        {/* 地图主体容器 (保持正方形) */}
        <div className="relative w-full max-w-[600px] aspect-square shadow-2xl border-[6px] border-white bg-white rounded-xl overflow-hidden ring-1 ring-black/5">
           <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              {renderGrid()}
           </div>
           <div className="absolute inset-0 pointer-events-none">
              {renderAgents()}
           </div>
        </div>
      </div>
    </div>
  );
}