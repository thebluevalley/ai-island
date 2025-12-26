'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. 字符集 ---
const CHARS: any = {
  EMPTY: ' ', GRASS: '·', TREE: '♣', WATER: '≈', 
  
  // 道路系统
  ROAD_MAIN_H: '═', ROAD_MAIN_V: '║', ROAD_MAIN_C: '╬', // 主干道
  ROAD_SUB_H:  '─', ROAD_SUB_V:  '│', ROAD_SUB_C:  '┼', // 街区内干道
  PATH:        '░', // 连接建筑物的小径
  
  // 建筑
  WALL: '#', DOOR: '+', FLOOR: ' ',
};

// --- 2. 配色 (保持莫兰迪淡雅风) ---
const COLORS: any = {
  BG:        '#23242a', 
  BG_GRASS:  '#2b2d35', FG_GRASS: '#4a505c', 
  FG_FOREST: '#68856c', FG_WATER: '#6a9fb5', 
  
  // 道路
  FG_ROAD_MAIN: '#8c92a3', // 亮灰
  FG_ROAD_SUB:  '#5c6370', // 中灰
  FG_PATH:      '#8d6e63', // 泥土色小径

  // 建筑 (粉彩)
  FG_RES_WALL: '#d4b595', FG_RES_DOOR: '#cc8c6c', 
  FG_COM_WALL: '#8abeb7', FG_COM_DOOR: '#5e8d87',
  FG_CIV_WALL: '#b294bb', FG_CIV_DOOR: '#817299',
  BG_BLDG:     '#1e1f24', 
};

// === 核心修改：7x4 超宽网格 ===
const BLOCK_W = 26; // 单个街区宽
const BLOCK_H = 20; // 单个街区高
const GRID_COLS = 7; // 横向 7 个
const GRID_ROWS = 4; // 纵向 4 个

const MAP_COLS = BLOCK_W * GRID_COLS; // 182
const MAP_ROWS = BLOCK_H * GRID_ROWS; // 80

// 伪随机 (保持前后端一致)
const random = (x: number, y: number) => {
    let sin = Math.sin(x * 12.9898 + y * 78.233);
    return sin - Math.floor(sin);
};

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const { agents } = worldData || { agents: [] };

  const mapData = useMemo(() => {
    const grid = new Array(MAP_COLS * MAP_ROWS).fill(0).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS, isRoad: false 
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string, isRoad=false) => {
        if(x>=0 && x<MAP_COLS && y>=0 && y<MAP_ROWS) {
            const idx = y*MAP_COLS+x;
            grid[idx].char = char; grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
            grid[idx].isRoad = isRoad;
        }
    };

    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string, isRoad=false) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg, isRoad);
    };

    // 智能修路：从 (x1, y1) 修一条小径到最近的道路或目标点 (x2, y2)
    // 简化版：画折线
    const drawPath = (x1: number, y1: number, x2: number, y2: number) => {
        // 先横后竖
        let currX = x1, currY = y1;
        while(currX !== x2) {
            currX += (x2 > currX ? 1 : -1);
            if (!grid[currY*MAP_COLS+currX].isRoad) setCell(currX, currY, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS);
        }
        while(currY !== y2) {
            currY += (y2 > currY ? 1 : -1);
            if (!grid[currY*MAP_COLS+currX].isRoad) setCell(currX, currY, CHARS.PATH, COLORS.FG_PATH, COLORS.BG_GRASS);
        }
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }

        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#333', COLORS.BG_BLDG);
        
        // 门的位置 (下边框中间)
        const doorX = x + Math.floor(w/2);
        const doorY = y + h - 1;
        setCell(doorX, doorY, CHARS.DOOR, doorColor, COLORS.BG_BLDG);

        return { doorX, doorY }; // 返回门坐标以便修路
    };

    // === Step 1: 7x4 主干路网 ===
    const mainRoadW = 2;
    // 竖路
    for(let i=0; i<=GRID_COLS; i++) {
        let x = i * BLOCK_W;
        if (i === GRID_COLS) x -= mainRoadW; // 最后一根线往里收
        fillRect(x, 0, mainRoadW, MAP_ROWS, CHARS.ROAD_MAIN_V, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    // 横路
    for(let i=0; i<=GRID_ROWS; i++) {
        let y = i * BLOCK_H;
        if (i === GRID_ROWS) y -= mainRoadW;
        fillRect(0, y, MAP_COLS, mainRoadW, CHARS.ROAD_MAIN_H, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }
    // 交叉口
    for(let x=0; x<=GRID_COLS; x++) for(let y=0; y<=GRID_ROWS; y++) {
        let px = x*BLOCK_W, py = y*BLOCK_H;
        if(x===GRID_COLS) px -= mainRoadW; if(y===GRID_ROWS) py -= mainRoadW;
        fillRect(px, py, mainRoadW, mainRoadW, CHARS.ROAD_MAIN_C, COLORS.FG_ROAD_MAIN, COLORS.BG_GRASS, true);
    }

    // === Step 2: 填充 28 个街区 ===
    for (let by=0; by<GRID_ROWS; by++) {
        for (let bx=0; bx<GRID_COLS; bx++) {
            
            // 街区内部可用区域
            const sx = bx * BLOCK_W + mainRoadW;
            const sy = by * BLOCK_H + mainRoadW;
            const sw = BLOCK_W - mainRoadW; // 24
            const sh = BLOCK_H - mainRoadW; // 18

            const centerX = sx + sw/2;
            const centerY = sy + sh/2;

            // 中心公园 (固定位置)
            if (bx === 3 && by === 1) {
                // 森林填充
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.4) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
                // 中心大湖
                fillRect(sx+4, sy+4, sw-8, sh-8, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
                continue;
            }

            // 判断类型：交错分布，中心偏向公共
            const isCivic = ((bx+by)%3 === 0) || (bx===3 && by===2);

            if (isCivic) {
                // === A. 公共建筑地块 (2-4 栋 + 绿化 + 小路) ===
                
                // 1. 先种满绿化 (除了路)
                for(let iy=sy; iy<sy+sh; iy++) for(let ix=sx; ix<sx+sw; ix++) {
                    if (random(ix, iy) > 0.6) setCell(ix, iy, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }

                // 2. 划分 4 个象限 (2x2)
                const qW = Math.floor(sw/2);
                const qH = Math.floor(sh/2);
                const quadrants = [
                    {x: sx, y: sy}, {x: sx+qW, y: sy},
                    {x: sx, y: sy+qH}, {x: sx+qW, y: sy+qH}
                ];

                // 3. 随机选 2-4 个象限放建筑
                const count = 2 + Math.floor(random(bx, by) * 2.9); // 2, 3, 4
                
                for(let i=0; i<count; i++) {
                    const q = quadrants[i]; // 简单按顺序取，保证不重叠
                    // 随机大小
                    const bW = 8 + Math.floor(random(q.x, q.y)*5); // 8-12
                    const bH = 6 + Math.floor(random(q.y, q.x)*3); // 6-8
                    
                    // 居中放置
                    const bX = q.x + Math.floor((qW-bW)/2);
                    const bY = q.y + Math.floor((qH-bH)/2);
                    
                    const type = i===0 ? 'CIV' : 'COM'; // 混合类型
                    const { doorX, doorY } = drawBuilding(bX, bY, bW, bH, type);

                    // 4. 修路：连接到街区边界的中心
                    // 找最近的街区边界
                    let targetX = sx + sw/2; 
                    let targetY = sy + sh; // 默认向下连
                    
                    // 简单逻辑：连到街区中心点，中心点通常有路或通向路
                    drawPath(doorX, doorY + 1, doorX, doorY + 2); // 先出门
                    drawPath(doorX, doorY + 2, centerX, centerY); // 连到街区中心
                }
                
                // 确保街区中心有路通向主干道
                drawPath(Math.floor(centerX), Math.floor(centerY), Math.floor(centerX), sy+sh);

            } else {
                // === B. 居住地块 (5-8 栋 + 内部道路网) ===
                
                // 1. 修筑内部道路网 ("日"字型 或 "H"型)
                // 横向中路
                fillRect(sx, Math.floor(sy+sh/2), sw, 1, CHARS.ROAD_SUB_H, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
                // 纵向中路
                fillRect(Math.floor(sx+sw/2), sy, 1, sh, CHARS.ROAD_SUB_V, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);
                // 交叉点
                setCell(Math.floor(sx+sw/2), Math.floor(sy+sh/2), CHARS.ROAD_SUB_C, COLORS.FG_ROAD_SUB, COLORS.BG_GRASS, true);

                // 2. 划分为 4-6 个小格放置房屋
                // 我们在每个象限尝试放 2 栋
                const subW = Math.floor(sw/2);
                const subH = Math.floor(sh/2);
                
                const zones = [
                    {x: sx, y: sy}, {x: sx+subW, y: sy},
                    {x: sx, y: sy+subH}, {x: sx+subW, y: sy+subH}
                ];

                zones.forEach(z => {
                    // 在这个象限里，尝试放 1-2 栋
                    // 房子尺寸
                    const hW = 5, hH = 4;
                    
                    // 位置1
                    if (random(z.x, z.y) > 0.2) {
                        const x1 = z.x + 1;
                        const y1 = z.y + 1;
                        const {doorX, doorY} = drawBuilding(x1, y1, hW, hH, 'RES');
                        // 连到最近的路 (象限边缘)
                        drawPath(doorX, doorY+1, doorX, Math.floor(sy+sh/2)); 
                    }
                    
                    // 位置2 (错开)
                    if (random(z.x+1, z.y+1) > 0.3) {
                        const x2 = z.x + subW - hW - 1;
                        const y2 = z.y + subH - hH - 1;
                        // 避免和位置1重叠 (简单判断：如果空间够大)
                        if (x2 > z.x + hW + 2 || y2 > z.y + hH + 2) {
                            const {doorX, doorY} = drawBuilding(x2, y2, hW, hH, 'RES');
                            // 连到最近的路
                            drawPath(doorX, doorY+1, Math.floor(sx+sw/2), doorY+1);
                        }
                    }
                });
            }
        }
    }

    return grid;
  }, []);

  // --- Rendering ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            const charW = width / MAP_COLS;
            const charH = height / MAP_ROWS;
            // 确保填满宽屏
            const size = Math.floor(Math.min(charW / 0.6, charH));
            setFontSize(Math.max(6, size));
        }
    });
    resizeObserver.observe(container);

    const ctx = canvas.getContext('2d');
    if(ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        const metrics = ctx.measureText('M');
        const charW = metrics.width;
        const charH = fontSize;

        const w = MAP_COLS * charW;
        const h = MAP_ROWS * charH;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        
        // 关键：强制填满容器
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'fill'; // 拉伸以填满 (因为字符比例可能不完美匹配容器)

        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, w, h);
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textBaseline = 'top';

        mapData.forEach((cell: any, idx: number) => {
            const x = (idx % MAP_COLS) * charW;
            const y = Math.floor(idx / MAP_COLS) * charH;
            if (cell.bg) { ctx.fillStyle = cell.bg; ctx.fillRect(x, y, charW+0.5, charH+0.5); }
            if (cell.char !== ' ') { ctx.fillStyle = cell.fg; ctx.fillText(cell.char, x, y); }
        });

        // Agents
        agents.forEach((agent: any) => {
            const tx = Math.floor((agent.x / 100) * MAP_COLS);
            const ty = Math.floor((agent.y / 100) * MAP_ROWS);
            if(tx>=0 && tx<MAP_COLS && ty>=0 && ty<MAP_ROWS) {
                const x = tx * charW;
                const y = ty * charH;
                ctx.fillStyle = '#fff';
                ctx.fillText('@', x, y);
            }
        });
    }
    return () => resizeObserver.disconnect();
  }, [fontSize, mapData, agents]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#23242a] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
}