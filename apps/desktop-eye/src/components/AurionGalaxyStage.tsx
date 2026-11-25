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
  lenteAngle: number;
  lenteRadius: number;
  memoryIndex: number; // >= 0 if bound to a real memory node
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const morphRef = useRef(0); // 0 = DISCO, 1 = LENTE (smoothly lerped)
  const targetMorphRef = useRef(0);
  targetMorphRef.current = viewMode === 'lente' ? 1 : 0;

  const hoverModuleRef = useRef<EyeModuleId | null>(null);
  hoverModuleRef.current = hoveredModule || activeModule;

  const eyeStateRef = useRef<EyeState>(eyeState);
  eyeStateRef.current = eyeState;

  const pointerRef = useRef({ x: 0, y: 0, active: false, boost: 0 });
  const memoryScreenCoordsRef = useRef<Array<{ x: number; y: number; mem: GalaxyMemoryItem }>>([]);

  // Pre-generate 920 cosmic particles matching the dense concentric elliptical orbital galaxy in the reference
  const particles = useMemo<OrbitParticle[]>(() => {
    const list: OrbitParticle[] = [];
    const total = 920;
    for (let i = 0; i < total; i++) {
      const r1 = seededRand(i * 3 + 1);
      const r2 = seededRand(i * 3 + 2);
      const r3 = seededRand(i * 3 + 3);
      const r4 = seededRand(i * 3 + 4);

      // Quantize softly into concentric gravitational orbital streams
      const ringIndex = Math.pow(r1, 1.35);
      const baseRing = 56 + ringIndex * 188;
      const keplerSpeed = (0.045 + (1 - ringIndex) * 0.14) * (0.8 + r2 * 0.4);

      list.push({
        ring: baseRing,
        baseAngle: r2 * Math.PI * 2,
        speed: keplerSpeed,
        size: r3 > 0.94 ? 2.2 : 0.7 + r3 * 1.15,
        alpha: 0.22 + (1 - ringIndex) * 0.58 + r4 * 0.18,
        hueMix: r4,
        lenteAngle: r2 * Math.PI * 2,
        lenteRadius: 72 + Math.pow(r1, 0.82) * 235,
        memoryIndex: -1,
      });
    }
    return list;
  }, []);

  // Bind real memories to prominent glowing star-nodes inside the orbit
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
      const ring = 86 + ((idx * 37) % 120);
      return { mem, angle, ring, speed: 0.032 + (idx % 4) * 0.01 };
    });
  }, [memories]);

  const memoryNodesRef = useRef(memoryNodes);
  memoryNodesRef.current = memoryNodes;

  // Compute right-hand curved orbital arc geometry (matching Sagittarius skill arc)
  const arcItems = useMemo(() => {
    return RADIAL_NODES.map((node, idx) => {
      const t = idx / (RADIAL_NODES.length - 1);
      const deg = -56 + t * 112;
      const rad = (deg * Math.PI) / 180;
      return { node, idx, deg, rad };
    });
  }, []);

  // 60FPS Canvas Animation Loop (slow, majestic, zero-jank morphing)
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

      // Slow, silky morph between DISCO (0) and LENTE (1)
      morphRef.current += (targetMorphRef.current - morphRef.current) * 0.045;
      const morph = morphRef.current;

      // Smooth pointer hover velocity boost
      const targetBoost = pointerRef.current.active ? 1 : 0;
      pointerRef.current.boost += (targetBoost - pointerRef.current.boost) * 0.045;

      const stateRate =
        eyeStateRef.current === 'THINKING'
          ? 2.0
          : eyeStateRef.current === 'SPEAKING'
          ? 1.4
          : 0.72;

      simTime += dt * stateRate * (1 + pointerRef.current.boost * 1.1);

      // Center of the Purple Black Hole (shifted slightly left so the right orbital arc breathes)
      const cx = w * 0.42;
      const cy = h * 0.52;

      // Elliptical perspective: tall vertical-tilted disk in DISCO mode (like Sagittarius screenshots!),
      // expanding smoothly into a wide circular constellation in LENTE mode!
      const scaleX = 0.54 + morph * 0.54; // 0.54 (elliptical disk) -> 1.08 (wide lens)
      const scaleY = 1.08 + morph * 0.04;
      const tiltRad = -0.14 * (1 - morph);
      const cosT = Math.cos(tiltRad);
      const sinT = Math.sin(tiltRad);

      // 1. Deep Cosmic Purple Ambient Nebula Glow behind the Black Hole
      const bgGlow = ctx.createRadialGradient(cx, cy, 26, cx, cy, Math.max(w, h) * 0.46);
      bgGlow.addColorStop(0, 'rgba(192, 38, 211, 0.24)');
      bgGlow.addColorStop(0.28, 'rgba(126, 34, 206, 0.12)');
      bgGlow.addColorStop(0.62, 'rgba(59, 7, 100, 0.04)');
      bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // 2. Subtle Concentric Gravitational Orbit Tracks (like the screenshots)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tiltRad);
      for (let r = 64; r <= 232; r += 16) {
        const ringAlpha = (0.045 + (1 - (r - 64) / 180) * 0.09) * (1 - morph * 0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * scaleX, r * scaleY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217, 70, 239, ${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      ctx.restore();

      // 3. Render 920 Orbiting Cosmic Purple/Orchid/White Star-Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const angle = p.baseAngle + simTime * p.speed;
        const rad = p.ring * (1 - morph) + p.lenteRadius * morph;

        let lx = Math.cos(angle) * rad * scaleX;
        let ly = Math.sin(angle) * rad * scaleY;

        // Apply slight disk tilt
        let px = cx + lx * cosT - ly * sinT;
        let py = cy + lx * sinT + ly * cosT;

        // Subtle spacetime lensing bend toward cursor when hovered
        if (pointerRef.current.boost > 0.01) {
          const dx = px - pointerRef.current.x;
          const dy = py - pointerRef.current.y;
          const dist2 = dx * dx + dy * dy + 2200;
          const warp = (1600 * pointerRef.current.boost) / dist2;
          px += dx * warp * 0.16;
          py += dy * warp * 0.16;
        }

        // Color gradient: inner rings incandescent lilac-white, mid orchid/magenta, outer deep cosmic purple
        const closeness = Math.max(0, 1 - (rad - 56) / 190);
        const rCol = Math.round(148 + closeness * 105 + p.hueMix * 20);
        const gCol = Math.round(52 + closeness * 165 * (p.hueMix > 0.6 ? 1 : 0.65));
        const bCol = Math.round(215 + closeness * 40);

        const alpha = Math.min(0.95, p.alpha * (0.7 + closeness * 0.55));
        ctx.fillStyle = `rgba(${Math.min(255, rCol)}, ${Math.min(255, gCol)}, ${Math.min(255, bCol)}, ${alpha.toFixed(3)})`;

        // Slight motion streak along orbit in DISCO mode
        const size = p.size * (0.85 + morph * 0.4);
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Compute Active Orbital Node Coordinates & Shoot Luminous Curved Synapses Across the Galaxy!
      const activeIdx = Math.max(
        0,
        arcItems.findIndex((a) => a.node.id === hoverModuleRef.current)
      );
      const arcRadius = Math.min(w * 0.34, h * 0.44);
      const activeArc = arcItems[activeIdx];
      const srcX = cx + Math.cos(activeArc.rad) * arcRadius;
      const srcY = cy + Math.sin(activeArc.rad) * arcRadius;

      const memCoords: Array<{ x: number; y: number; mem: GalaxyMemoryItem }> = [];
      const currentMemNodes = memoryNodesRef.current;

      for (let m = 0; m < currentMemNodes.length; m++) {
        const mn = currentMemNodes[m];
        const a = mn.angle + simTime * mn.speed;
        const r = mn.ring * (1 - morph * 0.1) + morph * 36;
        const lx = Math.cos(a) * r * (scaleX * 1.05);
        const ly = Math.sin(a) * r * (scaleY * 0.92);
        const mx = cx + lx * cosT - ly * sinT;
        const my = cy + lx * sinT + ly * cosT;
        memCoords.push({ x: mx, y: my, mem: mn.mem });

        // Curved glowing neural filament connecting active orbital skill -> memory star-dot (signature screenshot #4/#5 look!)
        ctx.beginPath();
        const midX = (srcX + mx) * 0.5 + (cy - my) * 0.14;
        const midY = (srcY + my) * 0.5 - (srcX - mx) * 0.08;
        ctx.moveTo(srcX, srcY);
        ctx.quadraticCurveTo(midX, midY, mx, my);
        ctx.strokeStyle =
          morph > 0.35
            ? 'rgba(240, 171, 252, 0.52)'
            : 'rgba(232, 121, 249, 0.34)';
        ctx.lineWidth = morph > 0.35 ? 1.25 : 0.95;
        ctx.stroke();

        // Prominent glowing Memory Star Node
        const glowR = morph > 0.35 ? 11 : 7;
        const starGrad = ctx.createRadialGradient(mx, my, 0.5, mx, my, glowR);
        starGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        starGrad.addColorStop(0.35, 'rgba(240, 171, 252, 0.82)');
        starGrad.addColorStop(1, 'rgba(192, 38, 211, 0)');
        ctx.fillStyle = starGrad;
        ctx.beginPath();
        ctx.arc(mx, my, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      memoryScreenCoordsRef.current = memCoords;

      // 5. Razor-Sharp Pure Pitch-Black Event Horizon Sphere + Incandescent White-Purple Photon Ring
      const bhR = 30 + morph * 22;

      // Outer photon bloom ring
      const photonGrad = ctx.createRadialGradient(cx, cy, bhR * 0.92, cx, cy, bhR * 1.48);
      photonGrad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      photonGrad.addColorStop(0.22, 'rgba(245, 208, 254, 0.78)');
      photonGrad.addColorStop(0.55, 'rgba(192, 38, 211, 0.32)');
      photonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = photonGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR * 1.48, 0, Math.PI * 2);
      ctx.fill();

      // Pure 100% Pitch Black Void Center
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
      ctx.fill();

      // Crisp 1.4px Photon Horizon Edge
      ctx.strokeStyle = 'rgba(250, 232, 255, 0.9)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR + 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle AURION "A" Mark centered inside the Pure Black Event Horizon
      ctx.save();
      ctx.translate(cx, cy);
      const aScale = (bhR / 34) * 0.62;
      ctx.scale(aScale, aScale);
      ctx.fillStyle = 'rgba(245, 208, 254, 0.88)';
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

    // Clicking the central Black Hole minimizes smoothly back to the floating desktop galaxy
    const cx = rect.width * 0.42;
    const cy = rect.height * 0.52;
    if (Math.hypot(clickX - cx, clickY - cy) < 34) {
      onMinimize();
      return;
    }

    // Check if user clicked any Memory star-node
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
      ref={containerRef}
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
      {/* Top Center DISCO | LENTE Pill Switch (Signature Sagittarius Control) */}
      <div className="absolute top-3 left-[42%] -translate-x-1/2 z-30 flex items-center p-0.5 rounded-full bg-black/80 border border-[#C026D3]/45 backdrop-blur-md shadow-[0_0_24px_rgba(168,85,247,0.25)]">
        <button
          type="button"
          onClick={() => setViewMode('disco')}
          className={`px-3.5 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-500 ${
            viewMode === 'disco'
              ? 'bg-[#C026D3]/35 text-[#FAE8FF] border border-[#F0ABFC]/70 shadow-[0_0_12px_rgba(232,121,249,0.5)]'
              : 'text-zinc-500 hover:text-zinc-200 border border-transparent'
          }`}
        >
          DISCO
        </button>
        <button
          type="button"
          onClick={() => setViewMode('lente')}
          className={`px-3.5 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-500 ${
            viewMode === 'lente'
              ? 'bg-[#C026D3]/35 text-[#FAE8FF] border border-[#F0ABFC]/70 shadow-[0_0_12px_rgba(232,121,249,0.5)]'
              : 'text-zinc-500 hover:text-zinc-200 border border-transparent'
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

      {/* Curved Orbital Skill Arc Overlay (Right Side of the Galaxy) */}
      <div className="absolute inset-0 pointer-events-none">
        <svg viewBox="0 0 640 600" preserveAspectRatio="none" className="w-full h-full">
          <path
            d="M 380 82 A 240 245 0 0 1 380 540"
            fill="none"
            stroke="#C026D3"
            strokeOpacity="0.28"
            strokeWidth="1"
          />
        </svg>

        {arcItems.map(({ node, idx, rad }) => {
          const isSelected = activeModule === node.id;
          const isHovered = hoveredModule === node.id;
          const xPct = 42 + Math.cos(rad) * 33;
          const yPct = 52 + Math.sin(rad) * 41;

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
                transitionDelay: `${idx * 25}ms`,
              }}
              className="pointer-events-auto group absolute -translate-y-1/2 flex items-center gap-2.5 focus:outline-none transition-all duration-500"
            >
              {/* Small Glowing Orbital Pearl Node */}
              <span
                className={`relative flex items-center justify-center rounded-full transition-all duration-500 ${
                  isSelected || isHovered
                    ? 'w-4 h-4 bg-[#F0ABFC] shadow-[0_0_16px_#E879F9] scale-110'
                    : 'w-2.5 h-2.5 bg-[#2E074F] border border-[#E879F9]/75 group-hover:bg-[#E879F9]'
                }`}
              >
                {(isSelected || isHovered) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>

              <span
                className={`text-[10px] font-mono tracking-[0.14em] whitespace-nowrap transition-all duration-300 ${
                  isSelected
                    ? 'text-[#FAE8FF] font-bold drop-shadow-[0_0_8px_rgba(240,171,252,0.7)]'
                    : isHovered
                    ? 'text-white translate-x-0.5'
                    : 'text-zinc-400/90 hover:text-zinc-200'
                }`}
              >
                {node.label.toLowerCase()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Floating Memory / Markdown Preview Card (when clicking a glowing star in DISCO or LENTE) */}
      {selectedMemory && (
        <div className="aurion-panel-switch absolute bottom-5 left-5 max-w-[270px] p-3.5 rounded-xl bg-black/90 border border-[#C026D3]/60 backdrop-blur-xl shadow-[0_0_32px_rgba(168,85,247,0.3)] z-30">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F0ABFC]">
              {selectedMemory.scope}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMemory(null)}
              className="text-[10px] text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-zinc-200 leading-relaxed">{selectedMemory.fact_text}</p>
          <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-zinc-500">
            <span>SINAPSE IMP {selectedMemory.importance}/10</span>
            <button
              type="button"
              onClick={() => onSelectModule('notes')}
              className="text-[#E879F9] hover:text-white"
            >
              Abrir mapa ➔
            </button>
          </div>
        </div>
      )}

      {/* Subtle hint at bottom center */}
      <div className="absolute bottom-2.5 left-[42%] -translate-x-1/2 text-[9px] font-mono tracking-[0.22em] text-zinc-600 uppercase pointer-events-none">
        {viewMode === 'disco'
          ? 'Clique nos pontos da galáxia ou nas funções à direita'
          : 'Modo Lente • Clique em qualquer memória estelar'}
      </div>
    </div>
  );
};
