import React, { useEffect, useRef, useState } from 'react';
import type { EyeState } from '@aurion/shared-protocol';
import { subscribeCursorVector } from '../lib/tauriBridge';

interface HorusEyeSphereProps {
  eyeState: EyeState;
  activeTunnelsCount: number;
  focusRemainingSec: number | null;
  audioLevel?: number;
  banner?: string | null;
  compact?: boolean;
  isDragOver?: boolean;
  onClick: () => void;
  onPanicTrigger?: (reason: string) => void;
  onFileDrop?: (file: File) => void;
  onDragStateChange?: (over: boolean) => void;
}

const STATE_GLOW: Record<EyeState, { primary: string; core: string }> = {
  IDLE: { primary: '#D946EF', core: '#F5D0FE' },
  LISTENING: { primary: '#F0ABFC', core: '#FFFFFF' },
  THINKING: { primary: '#A855F7', core: '#F3E8FF' },
  SPEAKING: { primary: '#E879F9', core: '#FAE8FF' },
  EXECUTING_TUNNEL: { primary: '#C026D3', core: '#F5D0FE' },
  ALERT: { primary: '#F43F5E', core: '#FFE4E6' },
  FOCUS: { primary: '#9333EA', core: '#E9D5FF' },
};

export const HorusEyeSphere: React.FC<HorusEyeSphereProps> = ({
  eyeState,
  activeTunnelsCount,
  focusRemainingSec,
  audioLevel = 0,
  banner,
  compact = false,
  isDragOver = false,
  onClick,
  onPanicTrigger,
  onFileDrop,
  onDragStateChange,
}) => {
  const targetVec = useRef({ x: 0, y: 0 });
  const currentVec = useRef({ x: 0, y: 0 });
  const hoverTarget = useRef(0);
  const hoverBoost = useRef(0);
  const pointerFlowTarget = useRef({ x: 0, y: 0 });
  const pointerFlow = useRef({ x: 0, y: 0 });
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const phaseRef = useRef(0);

  const [renderState, setRenderState] = useState({
    phaseDeg: 0,
    boost: 0,
    vecX: 0,
    vecY: 0,
    flowX: 0,
    flowY: 0,
    breath: 0.5,
  });

  // Global 60Hz cursor-vector subscription
  useEffect(() => {
    return subscribeCursorVector(
      (vec) => {
        targetVec.current = vec;
      },
      onPanicTrigger
    );
  }, [onPanicTrigger]);

  // Continuous 60fps physics: plasma spin acceleration + aura flow following mouse velocity
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Smoothly interpolate hover boost & decay velocity wake
      hoverBoost.current += (hoverTarget.current - hoverBoost.current) * 0.12;
      pointerFlowTarget.current.x *= 0.9;
      pointerFlowTarget.current.y *= 0.9;
      pointerFlow.current.x += (pointerFlowTarget.current.x - pointerFlow.current.x) * 0.16;
      pointerFlow.current.y += (pointerFlowTarget.current.y - pointerFlow.current.y) * 0.16;

      const microX = Math.sin(now * 0.0015) * 0.05;
      const microY = Math.cos(now * 0.0019) * 0.04;
      currentVec.current.x += (targetVec.current.x + microX - currentVec.current.x) * 0.12;
      currentVec.current.y += (targetVec.current.y + microY - currentVec.current.y) * 0.12;

      const baseSpeed =
        eyeState === 'THINKING'
          ? 190
          : eyeState === 'SPEAKING'
          ? 135
          : eyeState === 'LISTENING' || activeTunnelsCount > 0
          ? 110
          : 46;

      const flowMagnitude = Math.hypot(pointerFlow.current.x, pointerFlow.current.y);
      const speedDegPerSec = baseSpeed * (1 + hoverBoost.current * 3.1 + flowMagnitude * 0.08);
      phaseRef.current = (phaseRef.current + speedDegPerSec * dt) % 360;

      setRenderState({
        phaseDeg: phaseRef.current,
        boost: hoverBoost.current,
        vecX: currentVec.current.x,
        vecY: currentVec.current.y,
        flowX: pointerFlow.current.x,
        flowY: pointerFlow.current.y,
        breath: (Math.sin(now * 0.0035) + 1) * 0.5,
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [eyeState, activeTunnelsCount]);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const relY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    targetVec.current = { x: relX, y: relY };

    if (lastPointer.current) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      pointerFlowTarget.current = {
        x: Math.max(-26, Math.min(26, pointerFlowTarget.current.x + dx * 0.85)),
        y: Math.max(-22, Math.min(22, pointerFlowTarget.current.y + dy * 0.85)),
      };
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };

  const widthPx = compact ? 116 : 168;
  const heightPx = compact ? 90 : 128;
  const palette = STATE_GLOW[eyeState];
  const diskTiltDeg = -21 + renderState.vecX * 5.5 + renderState.flowY * 0.25;
  const auraShiftX = renderState.vecX * (compact ? 7 : 12) + renderState.flowX * 0.75;
  const auraShiftY = renderState.vecY * (compact ? 5 : 9) + renderState.flowY * 0.75;
  const speakingScale =
    eyeState === 'SPEAKING'
      ? 1 + (audioLevel > 0.02 ? audioLevel * 0.28 : renderState.breath * 0.14)
      : 1 + renderState.boost * 0.06;

  const focusPct =
    focusRemainingSec !== null ? Math.max(0, Math.min(1, focusRemainingSec / (25 * 60))) : 0;

  const uid = compact ? 'bh-compact' : 'bh-main';

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      onDragOver={(e) => {
        e.preventDefault();
        onDragStateChange?.(true);
      }}
      onDragLeave={() => onDragStateChange?.(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragStateChange?.(false);
        const f = e.dataTransfer.files?.[0];
        if (f && onFileDrop) onFileDrop(f);
      }}
    >
      {banner && (
        <div className="mb-1 px-2.5 py-0.5 rounded-full bg-[#0D0418]/95 border border-[#E879F9]/50 text-[10px] font-medium text-[#F5D0FE] tracking-wide whitespace-nowrap shadow-[0_0_14px_rgba(217,70,239,0.35)]">
          {banner}
        </div>
      )}

      {isDragOver && (
        <div className="mb-1 px-2.5 py-0.5 rounded-full bg-[#C026D3] text-white text-[10px] font-bold tracking-wider whitespace-nowrap animate-pulse shadow-[0_0_18px_#F0ABFC]">
          Solte no Horizonte de Eventos
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        onPointerEnter={() => {
          hoverTarget.current = 1;
        }}
        onPointerLeave={() => {
          hoverTarget.current = 0;
          lastPointer.current = null;
        }}
        onPointerMove={handlePointerMove}
        title="AURION Singularity — Clique para abrir o HUB Orbital"
        style={{
          width: widthPx,
          height: heightPx,
          transform: `scale(${isDragOver ? 1.1 : speakingScale})`,
        }}
        className="relative flex items-center justify-center transition-transform duration-150 active:scale-95 focus:outline-none cursor-pointer"
      >
        {/* Dynamic Flowing Cosmic Aura (follows mouse & surges on hover) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            transform: `translate(${auraShiftX.toFixed(1)}px, ${auraShiftY.toFixed(1)}px) rotate(${diskTiltDeg.toFixed(1)}deg) scale(${
              1 + renderState.boost * 0.22
            }, ${0.62 + renderState.boost * 0.14})`,
            background: `radial-gradient(ellipse at center, ${palette.core}66 0%, ${palette.primary}55 36%, rgba(88,28,135,0.22) 64%, transparent 78%)`,
            filter: `blur(${compact ? 10 : 15}px)`,
            opacity: 0.72 + renderState.boost * 0.28 + renderState.breath * 0.12,
          }}
        />

        {/* Listening soundwave pulse */}
        {eyeState === 'LISTENING' && (
          <span className="absolute w-[62%] h-[78%] rounded-full border border-[#F5D0FE]/75 animate-ping pointer-events-none" />
        )}

        {/* Gargantua Relativistic Black Hole + Tilted Accretion Disk + AURION "A" */}
        <svg
          viewBox="0 0 220 160"
          className="relative w-full h-full overflow-visible pointer-events-none"
        >
          <defs>
            <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4.5" result="blur1" />
              <feGaussianBlur stdDeviation="10" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id={`${uid}-archTop`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#581C87" stopOpacity="0.2" />
              <stop offset="28%" stopColor="#C026D3" stopOpacity="0.9" />
              <stop offset="52%" stopColor="#FAE8FF" stopOpacity="1" />
              <stop offset="76%" stopColor="#D946EF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.15" />
            </linearGradient>

            <linearGradient id={`${uid}-diskFront`} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#3B0764" stopOpacity="0" />
              <stop offset="14%" stopColor="#9333EA" stopOpacity="0.75" />
              <stop offset="34%" stopColor="#F5D0FE" stopOpacity="0.98" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="68%" stopColor="#E879F9" stopOpacity="0.95" />
              <stop offset="86%" stopColor="#7E22CE" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#3B0764" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`${uid}-aurionA`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#F5D0FE" />
              <stop offset="100%" stopColor="#C026D3" />
            </linearGradient>
          </defs>

          <g
            transform={`translate(${(renderState.vecX * 2.8).toFixed(2)}, ${(renderState.vecY * 2.2).toFixed(
              2
            )}) rotate(${diskTiltDeg.toFixed(2)} 110 80)`}
          >
            {/* 1. Back / Gravitational Lensed Upper & Lower Halo Arch (Behind Sphere) */}
            <ellipse
              cx="110"
              cy="80"
              rx="96"
              ry="22"
              fill="none"
              stroke={`url(#${uid}-archTop)`}
              strokeWidth={3.5 + renderState.boost * 1.8}
              opacity="0.55"
              filter={`url(#${uid}-glow)`}
            />
            {/* Upper bent relativistic light arch */}
            <path
              d="M 52 78 C 66 26, 154 26, 168 78"
              fill="none"
              stroke={`url(#${uid}-archTop)`}
              strokeWidth={6.5 + renderState.boost * 2.4}
              strokeLinecap="round"
              filter={`url(#${uid}-glow)`}
            />
            <path
              d="M 60 78 C 72 35, 148 35, 160 78"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              opacity={0.75 + renderState.boost * 0.25}
            />
            {/* Lower lensed under-glow arch */}
            <path
              d="M 64 84 C 78 124, 142 124, 156 84"
              fill="none"
              stroke={`url(#${uid}-archTop)`}
              strokeWidth="4.2"
              opacity="0.72"
              filter={`url(#${uid}-glow)`}
            />

            {/* Orbiting plasma filaments on outer disk */}
            <ellipse
              cx="110"
              cy="80"
              rx="88"
              ry="17"
              fill="none"
              stroke="#F5D0FE"
              strokeWidth="1.6"
              strokeDasharray="46 38 22 30"
              strokeDashoffset={-renderState.phaseDeg * 1.6}
              opacity={0.65 + renderState.boost * 0.35}
            />

            {/* 2. Pitch-Black Event Horizon Sphere */}
            <circle
              cx="110"
              cy="80"
              r="33"
              fill="#020005"
              stroke={palette.core}
              strokeWidth="1.4"
              filter={`url(#${uid}-glow)`}
            />
            <circle cx="110" cy="80" r="32.2" fill="#020006" />

            {/* Focus countdown ring around the event horizon */}
            {focusRemainingSec !== null && focusRemainingSec > 0 && (
              <circle
                cx="110"
                cy="80"
                r="35.5"
                fill="none"
                stroke="#F0ABFC"
                strokeWidth="2.2"
                strokeDasharray={223}
                strokeDashoffset={223 * (1 - focusPct)}
                strokeLinecap="round"
              />
            )}

            {/* 3. Front Accretion Disk Band Sweeping Across the Black Hole (Print 1 signature) */}
            <path
              d="M 12 80 Q 110 101 208 80"
              fill="none"
              stroke={`url(#${uid}-diskFront)`}
              strokeWidth={11 + renderState.boost * 3.5}
              strokeLinecap="round"
              filter={`url(#${uid}-glow)`}
            />
            <path
              d="M 24 80 Q 110 98 196 80"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2.4 + renderState.boost * 1.1}
              strokeLinecap="round"
              opacity="0.92"
            />
            {/* Fast streaming plasma streaks across the front band */}
            <path
              d="M 28 79 Q 110 96 192 79"
              fill="none"
              stroke="#F5D0FE"
              strokeWidth="1.6"
              strokeDasharray="28 24 14 20"
              strokeDashoffset={-renderState.phaseDeg * 2.1}
              opacity="0.88"
            />
          </g>

          {/* 4. Official AURION "A" Emblem Centered Inside the Singularity (Upright + Subtle Parallax) */}
          <g
            transform={`translate(${(110 + renderState.vecX * 3.8 + renderState.flowX * 0.18).toFixed(2)}, ${(
              78 +
              renderState.vecY * 3.2 +
              renderState.flowY * 0.18
            ).toFixed(2)}) scale(${compact ? 0.56 : 0.64})`}
          >
            {/* Subtle dark halo behind the A so it stays razor-legible over the plasma band */}
            <circle cx="0" cy="2" r="24" fill="#030008" opacity="0.72" />

            {/* Left & Right Legs of AURION "A" */}
            <path
              d="M 0 -24 L -20 18 L -11 18 L 0 -6 L 5 4 L 12 1.5 Z"
              fill={`url(#${uid}-aurionA)`}
            />
            <path
              d="M 8 9 L 12.5 18 L 21.5 18 L 15.2 5.2 Z"
              fill={`url(#${uid}-aurionA)`}
            />
            {/* Signature AURION Upward Curved Swoosh Blade */}
            <path
              d="M -19 18 C -7 4, 10 -4, 31 -9 C 14 -1, -2 8, -11 18 Z"
              fill="#FFFFFF"
              filter={`url(#${uid}-glow)`}
            />
          </g>
        </svg>
      </button>

      {focusRemainingSec !== null && focusRemainingSec > 0 && !compact && (
        <div className="mt-0.5 px-2 py-0.5 rounded bg-[#0D0418]/90 border border-[#D946EF]/50 text-[10px] font-mono text-[#F5D0FE]">
          {Math.floor(focusRemainingSec / 60)
            .toString()
            .padStart(2, '0')}
          :{(focusRemainingSec % 60).toString().padStart(2, '0')}
        </div>
      )}
    </div>
  );
};
