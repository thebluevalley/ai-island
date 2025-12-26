'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, User } from 'lucide-react';

// --- 1. AI Town 配置 ---
const TILE_SIZE = 32;
const MAP_COLS = 64; 
const MAP_ROWS = 48; // 4:3 比例

// 地块类型定义
const TILES = {
  EMPTY: 0,
  GRASS: 1,
  ROAD: 2,
  FLOOR_WOOD: 3,  // 木地板 (卧室)
  FLOOR_TILE: 4,  // 瓷砖 (厨房/商店)
  WALL: 5,        // 墙壁
  DOOR: 6,        // 门
  TREE: 7,        // 树
  FURNITURE_TABLE: 8,
  FURNITURE_BED: 9,
};

// --- 2. 经典 RPG 配色 (参考 Smallville) ---
const COLORS = {
  GRASS_BG: '#7dae58',      // 深一点的草绿底色
  GRASS_FG: '#96c968',      // 亮绿杂色
  ROAD:     '#aeb5bd',      // 灰色路面
  ROAD_BORDER: '#8b9bb4',   // 路边
  WALL:     '#5e5466',      // 深紫色墙顶 (RPG Maker 风格)
  WALL_FACE: '#aeb5bd',     // 墙面
  WOOD:     '#e0c3a3',      // 浅木地板
  WOOD_DARK:'#c6a683',      // 木纹
  TILE:     '#ffffff',      // 白瓷砖
  TILE_DARK:'#dcebf5',      // 瓷砖缝
  DOOR:     '#8a5d3b',      // 门
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 程序化生成小镇布局 ---
  const townMap = useMemo(() => {
    const map = new Uint8Array(MAP_COLS * MAP_ROWS).fill(TILES.GRASS);
    // 修复点：显式定义 furniture 数组的类型
    const furniture: {x: number, y: number, type: number}[] = []; 

    // 辅助函数：画矩形块
    const fillRect = (x: number, y: number, w: number, h: number, type: number) => {
      for(let iy=y; iy<y+h; iy++) {
        for(let ix=x; ix<x+w; ix++) {
          if (ix>=0 && ix<MAP_COLS && iy>=0 && iy<MAP_ROWS) map[iy * MAP_COLS + ix] = type;
        }
      }
    };

    // 辅助函数：建造房屋 (带墙壁、地板、门)
    const buildRoom = (x: number, y: number, w: number, h: number, floorType: number, name: string) => {
      // 1. 地板
      fillRect(x, y, w, h, floorType);
      // 2. 墙壁 (围一圈)
      // Top
      fillRect(x, y, w, 1, TILES.WALL);
      // Bottom
      fillRect(x, y+h-1, w, 1, TILES.WALL);
      // Left
      fillRect(x, y, 1, h, TILES.WALL);
      // Right
      fillRect(x+w-1, y, 1, h, TILES.WALL);
      // 3. 门 (在下方正中间)
      map[(y+h-1) * MAP_COLS + (x + Math.floor(w/2))] = TILES.DOOR;

      // 4. 生成简单家具
      if (w > 4 && h > 4) {
          // 床 (左上角)
          furniture.push({x: x+1, y: y+1, type: TILES.FURNITURE_BED});
          // 桌子 (中间)
          furniture.push({x: x + Math.floor(w/2), y: y + Math.floor(h/2), type: TILES.FURNITURE_TABLE});
      }
    };

    // --- 开始生成 ---

    // 1. 主干道 (十字形)
    const centerX = Math.floor(MAP_COLS/2);
    const centerY = Math.floor(MAP_ROWS/2);
    
    // 横路
    fillRect(0, centerY - 2, MAP_COLS, 4, TILES.ROAD);
    // 竖路
    fillRect(centerX - 2, 0, 4, MAP_ROWS, TILES.ROAD);

    // 2. 左上角：居民区
    buildRoom(4, 4, 12, 10, TILES.FLOOR_WOOD, "House A");
    buildRoom(20, 4, 10, 8, TILES.FLOOR_WOOD, "House B");
    buildRoom(4, 18, 12, 10, TILES.FLOOR_WOOD, "House C");

    // 3. 右上角：学校/图书馆
    buildRoom(centerX + 6, 6, 20, 14, TILES.FLOOR_TILE, "Library");

    // 4. 左下角：商店 & 咖啡馆
    buildRoom(6, centerY + 6, 16, 12, TILES.FLOOR_TILE, "Cafe");
    buildRoom(26, centerY + 10, 10, 8, TILES.FLOOR_WOOD, "Mart");

    // 5. 右下角：公园
    // 公园不需要墙，就是草地，加上一些树
    for(let i=0; i<15; i++) {
       const tx = centerX + 4 + Math.floor(Math.random() * 20);
       const ty = centerY + 4 + Math.floor(Math.random() * 15);
       if (map[ty * MAP_COLS + tx] === TILES.GRASS) {
           map[ty * MAP_COLS + tx] = TILES.TREE;
       }
    }

    return { grid: map, furniture };
  }, []);

  // --- 2. Canvas 渲染 (Tileset Simulation) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 分辨率处理
    const dpr = window.devicePixelRatio || 1;
    const width = MAP_COLS * TILE_SIZE;
    const height = MAP_ROWS * TILE_SIZE;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 绘制背景
    ctx.fillStyle = COLORS.GRASS_BG;
    ctx.fillRect(0, 0, width, height);

    const { grid, furniture } = townMap;

    // Pass 1: 绘制地块
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const tile = grid[y * MAP_COLS + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile === TILES.ROAD) {
            ctx.fillStyle = COLORS.ROAD;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 路边线
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(px, py, TILE_SIZE, 2);
        }
        else if (tile === TILES.FLOOR_WOOD) {
            ctx.fillStyle = COLORS.WOOD;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 木板纹理
            ctx.fillStyle = COLORS.WOOD_DARK;
            ctx.fillRect(px, py + 4, TILE_SIZE, 1);
            ctx.fillRect(px, py + 12, TILE_SIZE, 1);
            ctx.fillRect(px, py + 20, TILE_SIZE, 1);
            ctx.fillRect(px, py + 28, TILE_SIZE, 1);
        }
        else if (tile === TILES.FLOOR_TILE) {
            ctx.fillStyle = COLORS.TILE;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 瓷砖方格
            ctx.fillStyle = COLORS.TILE_DARK;
            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        else if (tile === TILES.WALL) {
            ctx.fillStyle = COLORS.WALL_FACE;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 墙顶
            ctx.fillStyle = COLORS.WALL;
            ctx.fillRect(px, py, TILE_SIZE, 10);
        }
        else if (tile === TILES.DOOR) {
            ctx.fillStyle = COLORS.WOOD;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#543b25';
            ctx.fillRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-4);
        }
        else if (tile === TILES.GRASS) {
            // 随机杂草点缀
            if ((x * y * 13) % 7 === 0) {
                ctx.fillStyle = COLORS.GRASS_FG;
                ctx.fillRect(px + 10, py + 10, 4, 4);
                ctx.fillRect(px + 16, py + 12, 3, 3);
            }
        }
      }
    }

    // Pass 2: 绘制物体 (树、家具)
    // 树
    for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
            const tile = grid[y * MAP_COLS + x];
            if (tile === TILES.TREE) {
                const px = x * TILE_SIZE + TILE_SIZE/2;
                const py = y * TILE_SIZE + TILE_SIZE/2;
                // 树冠
                ctx.fillStyle = '#42b983';
                ctx.beginPath();
                ctx.arc(px, py-10, 14, 0, Math.PI*2);
                ctx.fill();
                // 树干
                ctx.fillStyle = '#8a5d3b';
                ctx.fillRect(px-3, py, 6, 10);
            }
        }
    }
    // 家具
    furniture.forEach(item => {
        const px = item.x * TILE_SIZE;
        const py = item.y * TILE_SIZE;
        if (item.type === TILES.FURNITURE_TABLE) {
            // 桌子
            ctx.fillStyle = '#8d6e63';
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 12, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#5d4037';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (item.type === TILES.FURNITURE_BED) {
            // 床
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px+4, py+4, 24, 28);
            ctx.fillStyle = '#90caf9'; // 枕头
            ctx.fillRect(px+6, py+6, 20, 8);
        }
    });

  }, [townMap]);

  // --- 3. Viewport Focus ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapW = MAP_COLS * TILE_SIZE;
      
      // 保证屏幕能看到 20~25 个格子宽
      const targetCols = 24; 
      const scale = pW / (targetCols * TILE_SIZE);
      
      const x = (pW - mapW * scale) / 2;
      const y = (pH - MAP_ROWS * TILE_SIZE * scale) / 2;
      
      setViewState({ scale, x, y });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#2c3e50] relative overflow-hidden select-none">
      
      <div 
        className="absolute origin-top-left shadow-2xl transition-transform duration-200 ease-out"
        style={{
          width: MAP_COLS * TILE_SIZE,
          height: MAP_ROWS * TILE_SIZE,
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
          imageRendering: 'pixelated' // 关键：保持像素清晰
        }}
      >
        {/* 底层 Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0" />

        {/* 顶层：角色 Entity */}
        {agents.map((agent: any) => {
            // 坐标映射
            const tx = (agent.x / 80) * MAP_COLS;
            const ty = (agent.y / 80) * MAP_ROWS;
            
            const px = tx * TILE_SIZE;
            const py = ty * TILE_SIZE;

            const isTalking = agent.actionLog && agent.actionLog.includes('“');

            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: px, top: py, width: TILE_SIZE, height: TILE_SIZE }}
                >
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        {/* 名字标签 */}
                        <div className="absolute top-[-10px] bg-black/50 text-white text-[8px] px-1.5 rounded-full whitespace-nowrap backdrop-blur-sm">
                            {agent.name}
                        </div>

                        {/* 气泡 */}
                        {isTalking && (
                            <div className="absolute bottom-full mb-1 bg-white border-2 border-stone-800 px-2 py-1 rounded-lg text-[8px] font-bold shadow-sm whitespace-nowrap z-50">
                                💬
                            </div>
                        )}

                        {/* 角色 Sprite (像素小人) */}
                        <div className={`
                            w-6 h-8 rounded-t-full rounded-b-md border-2 border-black/20 shadow-sm flex items-center justify-center
                            ${agent.job.includes('建筑') ? 'bg-[#f1c40f]' : agent.job.includes('领袖') ? 'bg-[#3498db]' : 'bg-[#e74c3c]'}
                        `}>
                            {/* 简单的像素脸 */}
                            <div className="flex gap-1 mt-[-4px]">
                                <div className="w-0.5 h-1 bg-black/60"></div>
                                <div className="w-0.5 h-1 bg-black/60"></div>
                            </div>
                        </div>
                        
                        {/* 阴影 */}
                        <div className="absolute bottom-[-2px] w-5 h-1.5 bg-black/30 rounded-full"></div>
                    </div>
                </div>
            );
        })}

      </div>
    </div>
  );
}