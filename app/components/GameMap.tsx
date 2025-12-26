'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Home, Warehouse, Ambulance, Utensils, Castle, Trees, User, Coffee, ShoppingCart, Book } from 'lucide-react';

// --- 1. 小镇配置 ---
const TILE_SIZE = 32;
const MAP_SIZE = 100; // 100x100 的大地图，足够容纳繁华小镇

// 地块类型定义 (ID)
const TILES = {
  EMPTY: 0,
  GRASS: 1,
  ROAD: 2,
  FLOOR_WOOD: 3,   // 浅色木地板
  FLOOR_DARK: 4,   // 深色木地板
  FLOOR_TILE: 5,   // 瓷砖
  FLOOR_RUG: 6,    // 地毯区
  WALL: 10,        // 墙壁
  DOOR: 11,        // 门
  TREE: 20,        // 树
  FLOWER: 21,      // 花
  FURNITURE_BED: 30,
  FURNITURE_TABLE_ROUND: 31,
  FURNITURE_TABLE_RECT: 32,
  FURNITURE_SHELF: 33,
  FURNITURE_PLANT: 34,
};

// --- 2. 配色方案 (AI Town / Stardew Valley 风格) ---
const COLORS = {
  GRASS_BG: '#7dae58',      // 草地底色
  GRASS_FG: '#96c968',      // 草地亮部
  ROAD:     '#94a3b8',      // 街道灰
  ROAD_EDGE:'#64748b',      // 街道边线
  WALL_TOP: '#5f4b8b',      // 墙顶 (复古紫灰)
  WALL_FACE:'#a8a29e',      // 墙面
  WOOD_L:   '#e6ccb2',      // 浅木
  WOOD_D:   '#b08968',      // 深木
  TILE:     '#f1f5f9',      // 瓷砖
  RUG:      '#fca5a5',      // 地毯红
  DOOR:     '#7c2d12',      // 门框
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 程序化城市生成器 ---
  const townMap = useMemo(() => {
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE).fill(TILES.GRASS);
    const furniture: {x: number, y: number, type: number}[] = [];

    // 辅助: 矩形填充
    const fillRect = (x: number, y: number, w: number, h: number, type: number) => {
      for(let iy=y; iy<y+h; iy++) {
        for(let ix=x; ix<x+w; ix++) {
          if (ix>=0 && ix<MAP_SIZE && iy>=0 && iy<MAP_SIZE) map[iy * MAP_SIZE + ix] = type;
        }
      }
    };

    // 辅助: 建造房屋 (包含内饰)
    const buildHouse = (x: number, y: number, w: number, h: number, type: 'RESIDENTIAL' | 'COMMERCIAL') => {
        // 留出院子空间
        const margin = 2;
        const bx = x + margin;
        const by = y + margin;
        const bw = w - margin*2;
        const bh = h - margin*2;

        if (bw < 6 || bh < 6) return; // 太小不建

        // 地板材质选择
        let floorTile = TILES.FLOOR_WOOD;
        if (type === 'COMMERCIAL') floorTile = TILES.FLOOR_TILE;
        else if (Math.random() > 0.5) floorTile = TILES.FLOOR_DARK;

        // 1. 铺地板
        fillRect(bx, by, bw, bh, floorTile);

        // 2. 建墙
        fillRect(bx, by, bw, 1, TILES.WALL); // Top
        fillRect(bx, by+bh-1, bw, 1, TILES.WALL); // Bottom
        fillRect(bx, by, 1, bh, TILES.WALL); // Left
        fillRect(bx+bw-1, by, 1, bh, TILES.WALL); // Right

        // 3. 开门 (下方中间)
        const doorX = bx + Math.floor(bw/2);
        map[(by+bh-1) * MAP_SIZE + doorX] = TILES.DOOR;
        // 门前铺路连接到区域边缘
        fillRect(doorX, by+bh, 1, margin, TILES.ROAD);

        // 4. 室内布置 (简单算法)
        if (type === 'RESIDENTIAL') {
            // 床 (左上角)
            furniture.push({x: bx+1, y: by+1, type: TILES.FURNITURE_BED});
            // 桌子 (中心)
            furniture.push({x: bx + Math.floor(bw/2), y: by + Math.floor(bh/2), type: TILES.FURNITURE_TABLE_ROUND});
            // 盆栽 (右上角)
            furniture.push({x: bx+bw-2, y: by+1, type: TILES.FURNITURE_PLANT});
        } else {
            // 商店货架/桌子
            furniture.push({x: bx+1, y: by+1, type: TILES.FURNITURE_SHELF});
            furniture.push({x: bx+bw-2, y: by+1, type: TILES.FURNITURE_SHELF});
            furniture.push({x: bx + Math.floor(bw/2), y: by + Math.floor(bh/2), type: TILES.FURNITURE_TABLE_RECT});
        }
    };

    // --- 开始规划 ---
    
    // 1. 生成路网 (Grid Layout)
    const blockSize = 16; // 每个街区大小
    const roadWidth = 2;
    
    // 铺设主干道网格
    for (let x = 0; x < MAP_SIZE; x += blockSize) {
        fillRect(x, 0, roadWidth, MAP_SIZE, TILES.ROAD);
    }
    for (let y = 0; y < MAP_SIZE; y += blockSize) {
        fillRect(0, y, MAP_SIZE, roadWidth, TILES.ROAD);
    }

    // 2. 填充街区 (Block Filling)
    for (let gy = 0; gy < MAP_SIZE; gy += blockSize) {
        for (let gx = 0; gx < MAP_SIZE; gx += blockSize) {
            // 街区内部区域
            const rx = gx + roadWidth;
            const ry = gy + roadWidth;
            const rw = blockSize - roadWidth;
            const rh = blockSize - roadWidth;

            // 决定这个街区做什么
            const seed = Math.sin(gx * 99 + gy);
            
            if (seed > 0.8) {
                // 公园 (保留草地，加树和花)
                for (let i=0; i<8; i++) {
                    const tx = rx + Math.floor(Math.random() * rw);
                    const ty = ry + Math.floor(Math.random() * rh);
                    if (map[ty * MAP_SIZE + tx] === TILES.GRASS) {
                        map[ty * MAP_SIZE + tx] = Math.random() > 0.5 ? TILES.TREE : TILES.FLOWER;
                    }
                }
            } else if (seed > 0.3) {
                // 住宅区 (建房子)
                buildHouse(rx, ry, rw, rh, 'RESIDENTIAL');
            } else {
                // 商业区
                buildHouse(rx, ry, rw, rh, 'COMMERCIAL');
            }
        }
    }

    // 3. 中央广场 (覆盖中间几个街区)
    const cx = Math.floor(MAP_SIZE/2) - 8;
    const cy = Math.floor(MAP_SIZE/2) - 8;
    fillRect(cx, cy, 16, 16, TILES.FLOOR_TILE); // 广场铺砖
    // 广场中心喷泉/雕塑位置留空或放特殊装饰
    
    return { grid: map, furniture };
  }, []);

  // --- 2. Canvas 渲染 (高清像素风) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = MAP_SIZE * TILE_SIZE;
    const height = MAP_SIZE * TILE_SIZE;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 绘制草地背景
    ctx.fillStyle = COLORS.GRASS_BG;
    ctx.fillRect(0, 0, width, height);

    const { grid, furniture } = townMap;

    // Pass 1: 地块渲染
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = grid[y * MAP_SIZE + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile === TILES.ROAD) {
            ctx.fillStyle = COLORS.ROAD;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // 简单的路面噪点
            if ((x+y)%3===0) {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(px+4, py+4, 4, 4);
            }
        }
        else if (tile === TILES.FLOOR_WOOD) {
            ctx.fillStyle = COLORS.WOOD_L;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = COLORS.WOOD_D; // 木纹横条
            ctx.fillRect(px, py, TILE_SIZE, 1);
            ctx.fillRect(px, py+8, TILE_SIZE, 1);
            ctx.fillRect(px, py+16, TILE_SIZE, 1);
            ctx.fillRect(px, py+24, TILE_SIZE, 1);
        }
        else if (tile === TILES.FLOOR_DARK) {
            ctx.fillStyle = '#a1887f';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#8d6e63'; 
            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        else if (tile === TILES.FLOOR_TILE) {
            ctx.fillStyle = COLORS.TILE;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#cbd5e1';
            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        else if (tile === TILES.WALL) {
            ctx.fillStyle = COLORS.WALL_FACE;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = COLORS.WALL_TOP;
            ctx.fillRect(px, py, TILE_SIZE, 8); // 墙顶厚度
        }
        else if (tile === TILES.DOOR) {
            ctx.fillStyle = '#bcaaa4';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = COLORS.DOOR;
            ctx.fillRect(px+6, py+6, TILE_SIZE-12, TILE_SIZE-6);
        }
        else if (tile === TILES.FLOWER) {
            // 画个小花
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath(); ctx.arc(px+16, py+16, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fef3c7';
            ctx.beginPath(); ctx.arc(px+16, py+16, 2, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    // Pass 2: 物体渲染 (树、家具)
    // 树木
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            if (grid[y * MAP_SIZE + x] === TILES.TREE) {
                const px = x * TILE_SIZE + TILE_SIZE/2;
                const py = y * TILE_SIZE + TILE_SIZE/2;
                ctx.fillStyle = '#4ade80'; // 亮绿树冠
                ctx.beginPath(); ctx.arc(px, py-8, 12, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#16a34a'; // 深绿阴影
                ctx.beginPath(); ctx.arc(px-4, py-6, 8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#78350f'; // 树干
                ctx.fillRect(px-2, py+2, 4, 6);
            }
        }
    }
    // 家具
    furniture.forEach(f => {
        const px = f.x * TILE_SIZE;
        const py = f.y * TILE_SIZE;
        const cx = px + TILE_SIZE/2;
        const cy = py + TILE_SIZE/2;

        if (f.type === TILES.FURNITURE_BED) {
            ctx.fillStyle = '#bae6fd'; // 被子
            ctx.fillRect(px+4, py+4, 24, 26);
            ctx.fillStyle = '#ffffff'; // 枕头
            ctx.fillRect(px+4, py+4, 24, 8);
        } else if (f.type === TILES.FURNITURE_TABLE_ROUND) {
            ctx.fillStyle = '#d7ccc8';
            ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#a1887f'; ctx.lineWidth=2; ctx.stroke();
        } else if (f.type === TILES.FURNITURE_SHELF) {
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(px+4, py+8, 24, 16);
            // 书
            ctx.fillStyle = '#ef4444'; ctx.fillRect(px+6, py+10, 4, 12);
            ctx.fillStyle = '#3b82f6'; ctx.fillRect(px+12, py+10, 4, 12);
            ctx.fillStyle = '#eab308'; ctx.fillRect(px+18, py+10, 4, 12);
        } else if (f.type === TILES.FURNITURE_PLANT) {
            ctx.fillStyle = '#22c55e';
            ctx.beginPath(); ctx.arc(cx, cy-4, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#d97706'; // 盆
            ctx.fillRect(cx-4, cy+4, 8, 6);
        }
    });

  }, [townMap]);

  // --- 3. 初始视角居中 ---
  useEffect(() => {
    if (!containerRef.current) return;
    const pW = containerRef.current.clientWidth;
    const pH = containerRef.current.clientHeight;
    // 默认看中心广场
    const mapW = MAP_SIZE * TILE_SIZE;
    const mapH = MAP_SIZE * TILE_SIZE;
    
    setViewState({
        scale: 1, // 1:1 像素显示，最清晰
        x: (pW - mapW) / 2,
        y: (pH - mapH) / 2
    });
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#1e293b] relative overflow-hidden select-none cursor-move">
      {/* 拖拽/缩放容器 (暂时简化为固定中心，可后续加拖拽) */}
      <div 
        className="absolute origin-center transition-transform duration-200"
        style={{
          width: MAP_SIZE * TILE_SIZE,
          height: MAP_SIZE * TILE_SIZE,
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
          imageRendering: 'pixelated'
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-2xl" />

        {/* 角色层 (Token) */}
        {agents.map((agent: any) => {
            // 模拟坐标映射
            const tx = (agent.x / 100) * MAP_SIZE;
            const ty = (agent.y / 100) * MAP_SIZE;
            
            return (
                <div
                    key={agent.id}
                    className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ 
                        left: tx * TILE_SIZE, 
                        top: ty * TILE_SIZE, 
                        width: TILE_SIZE, 
                        height: TILE_SIZE 
                    }}
                >
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                        {/* 名字 */}
                        <div className="absolute top-[-14px] bg-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold text-black border border-stone-300 shadow-sm whitespace-nowrap z-50">
                            {agent.name}
                        </div>
                        
                        {/* 气泡 */}
                        {agent.actionLog && agent.actionLog.includes('“') && (
                            <div className="absolute top-[-30px] bg-white border-2 border-black px-2 py-1 rounded-lg text-[9px] font-bold shadow-md whitespace-nowrap z-50">
                                💬
                            </div>
                        )}

                        {/* 小人 Sprite */}
                        <div className={`
                            w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-[10px] font-black
                            ${agent.job.includes('建筑') ? 'bg-orange-500' : agent.job.includes('领袖') ? 'bg-blue-600' : 'bg-emerald-500'}
                        `}>
                            {agent.name[0]}
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}