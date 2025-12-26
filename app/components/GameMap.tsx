'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, Mountain, Construction, MapPin, Tent } from 'lucide-react';

// --- 1. 超高精度配置 ---
const TILE_SIZE = 10;   // 格子尺寸
const MAP_SIZE = 120;   // 120x120 = 14400 格

// --- 2. 写实柔和配色 (低饱和度，减少“花”的感觉) ---
const PALETTE_COLORS: string[] = [
  '#3b82f6', // 0: DEEP_WATER (深蓝)
  '#60a5fa', // 1: WATER (浅蓝)
  '#eab308', // 2: SAND (暗黄，不刺眼)
  '#86efac', // 3: GRASS (浅绿，大面积基底)
  '#4ade80', // 4: FOREST (中绿)
  '#22c55e', // 5: DENSE (深绿)
  '#a8a29e', // 6: MOUNTAIN (灰石)
  '#e5e7eb', // 7: SNOW (灰白)
];

// 建筑图标
const BUILDINGS: any = {
  'House': <Home className="text-orange-800 fill-orange-300" size={24} />,
  'Warehouse': <Warehouse className="text-indigo-900 fill-indigo-300" size={28} />,
  'Clinic': <Ambulance className="text-rose-800 fill-rose-300" size={24} />,
  'Kitchen': <Utensils className="text-amber-800 fill-amber-300" size={20} />,
  'Tower': <Castle className="text-stone-800 fill-stone-300" size={32} />,
};

// 简易噪声函数
const noise = (x: number, y: number, seed: number = 1) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return s - Math.floor(s);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas 引用
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents, buildings } = worldData || { agents: [], buildings: [] };

  // --- 1. 生成地形数据 (核心算法调整) ---
  const terrainMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
    const center = MAP_SIZE / 2;
    
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        // 距离场：形成基础岛屿形状
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx*dx + dy*dy) / (MAP_SIZE / 2.0);

        // **关键改动：极低频噪声**
        // 系数越小，生成的噪点块越大，地形越连续
        const n1 = noise(x * 0.02, y * 0.02, 111); // 主地形
        const n2 = noise(x * 0.05, y * 0.05, 222); // 细节纹理
        
        // 高度计算：噪声 - 距离
        const height = (n1 * 0.7 + n2 * 0.3) - dist;

        // **关键改动：阈值调整 (扩大草地和森林范围)**
        let typeIdx = 0; // DEEP_WATER
        if (height > 0.55) typeIdx = 7; // SNOW (极少)
        else if (height > 0.45) typeIdx = 6; // MOUNTAIN (少)
        else if (height > 0.30) typeIdx = 5; // DENSE (较少)
        else if (height > 0.10) typeIdx = 4; // FOREST (大片森林)
        else if (height > -0.05) typeIdx = 3; // GRASS (大片草地基底)
        else if (height > -0.12) typeIdx = 2; // SAND (窄海岸线)
        else if (height > -0.25) typeIdx = 1; // WATER (浅滩)
        
        map[y * MAP_SIZE + x] = typeIdx;
      }
    }
    return map;
  }, []);

  // --- 2. Canvas 渲染地形 (高性能) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 Canvas 实际分辨率
    canvas.width = MAP_SIZE * TILE_SIZE;
    canvas.height = MAP_SIZE * TILE_SIZE;

    // 批量绘制像素点
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const typeIdx = terrainMap[y * MAP_SIZE + x];
        const colorHex = PALETTE_COLORS[typeIdx];
        
        // 将 Hex 颜色转换为 RGB
        const r = parseInt(colorHex.slice(1, 3), 16);
        const g = parseInt(colorHex.slice(3, 5), 16);
        const b = parseInt(colorHex.slice(5, 7), 16);

        // 填充 TILE_SIZE x TILE_SIZE 的区域
        for (let py = 0; py < TILE_SIZE; py++) {
          for (let px = 0; px < TILE_SIZE; px++) {
            const pixelIndex = ((y * TILE_SIZE + py) * canvas.width + (x * TILE_SIZE + px)) * 4;
            data[pixelIndex] = r;     // R
            data[pixelIndex + 1] = g; // G
            data[pixelIndex + 2] = b; // B
            data[pixelIndex + 3] = 255; // A (不透明)
          }
        }
      }
    }
    // 一次性将图像数据放回 Canvas
    ctx.putImageData(imgData, 0, 0);
  }, [terrainMap]);

  // --- 3. Auto-Fit 逻辑 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapPixelSize = MAP_SIZE * TILE_SIZE;
      // 计算缩放，留出 5% 边距
      const scale = Math.min(pW / mapPixelSize, pH / mapPixelSize) * 0.95; 
      
      setViewState({
        scale: scale,
        x: (pW - mapPixelSize * scale) / 2,
        y: (pH - mapPixelSize * scale) / 2
      });
    };
    window.addEventListener('resize', handleResize);
    // 延时以确保容器已挂载
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换：逻辑坐标 -> 像素坐标
  const getRealCoord = (lx: number, ly: number) => {
      const center = (MAP_SIZE * TILE_SIZE) / 2;
      const spread = (MAP_SIZE * TILE_SIZE) / 4.5; // 稍微收缩一点范围
      return {
          x: center + (lx - 1) * spread,
          y: center + (ly - 1) * spread
      };
  };

  if (!worldData) return <div className="w-full h-full bg-[#f0f9ff] flex items-center justify-center text-blue-300 font-mono text-xs">SATELLITE CONNECTING...</div>;

  return (
    <div ref={containerRef} className="w-full h-full bg-[#e0f2fe] relative overflow-hidden select-none">
      
      {/* 变换容器 */}
      <div 
        className="absolute origin-top-left shadow-2xl bg-white"
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
        }}
      >
        {/* 层级 0: Canvas 地形 (静态背景) */}
        <canvas 
            ref={canvasRef} 
            className="absolute inset-0 z-0 pixelated" // pixelated 确保放大后不模糊
            style={{ width: '100%', height: '100%' }}
        />

        {/* 层级 1: 建筑层 (DOM) */}
        {buildings.map((b: any, i: number) => {
            const pos = getRealCoord(b.x, b.y);
            return (
                <div 
                    key={`b-${i}`} 
                    className="absolute z-10 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: pos.x, top: pos.y }}
                >
                    {BUILDINGS[b.type] || <Construction className="text-stone-600" size={24} />}
                    <div className="mt-0.5 px-1 py-0.5 bg-white/90 backdrop-blur rounded-[4px] text-[7px] font-bold text-stone-600 shadow-sm whitespace-nowrap border border-stone-200">
                        {b.name}
                    </div>
                </div>
            );
        })}

        {/* 层级 2: 角色层 (DOM) */}
        {agents.map((agent: any) => {
            const basePos = getRealCoord(agent.x, agent.y);
            // 随机散布
            const seed = agent.id * 999;
            const offsetX = (noise(seed, 0) - 0.5) * TILE_SIZE * 8; 
            const offsetY = (noise(0, seed) - 0.5) * TILE_SIZE * 8;
            
            const isTalking = agent.actionLog && agent.actionLog.includes('“');

            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[2000ms] ease-linear will-change-transform"
                    style={{ 
                        left: basePos.x + offsetX, 
                        top: basePos.y + offsetY,
                    }}
                >
                    <div className="relative flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 group">
                        {/* 气泡 */}
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border border-stone-200 px-1.5 py-0.5 rounded-lg text-[7px] shadow-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-1">
                                💬
                            </div>
                        )}
                        
                        {/* 头像圆点 */}
                        <div className={`
                            w-3.5 h-3.5 rounded-full border border-white shadow-sm flex items-center justify-center
                            ${agent.job.includes('建筑') ? 'bg-amber-500' : agent.job.includes('领袖') ? 'bg-blue-500' : 'bg-emerald-500'}
                        `}>
                        </div>

                        {/* 名字 (悬浮显示) */}
                        <div className="absolute top-full mt-1 bg-stone-800/90 text-white text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
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