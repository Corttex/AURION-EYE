import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { EyeModuleId, EyeState } from '@aurion/shared-protocol';
import { RADIAL_NODES } from './RadialHub';

export interface GalaxyMemoryItem {
  id: string;
  scope: string;
  fact_text: string;
  importance: number;
  updated_at?: string;
}

interface AurionGalaxyStageProps {
  eyeState: EyeState;
  activeModule: EyeModuleId;
  memories: GalaxyMemoryItem[];
  onSelectModule: (id: EyeModuleId) => void;
  onMinimize: () => void;
}

interface AmbientStar {
  ring: number;
  baseAngle: number;
  speed: number;
  size: number;
  alpha: number;
  lenteRadius: number;
}

interface GalaxyEntityDot {
  kind: 'module' | 'memory';
  id: string;
  label: string;
  moduleId?: EyeModuleId;
  memory?: GalaxyMemoryItem;
  ring: number;
  baseAngle: number;
  speed: number;
  color: string;
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const AurionGalaxyStage: React.FC<AurionGalaxyStageProps> = ({
  eyeState,
  activeModule,
  memories,
  onSelectModule,
  onMinimize,
}) => {
  const [viewMode, setViewMode] = useState<'disco' | 'lente'>('disco');
  const [hoveredModule, setHoveredModule] = useState<EyeModuleId | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<GalaxyMemoryItem | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const morphRef = useRef(0);
  const targetMorphRef = useRef(0);
  targetMorphRef.current = viewMode === 'lente' ? 1 : 0;

  const hoverModuleRef = useRef<EyeModuleId | null>(null);
  hoverModuleRef.current = hoveredModule || activeModule;

  const eyeStateRef = useRef<EyeState>(eyeState);
  eyeStateRef.current = eyeState;

  const pointerRef = useRef({ x: 0, y: 0, active: false, boost: 0 });
  const entityScreenCoordsRef = useRef<Array<{ x: number; y: number; dot: GalaxyEntityDot }>>([]);

  // Airy, clean cosmic dust background (220 subtle micro-stars so the real entity dots stand out clearly)
  const ambientStars = useMemo<AmbientStar[]>(() => {
    const list: AmbientStar[] = [];
    for (let i = 0; i < 220; i++) {
      const r1 = seededRand(i * 3 + 1);
      const r2 = seededRand(i * 3 + 2);
      const r3 = seededRand(i * 3 + 3);
      const ringNorm = Math.pow(r1, 1.25);
      list.push({
        ring: 46 + ringNorm * 145,
        baseAngle: r2 * Math.PI * 2,
        speed: 0.025 + (1 - ringNorm) * 0.075,
        size: 0.55 + r3 * 0.9,
        alpha: 0.14 + (1 - ringNorm) * 0.34,
        lenteRadius: 56 + Math.pow(r1, 0.85) * 180,
      });
    }
    return list;
  }, []);

  // Each dot in the galaxy represents ONE real thing (function, memory, config) — grows organically as you add more!
  const entityDots = useMemo<GalaxyEntityDot[]>(() => {
    const moduleDots: GalaxyEntityDot[] = RADIAL_NODES.map((node, idx) => ({
      kind: 'module',
      id: `dot-${node.id}`,
      label: node.label,
      moduleId: node.id,
      ring: 68 + ((idx * 17) % 88),
      baseAngle: (idx / RADIAL_NODES.length) * Math.PI * 2 - 0.5,
      speed: 0.032 + (idx % 3) * 0.012,
      color: '#F0ABFC',
    }));

    const memoryDots: GalaxyEntityDot[] = memories.map((mem, idx) => ({
      kind: 'memory',
      id: mem.id,
      label: mem.scope,
      memory: mem,
      ring: 82 + ((idx * 29) % 94),
      baseAngle: (idx / Math.max(1, memories.length)) * Math.PI * 2 + 0.8,
      speed: 0.024 + (idx % 4) * 0.009,
      color: '#C084FC',
    }));

    return [...moduleDots, ...memoryDots];
  }, [memories]);

  const entityDotsRef = useRef(entityDots);
  entityDotsRef.current = entityDots;

  const arcItems = useMemo(() => {
    return RADIAL_NODES.map((node, idx) => {
      const t = idx / (RADIAL_NODES.length - 1);
      const deg = -60 + t * 120;
      const rad = (deg * Math.PI) / 180;
      return { node, idx, deg, rad };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let simTime = 0;
    let lastNow = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      morphRef.current += (targetMorphRef.current - morphRef.current) * 0.045;
      const morph = morphRef.current;

      const targetBoost = pointerRef.current.active ? 1 : 0;
      pointerRef.current.boost += (targetBoost - pointerRef.current.boost) * 0.045;

      const stateRate =
        eyeStateRef.current === 'THINKING'
          ? 1.85
          : eyeStateRef.current === 'SPEAKING'
          ? 1.35
          : 0.65;

      simTime += dt * stateRate * (1 + pointerRef.current.boost * 0.85);

      const cx = w * 0.32;
      const cy = h * 0.53;

      const scaleX = 0.54 + morph * 0.48;
      const scaleY = 1.04 + morph * 0.04;
      const tiltRad = -0.14 * (1 - morph);
      const cosT = Math.cos(tiltRad);
      const sinT = Math.sin(tiltRad);

      // Deep cosmic purple ambient glow
      const bgGlow = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * 0.44);
      bgGlow.addColorStop(0, 'rgba(192, 38, 211, 0.24)');
      bgGlow.addColorStop(0.32, 'rgba(126, 34, 206, 0.11)');
      bgGlow.addColorStop(0.68, 'rgba(59, 7, 100, 0.03)');
      bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // Faint concentric orbital tracks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tiltRad);
      for (let r = 56; r <= 184; r += 16) {
        const ringAlpha = (0.05 + (1 - (r - 56) / 140) * 0.08) * (1 - morph * 0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * scaleX, r * scaleY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217, 70, 239, ${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      ctx.restore();

      // Subtle background micro-stars
      for (let i = 0; i < ambientStars.length; i++) {
        const p = ambientStars[i];
        const angle = p.baseAngle + simTime * p.speed;
        const rad = p.ring * (1 - morph) + p.lenteRadius * morph;
        const lx = Math.cos(angle) * rad * scaleX;
        const ly = Math.sin(angle) * rad * scaleY;
        const px = cx + lx * cosT - ly * sinT;
        const py = cy + lx * sinT + ly * cosT;

        ctx.fillStyle = `rgba(216, 180, 254, ${p.alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Each Real Entity Dot + Fixed Rotating Line Anchored to its Galaxy Dot
      const dots = entityDotsRef.current;
      const screenCoords: Array<{ x: number; y: number; dot: GalaxyEntityDot }> = [];

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const angle = dot.baseAngle + simTime * dot.speed;
        const rad = dot.ring + morph * 28;
        const lx = Math.cos(angle) * rad * (scaleX * 1.04);
        const ly = Math.sin(angle) * rad * (scaleY * 0.96);
        const dx = cx + lx * cosT - ly * sinT;
        const dy = cy + lx * sinT + ly * cosT;
        screenCoords.push({ x: dx, y: dy, dot });

        if (dot.kind === 'module' && dot.moduleId) {
          const arcMatch = arcItems.find((a) => a.node.id === dot.moduleId);
          if (arcMatch) {
            const btnX = w * (0.33 + Math.cos(arcMatch.rad) * 0.33);
            const btnY = h * (0.53 + Math.sin(arcMatch.rad) * 0.43);
            const isActive = hoverModuleRef.current === dot.moduleId;

            // Line stays FIXED/LOCKED onto the rotating galaxy dot and sweeps smoothly with it!
            ctx.beginPath();
            const midX = (btnX + dx) * 0.5 + (cy - dy) * 0.1;
            const midY = (btnY + dy) * 0.5 - (btnX - dx) * 0.06;
            ctx.moveTo(btnX, btnY);
            ctx.quadraticCurveTo(midX, midY, dx, dy);
            ctx.strokeStyle = isActive
              ? 'rgba(250, 232, 255, 0.85)'
              : 'rgba(192, 38, 211, 0.24)';
            ctx.lineWidth = isActive ? 1.5 : 0.85;
            ctx.stroke();
          }
        } else if (dot.kind === 'memory') {
          // Memory dots connect cleanly to the MEMÓRIA orbital button
          const memArc = arcItems.find((a) => a.node.id === 'notes');
          if (memArc) {
            const btnX = w * (0.33 + Math.cos(memArc.rad) * 0.33);
            const btnY = h * (0.53 + Math.sin(memArc.rad) * 0.43);
            const isMemActive = hoverModuleRef.current === 'notes' || morph > 0.35;
            ctx.beginPath();
            ctx.moveTo(btnX, btnY);
            ctx.quadraticCurveTo((btnX + dx) * 0.5, (btnY + dy) * 0.5 - 18, dx, dy);
            ctx.strokeStyle = isMemActive
              ? 'rgba(232, 121, 249, 0.55)'
              : 'rgba(168, 85, 247, 0.16)';
            ctx.lineWidth = isMemActive ? 1.1 : 0.65;
            ctx.stroke();
          }
        }

        // Draw prominent glowing entity star-dot in the galaxy
        const isHighlighted =
          (dot.kind === 'module' && hoverModuleRef.current === dot.moduleId) ||
          (dot.kind === 'memory' && (hoverModuleRef.current === 'notes' || morph > 0.35));

        const glowR = isHighlighted ? 11 : 6.5;
        const g = ctx.createRadialGradient(dx, dy, 0.5, dx, dy, glowR);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(0.35, dot.color);
        g.addColorStop(1, 'rgba(192, 38, 211, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(dx, dy, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      entityScreenCoordsRef.current = screenCoords;

      // Pure Pitch-Black Event Horizon Sphere + White-Lilac Photon Ring
      const bhR = 26 + morph * 15;
      const photonGrad = ctx.createRadialGradient(cx, cy, bhR * 0.92, cx, cy, bhR * 1.5);
      photonGrad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      photonGrad.addColorStop(0.24, 'rgba(245, 208, 254, 0.78)');
      photonGrad.addColorStop(0.56, 'rgba(192, 38, 211, 0.32)');
      photonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = photonGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(250, 232, 255, 0.92)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR + 0.4, 0, Math.PI * 2);
      ctx.stroke();

      // Official AURION "A" Emblem suspended inside the Black Hole
      ctx.save();
      ctx.translate(cx, cy);
      const aScale = (bhR / 34) * 0.62;
      ctx.scale(aScale, aScale);
      ctx.fillStyle = 'rgba(245, 208, 254, 0.92)';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(-18.5, 16.5);
      ctx.lineTo(-10.2, 16.5);
      ctx.lineTo(0, -5.5);
      ctx.lineTo(4.6, 3.6);
      ctx.lineTo(11, 1.2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(7.4, 8.2);
      ctx.lineTo(11.6, 16.5);
      ctx.lineTo(19.8, 16.5);
      ctx.lineTo(14, 4.8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-17.5, 16.5);
      ctx.bezierCurveTo(-6.5, 3.6, 9.2, -3.6, 28.5, -8.2);
      ctx.bezierCurveTo(12.8, -0.8, -1.8, 7.4, -10.2, 16.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ambientStars, arcItems]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = rect.width * 0.32;
    const cy = rect.height * 0.53;
    if (Math.hypot(clickX - cx, clickY - cy) < 32) {
      onMinimize();
      return;
    }

    let closest: GalaxyEntityDot | null = null;
    let minD = 22;
    for (const item of entityScreenCoordsRef.current) {
      const d = Math.hypot(clickX - item.x, clickY - item.y);
      if (d < minD) {
        minD = d;
        closest = item.dot;
      }
    }
    if (closest?.kind === 'module' && closest.moduleId) {
      onSelectModule(closest.moduleId);
    } else if (closest?.kind === 'memory' && closest.memory) {
      setSelectedMemory(closest.memory);
    }
  };

  return (
    <div
      className="relative flex-1 h-full overflow-hidden select-none aurion-galaxy-enter"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointerRef.current.x = e.clientX - rect.left;
        pointerRef.current.y = e.clientY - rect.top;
        pointerRef.current.active = true;
      }}
      onMouseLeave={() => {
        pointerRef.current.active = false;
      }}
    >
      {/* Top DISCO | LENTE Pill Switch */}
      <div className="absolute top-3 left-[32%] -translate-x-1/2 z-30 flex items-center p-0.5 rounded-full bg-black/85 border border-[#C026D3]/50 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.28)]">
        <button
          type="button"
          onClick={() => setViewMode('disco')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.18em] uppercase transition-all duration-500 ${
            viewMode === 'disco'
              ? 'bg-[#C026D3]/40 text-white border border-[#F0ABFC]/80 shadow-[0_0_12px_rgba(232,121,249,0.55)]'
              : 'text-zinc-400 hover:text-white border border-transparent'
          }`}
        >
          DISCO
        </button>
        <button
          type="button"
          onClick={() => setViewMode('lente')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.18em] uppercase transition-all duration-500 ${
            viewMode === 'lente'
              ? 'bg-[#C026D3]/40 text-white border border-[#F0ABFC]/80 shadow-[0_0_12px_rgba(232,121,249,0.55)]'
              : 'text-zinc-400 hover:text-white border border-transparent'
          }`}
        >
          LENTE
        </button>
      </div>

      {/* Live 60FPS Particle Galaxy Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="absolute inset-0 w-full h-full cursor-pointer"
      />

      {/* Curved Orbital Arc with Moving Fractal 3D Purple Glass Icons + Legible Labels */}
      <div className="absolute inset-0 pointer-events-none">
        {arcItems.map(({ node, idx, rad }) => {
          const isSelected = activeModule === node.id;
          const isHovered = hoveredModule === node.id;
          const xPct = 33 + Math.cos(rad) * 33;
          const yPct = 53 + Math.sin(rad) * 43;

          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setHoveredModule(node.id)}
              onMouseLeave={() => setHoveredModule(null)}
              onClick={() => onSelectModule(node.id)}
              style={{
                left: `${xPct.toFixed(1)}%`,
                top: `${yPct.toFixed(1)}%`,
                transitionDelay: `${idx * 20}ms`,
              }}
              className="pointer-events-auto group absolute -translate-y-1/2 flex items-center gap-2.5 focus:outline-none transition-all duration-400"
            >
              {/* 3D Glass Icon Badge with Live Animated Fractal Mandala Backdrop */}
              <div
                className={`relative w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-400 ${
                  isSelected || isHovered ? 'scale-110 -translate-y-0.5' : ''
                }`}
                style={{
                  background:
                    isSelected || isHovered
                      ? 'linear-gradient(145deg, #D946EF 0%, #7E22CE 52%, #1E0536 100%)'
                      : 'linear-gradient(145deg, #3B0764 0%, #170329 65%, #07010D 100%)',
                  boxShadow:
                    isSelected || isHovered
                      ? 'inset 0 2px 3px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(20,2,36,0.9), 0 6px 18px rgba(217,70,239,0.55), 0 0 0 1px rgba(250,232,255,0.85)'
                      : 'inset 0 1.5px 2px rgba(245,208,254,0.32), inset 0 -3px 5px rgba(0,0,0,0.9), 0 4px 12px rgba(0,0,0,0.85), 0 0 0 1px rgba(192,38,211,0.45)',
                }}
              >
                {/* Live Rotating Geometric Fractal Backdrop */}
                <svg
                  viewBox="0 0 40 40"
                  className="absolute inset-0 w-full h-full pointer-events-none animate-spin-slow opacity-75"
                  style={{ animationDuration: isSelected || isHovered ? '6s' : '16s' }}
                >
                  <polygon
                    points="20,3 35,29 5,29"
                    fill="none"
                    stroke="#F0ABFC"
                    strokeWidth="0.85"
                    strokeOpacity="0.65"
                  />
                  <polygon
                    points="20,37 5,11 35,11"
                    fill="none"
                    stroke="#C084FC"
                    strokeWidth="0.85"
                    strokeOpacity="0.55"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="11"
                    fill="none"
                    stroke="#FAE8FF"
                    strokeWidth="0.65"
                    strokeDasharray="3 2"
                    strokeOpacity="0.5"
                  />
                </svg>

                {/* Top 3D Specular Glass Highlight */}
                <span className="absolute top-[2px] left-[4px] right-[4px] h-[36%] rounded-t-lg bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />

                <node.Icon
                  className={`relative z-10 w-4 h-4 transition-colors ${
                    isSelected || isHovered
                      ? 'text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.85)]'
                      : 'text-[#F5D0FE] group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]'
                  }`}
                />
              </div>

              {/* Crisp, High-Contrast Legible Text Label */}
              <div
                className={`px-2.5 py-1 rounded-lg border backdrop-blur-md transition-all duration-300 text-left ${
                  isSelected
                    ? 'bg-[#260642]/95 border-[#F0ABFC]/80 shadow-[0_0_16px_rgba(217,70,239,0.4)]'
                    : isHovered
                    ? 'bg-[#150424]/95 border-[#C026D3]/65 translate-x-0.5'
                    : 'bg-black/80 border-white/10 hover:border-[#C026D3]/45'
                }`}
              >
                <div
                  className={`text-[12px] font-semibold tracking-wide leading-tight whitespace-nowrap ${
                    isSelected ? 'text-white' : 'text-zinc-100'
                  }`}
                >
                  {node.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Floating Memory Preview Card */}
      {selectedMemory && (
        <div className="aurion-panel-switch absolute bottom-4 left-4 max-w-[240px] p-3 rounded-xl bg-black/95 border border-[#C026D3]/65 backdrop-blur-xl shadow-[0_0_28px_rgba(168,85,247,0.35)] z-30">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#F0ABFC]">
              {selectedMemory.scope}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMemory(null)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-zinc-100 leading-relaxed">{selectedMemory.fact_text}</p>
        </div>
      )}
    </div>
  );
};
