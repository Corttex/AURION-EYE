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

// Paleta oficial da Logo AURION CO. (Roxo Cósmico -> Magenta -> Orquídea Luminosa)
const STATE_RING_COLOR: Record<EyeState, string> = {
  IDLE: '#B5179E',
  LISTENING: '#E879F9',
  THINKING: '#9333EA',
  SPEAKING: '#F0ABFC',
  EXECUTING_TUNNEL: '#C026D3',
  ALERT: '#F43F5E',
  FOCUS: '#A855F7',
};

const ORBITAL_DOTS = Array.from({ length: 24 }, (_, idx) => {
  const angle = (idx / 24) * Math.PI * 2;
  return {
    x: 50 + Math.cos(angle) * 44,
    y: 50 + Math.sin(angle) * 44,
    r: idx % 2 === 0 ? 1.55 : 1.0,
    opacity: 0.45 + (idx % 4) * 0.14,
  };
});

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
  const [lensOffset, setLensOffset] = useState({ x: 0, y: 0 });
  const [pulsePhase, setPulsePhase] = useState(0);

  // Global 60Hz cursor-vector subscription for gravitational lensing core
  useEffect(() => {
    return subscribeCursorVector(
      (vec) => {
        targetVec.current = vec;
      },
      onPanicTrigger
    );
  }, [onPanicTrigger]);

  // Smooth 60fps gravitational drift + organic breathing + audio modulation
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const microX = Math.sin(t * 0.0014) * 0.08;
      const microY = Math.cos(t * 0.0019) * 0.07;
      currentVec.current.x += (targetVec.current.x + microX - currentVec.current.x) * 0.12;
      currentVec.current.y += (targetVec.current.y + microY - currentVec.current.y) * 0.12;
      setLensOffset({
        x: currentVec.current.x * (compact ? 4.2 : 6.5),
        y: currentVec.current.y * (compact ? 3.5 : 5.2),
      });
      setPulsePhase((Math.sin(t * 0.006) + 1) * 0.5);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [compact]);

  const sizePx = compact ? 78 : 108;
  const ringColor = isDragOver ? '#F0ABFC' : STATE_RING_COLOR[eyeState];
  const coreScale =
    eyeState === 'LISTENING'
      ? 1.12
      : eyeState === 'SPEAKING'
      ? 0.96 + (audioLevel > 0.02 ? audioLevel * 0.42 : pulsePhase * 0.24)
      : 1 + pulsePhase * 0.03;

  const focusPct = focusRemainingSec !== null ? Math.max(0, Math.min(1, focusRemainingSec / (25 * 60))) : 0;

  return (
    <div
      className="relative flex flex-col items-center justify-center"
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
        <div className="mb-1.5 px-2.5 py-0.5 rounded-full bg-[#12071F]/95 border border-[#E066FF]/60 text-[10px] font-medium text-[#F5B7FF] tracking-wide whitespace-nowrap shadow-lg">
          {banner}
        </div>
      )}

      {isDragOver && (
        <div className="mb-1.5 px-2.5 py-0.5 rounded-full bg-[#B5179E] text-white text-[10px] font-bold tracking-wider whitespace-nowrap animate-pulse shadow-[0_0_16px_#E066FF]">
          Solte na singularidade
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        title="AURION Singularity — Clique para abrir HUB Radial"
        style={{ width: sizePx, height: sizePx }}
        className={`relative rounded-full flex items-center justify-center transition-transform duration-300 active:scale-95 focus:outline-none ${
          isDragOver ? 'scale-110' : 'hover:scale-105'
        }`}
      >
        {/* Outer purple gravitational halo (AURION CO. brand glow) */}
        <span
          className="absolute -inset-2.5 rounded-full blur-xl transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${ringColor}66 0%, #6B0F6C44 45%, transparent 74%)`,
            opacity: eyeState === 'IDLE' && !isDragOver ? 0.65 + pulsePhase * 0.2 : 1,
          }}
        />

        {/* Listening soundwave accretion pulse */}
        {eyeState === 'LISTENING' && (
          <span className="absolute -inset-2 rounded-full border border-[#F0ABFC]/80 animate-ping pointer-events-none" />
        )}

        {/* AURION CO. Dotted Orbital Halo Ring */}
        <svg
          viewBox="0 0 100 100"
          className={`absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] pointer-events-none ${
            eyeState === 'THINKING' || eyeState === 'EXECUTING_TUNNEL' || activeTunnelsCount > 0
              ? 'animate-spin'
              : 'animate-spin-slow'
          }`}
          style={{
            animationDuration:
              eyeState === 'THINKING' ? '3.5s' : activeTunnelsCount > 0 ? '8s' : '26s',
          }}
        >
          <defs>
            <linearGradient id="aurionDotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5B7FF" />
              <stop offset="50%" stopColor="#B5179E" />
              <stop offset="100%" stopColor="#3B185F" />
            </linearGradient>
          </defs>
          {ORBITAL_DOTS.map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill="url(#aurionDotGrad)"
              opacity={d.opacity}
            />
          ))}
        </svg>

        {/* Focus countdown ring */}
        {focusRemainingSec !== null && focusRemainingSec > 0 && (
          <svg
            viewBox="0 0 100 100"
            className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90 pointer-events-none"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#E879F9"
              strokeWidth="2.5"
              strokeDasharray={289}
              strokeDashoffset={289 * (1 - focusPct)}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Black Hole Event Horizon + Purple Accretion Rim */}
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #020006 52%, #1C0633 74%, #7C0D68 90%, #E879F9 100%)',
            border: `1.5px solid ${ringColor}`,
            boxShadow: `
              inset 0 0 18px rgba(224, 102, 255, 0.55),
              inset 0 0 6px rgba(245, 183, 255, 0.8),
              0 0 24px ${ringColor}66,
              0 0 42px rgba(124, 13, 104, 0.45)
            `,
          }}
        >
          {/* Relativistic Accretion Swirl SVG */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full animate-spin-slow pointer-events-none"
            style={{
              animationDuration: eyeState === 'THINKING' ? '2.2s' : eyeState === 'SPEAKING' ? '4.5s' : '11s',
            }}
          >
            <defs>
              <linearGradient id="accretionArc1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5B7FF" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#B5179E" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3B185F" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="accretionArc2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#E066FF" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#7C0D68" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#2C1654" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Inner photon ring arcs */}
            <circle
              cx="50"
              cy="50"
              r="39"
              fill="none"
              stroke="url(#accretionArc1)"
              strokeWidth="4.2"
              strokeDasharray="105 140"
              strokeLinecap="round"
            />
            <circle
              cx="50"
              cy="50"
              r="34"
              fill="none"
              stroke="url(#accretionArc2)"
              strokeWidth="2.4"
              strokeDasharray="78 136"
              strokeDashoffset="60"
              strokeLinecap="round"
            />
          </svg>

          {/* Cursor-tracked Gravitational Singularity Core */}
          <div
            className="relative rounded-full pointer-events-none"
            style={{
              width: '62%',
              height: '62%',
              transform: `translate(${lensOffset.x}px, ${lensOffset.y}px) scale(${coreScale})`,
              transition: 'transform 70ms linear',
              background: 'radial-gradient(circle at 46% 44%, #000000 62%, #090114 84%, #6D0E66 100%)',
              boxShadow: `
                0 0 14px rgba(0, 0, 0, 0.98),
                0 0 22px ${ringColor}88,
                inset 0 0 10px rgba(240, 171, 252, ${eyeState === 'SPEAKING' ? 0.55 : 0.25})
              `,
            }}
          >
            {/* Subtle gravitational photon glint on the event horizon edge */}
            <span
              className="absolute top-[10%] left-[16%] w-[34%] h-[16%] rounded-full blur-[1px] pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, rgba(245,183,255,0.75), rgba(181,23,158,0.1))',
                transform: 'rotate(-28deg)',
              }}
            />
          </div>
        </div>
      </button>

      {focusRemainingSec !== null && focusRemainingSec > 0 && !compact && (
        <div className="mt-1 px-2 py-0.5 rounded bg-[#12071F]/90 border border-[#B5179E]/50 text-[10px] font-mono text-[#F5B7FF]">
          {Math.floor(focusRemainingSec / 60)
            .toString()
            .padStart(2, '0')}
          :{(focusRemainingSec % 60).toString().padStart(2, '0')}
        </div>
      )}
    </div>
  );
};
