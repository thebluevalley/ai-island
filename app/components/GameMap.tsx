'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 地图硬参数 ---
const TILE_SIZE = 32;
const MAP_COLS = 80; 
const MAP_ROWS = 60;

// 地块类型
const TILES = {
  GRASS: 0,
  ROAD_MAIN: 1, // 主干道 (宽)
  ROAD_SUB: 2,  // 次干道 (窄)
  PAVEMENT: 3,  // 广场/商业地面
  WATER: 4,     // 湖泊
  PARK: 5,      // 公园绿地
};

// 建筑类型 (造型区分)
const BLDG = {
  RES_A: 'res_a',     // 民居 A (红顶)
  RES_B: 'res_b',     // 民居 B (蓝顶)
  COMM:  'comm',      // 商业 (平顶+雨棚)
  CIVIC_HALL: 'hall', // 市政厅 (钟楼)
  CIVIC_LIB: 'lib',   // 图书馆 (宽体)
  CIVIC_HOSP: 'hosp', // 医院 (十字)
};

// --- 2. 城镇配色 ---
const COLORS = {
  BG:        '#dcedc8',
  GRASS:     '#e8f5e9',
  ROAD_MAIN: '#eceff1', // 主路亮白
  ROAD_SUB:  '#cfd8dc', // 次路稍暗
  PAVEMENT:  '#fff8e1', // 暖色铺装
  WATER:     '#4fc3f7',
  PARK:      '#a5d6a7',

  // 建筑墙体
  WALL_RES:  '#fffdfb',
  WALL_COMM: '#f5f5f5',
  WALL_CIVIC:'#eceff1', 
  
  // 屋顶
  ROOF_RES_A:'#ff8a65', // 暖红
  ROOF_RES_B:'#90caf9', // 淡蓝
  ROOF_COMM: '#80cbc4', // 青色
  ROOF_CIVIC:'#78909c', // 深灰蓝 (庄重)
  
  // 细节
  SHADOW:    'rgba(0,0,0,0.15)',
  TREE:      '#43a047',
  DOOR:      '#5d4037',
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 0.5, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 真实城镇生成器 (Town Layout Algo) ---
  const cityData = useMemo(() => {
    const grid = new Uint8Array(MAP_COLS * MAP_ROWS).fill(TILES.GRASS);
    const buildings: any[] = []; // {x,y,w,h,type}
    const props: any[] = [];     // {x,y,type}

    // 工具函数
    const fill = (x: number, y: number, w: number, h: number, t: number) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) 
            if(ix>=0 && ix<MAP_COLS && iy>=0 && iy<MAP_ROWS) grid[iy*MAP_COLS+ix] = t;
    };
    const addBldg = (x: number, y: number, w: number, h: number, type: string) => {
        buildings.push({ x, y, w, h, type });
        // 建筑下铺设地基，避免杂草穿模
        fill(x, y, w, h, TILES.PAVEMENT); 
    };

    // === Step 1: 规划中心与骨架 ===
    const centerX = MAP_COLS / 2;
    const centerY = MAP_ROWS / 2;
    
    // 主干道 (十字型，宽 4 格)
    const mainRoadW = 4;
    fill(0, centerY - mainRoadW/2, MAP_COLS, mainRoadW, TILES.ROAD_MAIN);
    fill(centerX - mainRoadW/2, 0, mainRoadW, MAP_ROWS, TILES.ROAD_MAIN);

    // === Step 2: 定义中央功能区 (Park & Plaza) ===
    const centerSize = 24; // 中心区域大小
    const cxStart = centerX - centerSize/2;
    const cyStart = centerY - centerSize/2;

    // 左上象限：中央公园
    fill(cxStart, cyStart, centerSize/2, centerSize/2, TILES.PARK);
    fill(cxStart+2, cyStart+2, centerSize/2-4, centerSize/2-4, TILES.WATER); // 湖
    // 右上象限：市政广场
    fill(centerX, cyStart, centerSize/2, centerSize/2, TILES.PAVEMENT);
    addBldg(centerX + 2, cyStart + 2, 8, 8, BLDG.CIVIC_HALL); // 市政厅
    // 下半部分：文化区
    fill(cxStart, centerY, centerSize, centerSize/2, TILES.PAVEMENT);
    addBldg(cxStart + 2, centerY + 2, 8, 6, BLDG.CIVIC_LIB); // 图书馆
    addBldg(centerX + 2, centerY + 2, 8, 6, BLDG.CIVIC_HOSP); // 医院

    // === Step 3: 街区填充 (Residential & Commercial) ===
    // 将地图剩余部分划分为大区块 (Superblocks)
    const blockW = 18;
    const blockH = 14;

    for (let by = 2; by < MAP_ROWS - blockH; by += blockH) {
        for (let bx = 2; bx < MAP_COLS - blockW; bx += blockW) {
            
            // 跳过中心区域
            if (bx > cxStart - 5 && bx < cxStart + centerSize + 5 && 
                by > cyStart - 5 && by < cyStart + centerSize + 5) continue;

            // 绘制街区边界 (次干道)
            // 只有当不是主干道覆盖的地方才画次干道
            const isMainRow = Math.abs((by + blockH/2) - centerY) < 10;
            const isMainCol = Math.abs((bx + blockW/2) - centerX) < 10;
            
            // 如果紧邻主干道，大概率是商业区
            const isCommercialZone = isMainRow || isMainCol; 

            // 街区内部坐标
            const ix = bx + 1; 
            const iy = by + 1;
            const iw = blockW - 2; 
            const ih = blockH - 2;

            if (isCommercialZone) {
                // === 商业街区 ===
                fill(ix, iy, iw, ih, TILES.PAVEMENT);
                // 上下两排商店
                const shopW = 6, shopH = 4;
                for (let k = 0; k < iw - shopW; k += shopW + 1) {
                    addBldg(ix + k + 1, iy + 1, shopW, shopH, BLDG.COMM);
                    addBldg(ix + k + 1, iy + ih - shopH - 1, shopW, shopH, BLDG.COMM);
                }
            } else {
                // === 住宅街区 (主力) ===
                // 内部铺设 "王" 字形或 "工" 字形小路
                fill(ix + iw/2, iy, 1, ih, TILES.ROAD_SUB); // 竖向中轴路
                fill(ix, iy + ih/2, iw, 1, TILES.ROAD_SUB); // 横向中轴路

                // 分割为 4 个小地块，每个建 1-2 栋房
                const houseW = 4, houseH = 4;
                
                // 简单的填充逻辑：在四个象限尝试放置房屋
                const quadrants = [
                    {x: ix+1, y: iy+1}, 
                    {x: ix+iw/2+2, y: iy+1},
                    {x: ix+1, y: iy+ih/2+2},
                    {x: ix+iw/2+2, y: iy+ih/2+2}
                ];

                quadrants.forEach(q => {
                    // 90% 概率生成房子
                    if (Math.random() > 0.1) {
                        const type = Math.random() > 0.5 ? BLDG.RES_A : BLDG.RES_B;
                        addBldg(q.x, q.y, houseW, houseH, type);
                        // 剩下的空间种树
                        props.push({x: q.x + houseW + 1, y: q.y + 2, type: 'tree'});
                    }
                });
            }
        }
    }

    // === Step 4: 全局绿化 ===
    // 沿着主干道种树
    for(let i=4; i<MAP_COLS; i+=4) {
        if (Math.abs(i-centerX) > mainRoadW) {
            props.push({x: i, y: centerY - mainRoadW, type: 'tree'});
            props.push({x: i, y: centerY + mainRoadW + 1, type: 'tree'});
        }
    }
    for(let j=4; j<MAP_ROWS; j+=4) {
        if (Math.abs(j-centerY) > mainRoadW) {
            props.push({x: centerX - mainRoadW, y: j, type: 'tree'});
            props.push({x: centerX + mainRoadW + 1, y: j, type: 'tree'});
        }
    }

    // 渲染顺序排序：Y 轴小的先画 (遮挡关系)
    buildings.sort((a, b) => a.y - b.y);

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 (Visuals) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = MAP_COLS * TILE_SIZE;
    const h = MAP_ROWS * TILE_SIZE;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // 1. 地面层
    const { grid, buildings, props } = cityData;
    ctx.fillStyle = COLORS.GRASS; ctx.fillRect(0, 0, w, h);

    for(let y=0; y<MAP_ROWS; y++) {
        for(let x=0; x<MAP_COLS; x++) {
            const t = grid[y*MAP_COLS+x];
            const px = x*TILE_SIZE, py = y*TILE_SIZE;
            if(t===TILES.ROAD_MAIN) { ctx.fillStyle = COLORS.ROAD_MAIN; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
            else if(t===TILES.ROAD_SUB) { ctx.fillStyle = COLORS.ROAD_SUB; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
            else if(t===TILES.PAVEMENT) { ctx.fillStyle = COLORS.PAVEMENT; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
            else if(t===TILES.WATER) { ctx.fillStyle = COLORS.WATER; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
            else if(t===TILES.PARK) { ctx.fillStyle = COLORS.PARK; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE); }
        }
    }

    // 2. 装饰层 (树)
    props.forEach(p => {
        const px = p.x*TILE_SIZE+TILE_SIZE/2, py = p.y*TILE_SIZE+TILE_SIZE/2;
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.ellipse(px+4, py+8, 8, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#795548'; ctx.fillRect(px-2, py, 4, 8);
        ctx.fillStyle = COLORS.TREE; ctx.beginPath(); ctx.arc(px, py-8, 12, 0, Math.PI*2); ctx.fill();
    });

    // 3. 建筑层 (关键：造型区分)
    buildings.forEach(b => {
        const px = b.x*TILE_SIZE, py = b.y*TILE_SIZE, pw = b.w*TILE_SIZE, ph = b.h*TILE_SIZE;
        
        // 阴影
        ctx.fillStyle = COLORS.SHADOW; ctx.fillRect(px+6, py+6, pw, ph);

        // 墙体
        let wallC = COLORS.WALL_RES;
        if (b.type === BLDG.COMM) wallC = COLORS.WALL_COMM;
        if (b.type.startsWith('civic')) wallC = COLORS.WALL_CIVIC;
        ctx.fillStyle = wallC; ctx.fillRect(px, py, pw, ph);
        
        // 墙体细节
        ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(px, py+ph-4, pw, 4); // 底边

        // 门窗绘制
        const doorW = 10, doorH = 14;
        ctx.fillStyle = COLORS.DOOR;
        ctx.fillRect(px + pw/2 - doorW/2, py + ph - doorH, doorW, doorH);

        ctx.fillStyle = '#b3e5fc'; // 窗户
        if (pw > 40) { // 宽房子画两个窗
            ctx.fillRect(px+6, py+10, 8, 8);
            ctx.fillRect(px+pw-14, py+10, 8, 8);
        }

        // --- 屋顶造型逻辑 ---
        
        if (b.type === BLDG.CIVIC_HALL) {
            // 市政厅：梯形顶 + 中央钟楼
            ctx.fillStyle = COLORS.ROOF_CIVIC;
            ctx.beginPath(); ctx.moveTo(px-4, py); ctx.lineTo(px+pw+4, py); ctx.lineTo(px+pw-4, py-10); ctx.lineTo(px+4, py-10); ctx.fill();
            // 钟楼
            const tw = 20, th = 24;
            const tx = px + pw/2 - tw/2;
            ctx.fillStyle = wallC; ctx.fillRect(tx, py-th, tw, th); // 塔身
            ctx.fillStyle = COLORS.ROOF_CIVIC; ctx.beginPath(); ctx.moveTo(tx-2, py-th); ctx.lineTo(tx+tw/2, py-th-12); ctx.lineTo(tx+tw+2, py-th); ctx.fill(); // 塔尖
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx+tw/2, py-th/2, 5, 0, Math.PI*2); ctx.fill(); // 钟
        }
        else if (b.type === BLDG.CIVIC_LIB || b.type === BLDG.CIVIC_HOSP) {
            // 公共建筑：平顶/现代
            ctx.fillStyle = COLORS.ROOF_CIVIC;
            ctx.fillRect(px-2, py-4, pw+4, 8);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(px+4, py-2, pw-8, 4); // 玻璃顶
        }
        else if (b.type === BLDG.COMM) {
            // 商业：平顶 + 遮阳棚
            ctx.fillStyle = COLORS.ROOF_COMM;
            ctx.fillRect(px-1, py-2, pw+2, 6);
            // 遮阳棚 stripes
            ctx.fillStyle = '#ef5350';
            for(let i=0; i<pw; i+=8) ctx.fillRect(px+i, py+8, 4, 4);
        }
        else {
            // 住宅：三角尖顶
            ctx.fillStyle = b.type === BLDG.RES_A ? COLORS.ROOF_RES_A : COLORS.ROOF_RES_B;
            ctx.beginPath(); 
            ctx.moveTo(px-4, py); 
            ctx.lineTo(px+pw/2, py-12); 
            ctx.lineTo(px+pw+4, py); 
            ctx.fill();
        }
    });

  }, [cityData]);

  // --- 3. 强制全景适配 ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0 || pH === 0) return;

      const mapW = MAP_COLS * TILE_SIZE;
      const mapH = MAP_ROWS * TILE_SIZE;

      // 确保整个地图都在屏幕内 (Contain 模式)
      const scale = Math.min(pW / mapW, pH / mapH) * 0.95;
      
      setViewState({ 
          scale: scale, 
          x: (pW - mapW * scale) / 2, 
          y: (pH - mapH * scale) / 2 
      });
    };
    
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 100);
    return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#b0bec5] relative overflow-hidden select-none">
      <div 
        className="absolute transition-transform duration-500 ease-out will-change-transform"
        style={{
          width: MAP_COLS * TILE_SIZE,
          height: MAP_ROWS * TILE_SIZE,
          transformOrigin: '0 0',
          transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`,
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-2xl rounded-sm" />

        {/* 角色层 */}
        {agents.map((agent: any) => {
            const tx = (agent.x/100)*MAP_COLS, ty = (agent.y/100)*MAP_ROWS;
            return (
                <div key={agent.id} className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: tx*TILE_SIZE, top: ty*TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        {/* 缩小名字标签 */}
                        <div className="absolute top-[-6px] bg-white/80 px-1 rounded-[2px] text-[5px] text-black border border-black/5 whitespace-nowrap">
                            {agent.name}
                        </div>
                        <div className={`w-3 h-3 rounded-full border border-white shadow-sm flex items-center justify-center ${agent.job.includes('建筑')?'bg-orange-500':agent.job.includes('领袖')?'bg-blue-600':'bg-emerald-500'}`}>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}