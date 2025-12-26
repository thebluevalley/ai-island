'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';

// --- 1. Seeded Random (Fixes Hydration Mismatch) ---
// A simple deterministic random number generator
let _seed = 12345;
const resetSeed = () => { _seed = 12345; };
const random = () => {
    const x = Math.sin(_seed++) * 10000;
    return x - Math.floor(x);
};

// --- 2. Charset (Geometric) ---
const CHARS: any = {
  EMPTY: ' ',
  GRASS: '·', 
  TREE:  '♣', 
  WATER: '≈', 
  
  // Roads
  ROAD_H: '═', ROAD_V: '║', ROAD_C: '╬',
  
  // Architecture
  WALL: '#', 
  DOOR: '+', 
  FLOOR: '.',
};

// --- 3. Morandi / Elegant Dark Palette ---
const COLORS: any = {
  // Background: Deep Blue-Grey (Eye-friendly)
  BG:        '#23242a', 

  // Environment (Low Saturation)
  BG_GRASS:  '#2b2d35', 
  FG_GRASS:  '#4a505c', 
  FG_FOREST: '#68856c', // Muted Green
  FG_WATER:  '#6a9fb5', // Muted Blue
  FG_ROAD:   '#5c6370', 

  // Building Types (Pastel Tones)
  
  // 1. Residential: Warm Sand / Clay
  FG_RES_WALL: '#d4b595', 
  FG_RES_DOOR: '#cc8c6c', 
  
  // 2. Commercial: Sage / Teal
  FG_COM_WALL: '#8abeb7', 
  FG_COM_DOOR: '#5e8d87',
  
  // 3. Civic: Dusty Purple / Gold
  FG_CIV_WALL: '#b294bb', 
  FG_CIV_DOOR: '#817299',
  
  // Interiors
  BG_BLDG:   '#1e1f24', 
};

const COLS = 100;
const ROWS = 50;

// Custom Landmarks (Size & Type)
const CIVIC_BUILDINGS = [
    { type: 'CIV', w: 16, h: 10, label: 'HALL' }, // City Hall
    { type: 'CIV', w: 14, h: 8,  label: 'LIB'  }, // Library
    { type: 'COM', w: 12, h: 6,  label: 'MKT'  }, // Market
    { type: 'CIV', w: 10, h: 6,  label: 'HOSP' }, // Clinic
    { type: 'COM', w: 8,  h: 6,  label: 'CAFE' }, // Cafe
];

export default function GameMap({ worldData }: { worldData: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const { agents } = worldData || { agents: [] };

  // --- Map Generation Logic ---
  const mapData = useMemo(() => {
    resetSeed(); // Reset seed every render to ensure consistency

    const grid = new Array(COLS * ROWS).fill(null).map(() => ({ 
        char: CHARS.GRASS, fg: COLORS.FG_GRASS, bg: COLORS.BG_GRASS 
    }));
    
    const setCell = (x: number, y: number, char: string, fg: string, bg?: string) => {
        if(x>=0 && x<COLS && y>=0 && y<ROWS) {
            const idx = y*COLS+x;
            grid[idx].char = char; grid[idx].fg = fg;
            if(bg) grid[idx].bg = bg;
        }
    };

    const fillRect = (x: number, y: number, w: number, h: number, char: string, fg: string, bg: string) => {
        for(let iy=y; iy<y+h; iy++) for(let ix=x; ix<x+w; ix++) setCell(ix, iy, char, fg, bg);
    };

    const drawBuilding = (x: number, y: number, w: number, h: number, type: 'RES' | 'COM' | 'CIV') => {
        let wallColor = COLORS.FG_RES_WALL;
        let doorColor = COLORS.FG_RES_DOOR;
        if (type === 'COM') { wallColor = COLORS.FG_COM_WALL; doorColor = COLORS.FG_COM_DOOR; }
        if (type === 'CIV') { wallColor = COLORS.FG_CIV_WALL; doorColor = COLORS.FG_CIV_DOOR; }

        // Walls
        for(let ix=x; ix<x+w; ix++) { setCell(ix, y, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(ix, y+h-1, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        for(let iy=y; iy<y+h; iy++) { setCell(x, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); setCell(x+w-1, iy, CHARS.WALL, wallColor, COLORS.BG_BLDG); }
        // Floor
        fillRect(x+1, y+1, w-2, h-2, CHARS.FLOOR, '#333', COLORS.BG_BLDG);
        // Door
        setCell(x+Math.floor(w/2), y+h-1, CHARS.DOOR, doorColor, COLORS.BG_BLDG);
    };

    // === Layout Algorithm ===
    
    // 1. Spacious Grid (Block size 24x16)
    const blockW = 24; 
    const blockH = 16;
    
    // Draw Roads
    for(let x=0; x<COLS; x+=blockW) fillRect(x, 0, 1, ROWS, CHARS.ROAD_V, COLORS.FG_ROAD, COLORS.BG_GRASS);
    for(let y=0; y<ROWS; y+=blockH) fillRect(0, y, COLS, 1, CHARS.ROAD_H, COLORS.FG_ROAD, COLORS.BG_GRASS);
    for(let x=0; x<COLS; x+=blockW) for(let y=0; y<ROWS; y+=blockH) setCell(x, y, CHARS.ROAD_C, COLORS.FG_ROAD, COLORS.BG_GRASS);

    // 2. Pre-defined Civic Spots (Golden Locations)
    const civicLocs = [
        {bx: 2, by: 1}, // Center
        {bx: 1, by: 1}, // Left
        {bx: 3, by: 1}, // Right
        {bx: 2, by: 2}, // Bottom
        {bx: 1, by: 2}  // Bottom-Left
    ];
    let civicIdx = 0;

    // 3. Iterate Blocks
    for (let by=0; by<Math.floor(ROWS/blockH); by++) {
        for (let bx=0; bx<Math.floor(COLS/blockW); bx++) {
            const x = bx * blockW + 2;
            const y = by * blockH + 2;
            const w = blockW - 3;
            const h = blockH - 3;

            const isCivicSpot = civicLocs.some(loc => loc.bx === bx && loc.by === by);

            // A. Place Unique Civic Buildings
            if (isCivicSpot && civicIdx < CIVIC_BUILDINGS.length) {
                const bldg = CIVIC_BUILDINGS[civicIdx++];
                // Center it
                const cx = x + Math.floor((w - bldg.w)/2);
                const cy = y + Math.floor((h - bldg.h)/2);
                drawBuilding(cx, cy, bldg.w, bldg.h, bldg.type as any);
                
                // Surround with Park
                for(let i=0; i<15; i++) {
                    const tx = x + Math.floor(random()*w);
                    const ty = y + Math.floor(random()*h);
                    if (tx < cx || tx >= cx+bldg.w || ty < cy || ty >= cy+bldg.h) {
                        setCell(tx, ty, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                    }
                }
            } 
            // B. Central Forest Park (Top Center)
            else if (bx === 2 && by === 0) {
                 for(let i=0; i<60; i++) {
                     setCell(x+Math.floor(random()*w), y+Math.floor(random()*h), CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                 }
                 // Lake
                 fillRect(x+6, y+4, w-12, h-8, CHARS.WATER, COLORS.FG_WATER, COLORS.BG_GRASS);
            }
            // C. Residential (Sparse & Organic)
            else {
                // 60% chance to have houses (creates negative space)
                if (random() > 0.4) {
                    const houseW = 6, houseH = 5;
                    // Main House
                    drawBuilding(x + 2, y + 2, houseW, houseH, 'RES');
                    
                    // Maybe a neighbor?
                    if (random() > 0.5) {
                        drawBuilding(x + w - houseW - 2, y + h - houseH - 2, houseW, houseH, 'RES');
                    }

                    // Garden Trees
                    setCell(x+w-2, y+2, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                    setCell(x+2, y+h-2, CHARS.TREE, COLORS.FG_FOREST, COLORS.BG_GRASS);
                }
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

    // Auto-fit Font Size
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            const charW = width / COLS;
            const charH = height / ROWS;
            const size = Math.floor(Math.min(charW / 0.6, charH));
            setFontSize(Math.max(8, size));
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

        canvas.width = COLS * charW * dpr;
        canvas.height = ROWS * charH * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${COLS * charW}px`;
        canvas.style.height = `${ROWS * charH}px`;

        // Clear Background
        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textBaseline = 'top';

        // 1. Draw Map
        mapData.forEach((cell, idx) => {
            const x = (idx % COLS) * charW;
            const y = Math.floor(idx / COLS) * charH;
            
            if (cell.bg) {
                ctx.fillStyle = cell.bg;
                // +0.5 to fix sub-pixel gaps
                ctx.fillRect(x, y, charW+0.5, charH+0.5);
            }
            if (cell.char !== ' ') {
                ctx.fillStyle = cell.fg;
                ctx.fillText(cell.char, x, y);
            }
        });

        // 2. Draw Agents (High Contrast White)
        agents.forEach((agent: any) => {
            const tx = Math.floor((agent.x / 100) * COLS);
            const ty = Math.floor((agent.y / 100) * ROWS);
            if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                const x = tx * charW;
                const y = ty * charH;
                ctx.fillStyle = '#ffffff';
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