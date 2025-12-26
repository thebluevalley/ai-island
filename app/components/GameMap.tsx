'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 地图硬参数 ---
const TILE_SIZE = 32;
const MAP_COLS = 80; // 宽度
const MAP_ROWS = 60; // 高度

// 地块类型
const TILES = {
  GRASS: 0,
  ROAD: 1,
  WATER: 2,
  PLAZA: 3,
};

// 建筑类型
const BLDG = {
  RES_A: 'res_a', // 红顶民居
  RES_B: 'res_b', // 蓝顶民居
  COMM:  'comm',  // 商业建筑
  CIVIC: 'civic', // 市政大楼
  TOWER: 'tower', // 塔楼
};

// --- 2. 淡雅且清晰的配色 (Pastel & Pop) ---
const COLORS = {
  // 背景层
  BG:        '#dcedc8', // 浅豆绿 (画布背景)
  GRASS:     '#e8f5e9', // 极淡绿 (草地)
  ROAD:      '#eceff1', // 亮灰 (道路)
  ROAD_LINE: '#cfd8dc', // 道路线
  WATER:     '#81d4fa', // 清透蓝
  PLAZA:     '#fff9c4', // 淡米黄 (广场)

  // 建筑层 (高对比度)
  WALL:      '#ffffff', // 纯白墙面 (最清晰)
  WALL_SHADOW:'#b0bec5',// 墙面阴影
  
  // 屋顶 (鲜明区分)
  ROOF_RES_A:'#ffab91', // 珊瑚红
  ROOF_RES_B:'#90caf9', // 天空蓝
  ROOF_COMM: '#80cbc4', // 青瓷色
  ROOF_CIVIC:'#9fa8da', // 靛青色
  
  // 细节
  SHADOW:    'rgba(0,0,0,0.15)', // 投影
  TREE:      '#a5d6a7', // 树冠
  TRUNK:     '#8d6e63', // 树干
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({ scale: 0.5, x: 0, y: 0 });

  const { agents } = worldData || { agents: [] };

  // --- 1. 强力城市生成器 (Robust City Gen) ---
  const cityData = useMemo(() => {
    // 初始化网格
    const grid = new Uint8Array(MAP_COLS * MAP_ROWS).fill(TILES.GRASS);
    const buildings: any[] = [];
    const props: any[] = []; // 树木、喷泉

    // 辅助: 矩形填充
    const fill = (x: number, y: number, w: number, h: number, t: number) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) 
            if(ix>=0 && ix<MAP_COLS && iy>=0 && iy<MAP_ROWS) grid[iy*MAP_COLS+ix] = t;
    };

    // 辅助: 添加建筑
    const addBldg = (x: number, y: number, w: number, h: number, type: string) => {
        buildings.push({ x, y, w, h, type });
        // 建筑底下铺水泥，防止穿帮
        fill(x, y, w, h, TILES.PLAZA);
    };

    // === 规划布局 ===
    
    // 1. 划分街区 (Grid Blocks)
    const blockW = 16;
    const blockH = 12;
    const roadW = 2;

    // 铺设路网
    for(let x=2; x<MAP_COLS; x+=blockW) fill(x, 0, roadW, MAP_ROWS, TILES.ROAD);
    for(let y=2; y<MAP_ROWS; y+=blockH) fill(0, y, MAP_COLS, roadW, TILES.ROAD);

    // 2. 填充每个街区
    for(let by=2; by<MAP_ROWS-blockH; by+=blockH) {
        for(let bx=2; bx<MAP_COLS-blockW; bx+=blockW) {
            
            // 街区中心坐标
            const cx = bx + blockW/2;
            const cy = by + blockH/2;
            const distToCenter = Math.sqrt((cx-MAP_COLS/2)**2 + (cy-MAP_ROWS/2)**2);

            // A. 市中心 (Civic Core) - 正中间的一个大十字区域
            if (distToCenter < 15) {
                fill(bx+roadW, by+roadW, blockW-roadW, blockH-roadW, TILES.PLAZA);
                // 放置大地标
                addBldg(bx+4, by+3, blockW-8, blockH-6, BLDG.CIVIC);
                // 广场四周种树
                props.push({x:bx+roadW+1, y:by+roadW+1, type:'tree'});
                props.push({x:bx+blockW-2, y:by+roadW+1, type:'tree'});
            }
            // B. 中央公园 (Park) - 随机挑选的一块地
            else if ((bx+by)%7 === 0) {
                fill(bx+roadW, by+roadW, blockW-roadW, blockH-roadW, TILES.GRASS);
                fill(bx+6, by+4, 6, 4, TILES.WATER); // 湖
                // 围一圈树
                for(let i=0; i<5; i++) props.push({x: bx+3+i*2, y: by+2, type:'tree'});
                for(let i=0; i<5; i++) props.push({x: bx+3+i*2, y: by+blockH-2, type:'tree'});
            }
            // C. 住宅区 (Residential) - 默认填满
            else {
                // 这是一个普通街区，我们把它填满房子
                // 模式：上下两排房子，中间一条小路
                const houseW = 5;
                const houseH = 4;
                
                // 第一排 (Top Row)
                addBldg(bx+2, by+1, houseW, houseH, Math.random()>0.5 ? BLDG.RES_A : BLDG.RES_B);
                addBldg(bx+8, by+1, houseW, houseH, Math.random()>0.5 ? BLDG.RES_A : BLDG.RES_B);
                
                // 第二排 (Bottom Row) - 可能是商店
                const isShop = Math.random() > 0.7;
                if (isShop) {
                    addBldg(bx+2, by+7, blockW-6, 4, BLDG.COMM); // 长条商店
                } else {
                    addBldg(bx+2, by+7, houseW, houseH, BLDG.RES_A);
                    addBldg(bx+8, by+7, houseW, houseH, BLDG.RES_B);
                }
            }
        }
    }

    // 3. 全局行道树 (在路边)
    for(let y=0; y<MAP_ROWS; y+=blockH) {
        for(let x=4; x<MAP_COLS; x+=4) {
            if (x%blockW !== 2) props.push({x: x, y: y+roadW, type: 'tree'});
        }
    }

    return { grid, buildings, props };
  }, []);

  // --- 2. 渲染引擎 (Crisp 2.5D) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = MAP_COLS * TILE_SIZE;
    const height = MAP_ROWS * TILE_SIZE;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = COLORS.BG; ctx.fillRect(0, 0, width, height);

    const { grid, buildings, props } = cityData;

    // Layer 1: 地形
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const t = grid[y * MAP_COLS + x];
        const px = x*TILE_SIZE, py = y*TILE_SIZE;
        
        if (t === TILES.GRASS) {
            ctx.fillStyle = COLORS.GRASS; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (t === TILES.ROAD) {
            ctx.fillStyle = COLORS.ROAD; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            if((x+y)%2===0) { ctx.fillStyle = COLORS.ROAD_LINE; ctx.fillRect(px+14, py+14, 4, 4); } // 虚线
        } else if (t === TILES.PLAZA) {
            ctx.fillStyle = COLORS.PLAZA; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (t === TILES.WATER) {
            ctx.fillStyle = COLORS.WATER; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Layer 2: 装饰
    props.forEach(p => {
        const px = p.x*TILE_SIZE + TILE_SIZE/2;
        const py = p.y*TILE_SIZE + TILE_SIZE/2;
        if (p.type === 'tree') {
            ctx.fillStyle = COLORS.SHADOW; ctx.beginPath(); ctx.ellipse(px+4, py+8, 8, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = COLORS.TRUNK; ctx.fillRect(px-2, py, 4, 8);
            ctx.fillStyle = COLORS.TREE; ctx.beginPath(); ctx.arc(px, py-6, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#c8e6c9'; ctx.beginPath(); ctx.arc(px-4, py-10, 4, 0, Math.PI*2); ctx.fill(); // 高光
        }
    });

    // Layer 3: 建筑 (清晰的几何体)
    buildings.forEach(b => {
        const px = b.x*TILE_SIZE;
        const py = b.y*TILE_SIZE;
        const pw = b.w*TILE_SIZE;
        const ph = b.h*TILE_SIZE;

        // 阴影
        ctx.fillStyle = COLORS.SHADOW; ctx.fillRect(px+8, py+8, pw, ph);

        // 墙体 (统一白墙，最百搭)
        const wallH = ph * 0.5; 
        const wallY = py + ph - wallH;
        ctx.fillStyle = COLORS.WALL; ctx.fillRect(px, wallY, pw, wallH);
        ctx.fillStyle = COLORS.WALL_SHADOW; ctx.fillRect(px, wallY+wallH-2, pw, 2); // 底边

        // 门
        ctx.fillStyle = '#795548'; ctx.fillRect(px+pw/2-6, wallY+wallH-12, 12, 12);

        // 窗 (简单方块)
        ctx.fillStyle = '#b3e5fc';
        if (pw > 40) {
            ctx.fillRect(px+6, wallY+6, 10, 10);
            ctx.fillRect(px+pw-16, wallY+6, 10, 10);
        }

        // 屋顶 (关键视觉元素)
        let roofColor = COLORS.ROOF_RES_A;
        if (b.type === BLDG.RES_B) roofColor = COLORS.ROOF_RES_B;
        if (b.type === BLDG.COMM) roofColor = COLORS.ROOF_COMM;
        if (b.type === BLDG.CIVIC) roofColor = COLORS.ROOF_CIVIC;

        ctx.fillStyle = roofColor;
        
        if (b.type === BLDG.COMM || b.type === BLDG.CIVIC) {
            // 平顶/梯形顶
            ctx.beginPath();
            ctx.moveTo(px-4, wallY);
            ctx.lineTo(px+4, py);
            ctx.lineTo(px+pw-4, py);
            ctx.lineTo(px+pw+4, wallY);
            ctx.fill();
            // 顶面高光
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(px+6, py+2, pw-12, wallY-py-4);
        } else {
            // 经典三角顶
            ctx.beginPath();
            ctx.moveTo(px-4, wallY);
            ctx.lineTo(px+pw/2, py-8); // 屋脊抬高
            ctx.lineTo(px+pw+4, wallY);
            ctx.fill();
            // 屋脊线
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth=2; ctx.beginPath();
            ctx.moveTo(px+4, wallY-4); ctx.lineTo(px+pw/2, py-8); ctx.stroke();
        }
        
        // 标签 (Debug用，确认生成)
        // ctx.fillStyle = 'black'; ctx.font='10px Arial'; ctx.fillText(b.type, px, py);
    });

  }, [cityData]);

  // --- 3. 强制全景 (Force Panorama) ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const pW = containerRef.current.clientWidth;
      const pH = containerRef.current.clientHeight;
      if (pW === 0) return;

      const mapW = MAP_COLS * TILE_SIZE;
      
      // 这里的逻辑：让地图宽度占满屏幕的 90%，无论屏幕多大
      const scale = (pW * 0.9) / mapW;
      
      setViewState({ 
          scale: scale, 
          x: (pW - mapW * scale) / 2, 
          y: (pH - MAP_ROWS * TILE_SIZE * scale) / 2 
      });
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#dcedc8] relative overflow-hidden select-none">
      <div className="absolute origin-center transition-transform duration-500 ease-out"
        style={{ width: MAP_COLS*TILE_SIZE, height: MAP_ROWS*TILE_SIZE, transform: `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})` }}>
        
        <canvas ref={canvasRef} className="absolute inset-0 z-0 shadow-2xl rounded-lg" />

        {agents.map((agent: any) => {
            const tx = (agent.x/100)*MAP_COLS, ty = (agent.y/100)*MAP_ROWS;
            return (
                <div key={agent.id} className="absolute z-20 transition-all duration-[1000ms] ease-linear"
                    style={{ left: tx*TILE_SIZE, top: ty*TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                    <div className="relative w-full h-full flex flex-col items-center justify-center -translate-y-1/2">
                        {/* 名字标签 */}
                        <div className="absolute top-[-10px] bg-white/90 px-1.5 py-0.5 rounded shadow-sm text-[8px] font-bold text-stone-700 whitespace-nowrap">
                            {agent.name}
                        </div>
                        {/* 角色 Token */}
                        <div className={`w-4 h-4 rounded-full border-2 border-white shadow-md flex items-center justify-center ${agent.job.includes('建筑')?'bg-orange-400':agent.job.includes('领袖')?'bg-blue-500':'bg-emerald-500'}`}>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}