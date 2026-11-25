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

interface OrbitParticle {
  ring: number;
  baseAngle: number;
  speed: number;
  size: number;
  alpha: number;
  hueMix: number;
  lenteRadius: number;
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
  const memoryScreenCoordsRef = useRef<Array<{ x: number; y: number; mem: GalaxyMemoryItem }>>([]);

  const particles = useMemo<OrbitParticle[]>(() => {
    const list: OrbitParticle[] = [];
    for (let i = 0; i < 820; i++) {
      const r1 = seededRand(i * 3 + 1);
      const r2 = seededRand(i * 3 + 2);
      const r3 = seededRand(i * 3 + 3);
      const r4 = seededRand(i * 3 + 4);

      const ringIndex = Math.pow(r1, 1.35);
      const baseRing = 44 + ringIndex * 145;
      const keplerSpeed = (0.04 + (1 - ringIndex) * 0.12) * (0.8 + r2 * 0.4);

      list.push({
        ring: baseRing,
        baseAngle: r2 * Math.PI * 2,
        speed: keplerSpeed,
        size: r3 > 0.94 ? 2.1 : 0.65 + r3 * 1.1,
        alpha: 0.24 + (1 - ringIndex) * 0.58 + r4 * 0.16,
        hueMix: r4,
        lenteRadius: 56 + Math.pow(r1, 0.85) * 180,
      });
    }
    return list;
  }, []);

  const memoryNodes = useMemo(() => {
    const safeMems =
      memories.length > 0
        ? memories
        : [
            {
              id: 'm_default_1',
              scope: 'vps:hetzner-main',
              fact_text: 'Hetzner 16GB/80GB conectada ao Coolify • Gateway :3011 ativo.',
              importance: 9,
            },
            {
              id: 'm_default_2',
              scope: 'project:aurion',
              fact_text: 'Pool de 11 APIs gratuitas + Hermes 3 + ElevenLabs + Humanizer PT-BR.',
              importance: 9,
            },
          ];

    return safeMems.map((mem, idx) => {
      const angle = (idx / Math.max(1, safeMems.length)) * Math.PI * 2 + 0.45;
      const ring = 66 + ((idx * 31) % 92);
      return { mem, angle, ring, speed: 0.028 + (idx % 4) * 0.008 };
    });
  }, [memories]);

  const memoryNodesRef = useRef(memoryNodes);
  memoryNodesRef.current = memoryNodes;

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
          ? 1.9
          : eyeStateRef.current === 'SPEAKING'
          ? 1.35
          : 0.65;

      simTime += dt * stateRate * (1 + pointerRef.current.boost * 1.0);

      // Center of the Purple Black Hole on the left-center of the stage
      const cx = w * 0.32;
      const cy = h * 0.53;

      const scaleX = 0.54 + morph * 0.48;
      const scaleY = 1.04 + morph * 0.04;
      const tiltRad = -0.14 * (1 - morph);
      const cosT = Math.cos(tiltRad);
      const sinT = Math.sin(tiltRad);

      // Deep cosmic purple glow
      const bgGlow = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * 0.45);
      bgGlow.addColorStop(0, 'rgba(192, 38, 211, 0.26)');
      bgGlow.addColorStop(0.32, 'rgba(126, 34, 206, 0.12)');
      bgGlow.addColorStop(0.68, 'rgba(59, 7, 100, 0.04)');
      bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // Concentric faint orbit rings
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tiltRad);
      for (let r = 52; r <= 185; r += 14) {
        const ringAlpha = (0.045 + (1 - (r - 52) / 145) * 0.085) * (1 - morph * 0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * scaleX, r * scaleY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217, 70, 239, ${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      ctx.restore();

      // 820 Orbiting Cosmic Purple/Orchid/White Star-Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const angle = p.baseAngle + simTime * p.speed;
        const rad = p.ring * (1 - morph) + p.lenteRadius * morph;

        const lx = Math.cos(angle) * rad * scaleX;
        const ly = Math.sin(angle) * rad * scaleY;

        let px = cx + lx * cosT - ly * sinT;
        let py = cy + lx * sinT + ly * cosT;

        if (pointerRef.current.boost > 0.01) {
          const dx = px - pointerRef.current.x;
          const dy = py - pointerRef.current.y;
          const dist2 = dx * dx + dy * dy + 2200;
          const warp = (1400 * pointerRef.current.boost) / dist2;
          px += dx * warp * 0.15;
          py += dy * warp * 0.15;
        }

        const closeness = Math.max(0, 1 - (rad - 44) / 150);
        const rCol = Math.round(150 + closeness * 105 + p.hueMix * 20);
        const gCol = Math.round(52 + closeness * 165 * (p.hueMix > 0.6 ? 1 : 0.65));
        const bCol = Math.round(218 + closeness * 37);

        const alpha = Math.min(0.95, p.alpha * (0.7 + closeness * 0.55));
        ctx.fillStyle = `rgba(${Math.min(255, rCol)}, ${Math.min(255, gCol)}, ${Math.min(255, bCol)}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (0.85 + morph * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }

      // Luminous curved filaments connecting the hovered/active 3D orbital button -> Memory Stars
      const activeIdx = Math.max(
        0,
        arcItems.findIndex((a) => a.node.id === hoverModuleRef.current)
      );
      const activeArc = arcItems[activeIdx];
      const srcX = w * (0.33 + Math.cos(activeArc.rad) * 0.33);
      const srcY = h * (0.53 + Math.sin(activeArc.rad) * 0.43);

      const memCoords: Array<{ x: number; y: number; mem: GalaxyMemoryItem }> = [];
      const currentMemNodes = memoryNodesRef.current;

      for (let m = 0; m < currentMemNodes.length; m++) {
        const mn = currentMemNodes[m];
        const a = mn.angle + simTime * mn.speed;
        const r = mn.ring * (1 - morph * 0.1) + morph * 28;
        const lx = Math.cos(a) * r * (scaleX * 1.05);
        const ly = Math.sin(a) * r * (scaleY * 0.92);
        const mx = cx + lx * cosT - ly * sinT;
        const my = cy + lx * sinT + ly * cosT;
        memCoords.push({ x: mx, y: my, mem: mn.mem });

        ctx.beginPath();
        const midX = (srcX + mx) * 0.5 + (cy - my) * 0.12;
        const midY = (srcY + my) * 0.5 - (srcX - mx) * 0.08;
        ctx.moveTo(srcX, srcY);
        ctx.quadraticCurveTo(midX, midY, mx, my);
        ctx.strokeStyle = morph > 0.35 ? 'rgba(240, 171, 252, 0.55)' : 'rgba(232, 121, 249, 0.36)';
        ctx.lineWidth = morph > 0.35 ? 1.3 : 1.0;
        ctx.stroke();

        const glowR = morph > 0.35 ? 10 : 6.5;
        const starGrad = ctx.createRadialGradient(mx, my, 0.5, mx, my, glowR);
        starGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        starGrad.addColorStop(0.35, 'rgba(240, 171, 252, 0.85)');
        starGrad.addColorStop(1, 'rgba(192, 38, 211, 0)');
        ctx.fillStyle = starGrad;
        ctx.beginPath();
        ctx.arc(mx, my, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      memoryScreenCoordsRef.current = memCoords;

      // Pure Pitch-Black Event Horizon Sphere + White-Lilac Photon Ring
      const bhR = 26 + morph * 16;

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

      // Official AURION "A" Emblem suspended inside the Pitch-Black Event Horizon
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
  }, [particles, arcItems]);

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

    let closest: GalaxyMemoryItem | null = null;
    let minD = 26;
    for (const item of memoryScreenCoordsRef.current) {
      const d = Math.hypot(clickX - item.x, clickY - item.y);
      if (d < minD) {
        minD = d;
        closest = item.mem;
      }
    }
    setSelectedMemory(closest);
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

      {/* Curved Orbital Arc with 3D Glossy Purple Glass Icons + High-Contrast Legible Labels */}
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
              {/* 3D Glossy Purple-Obsidian Orb Medallion Icon (AURION Visual ID) */}
              <div
                className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-400 ${
                  isSelected || isHovered ? 'scale-110 -translate-y-0.5' : ''
                }`}
                style={{
                  background:
                    isSelected || isHovered
                      ? 'linear-gradient(145deg, #F0ABFC 0%, #B5179E 45%, #3B0764 100%)'
                      : 'linear-gradient(145deg, #581C87 0%, #24073F 58%, #0B0214 100%)',
                  boxShadow:
                    isSelected || isHovered
                      ? 'inset 0 2px 3px rgba(255,255,255,0.65), inset 0 -3px 6px rgba(45,6,78,0.85), 0 6px 18px rgba(217,70,239,0.55), 0 0 0 1px rgba(250,232,255,0.85)'
                      : 'inset 0 1.5px 2px rgba(245,208,254,0.35), inset 0 -3px 5px rgba(0,0,0,0.9), 0 4px 12px rgba(0,0,0,0.85), 0 0 0 1px rgba(192,38,211,0.45)',
                }}
              >
                {/* 3D Top Glass Specular Dome Highlight */}
                <span className="absolute top-[2px] left-[4px] right-[4px] h-[38%] rounded-t-lg bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                <node.Icon
                  className={`relative z-10 w-4 h-4 transition-colors ${
                    isSelected || isHovered
                      ? 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]'
                      : 'text-[#F5D0FE] group-hover:text-white'
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
