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

const STATE_RING_COLOR: Record<EyeState, string> = {
  IDLE: '#D4AF37',
  LISTENING: '#B8FF2C',
  THINKING: '#8B5CF6',
  SPEAKING: '#B8FF2C',
  EXECUTING_TUNNEL: '#D4AF37',
  ALERT: '#EF4444',
  FOCUS: '#D4AF37',
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
  const [irisOffset, setIrisOffset] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Global 60Hz cursor-vector subscription
  useEffect(() => {
    return subscribeCursorVector(
      (vec) => {
        targetVec.current = vec;
      },
      onPanicTrigger
    );
  }, [onPanicTrigger]);

  // Smooth 60fps lerp + organic micro-saccades + speaking modulation
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const microX = Math.sin(t * 0.0017) * 0.06;
      const microY = Math.cos(t * 0.0023) * 0.05;
      currentVec.current.x += (targetVec.current.x + microX - currentVec.current.x) * 0.14;
      currentVec.current.y += (targetVec.current.y + microY - currentVec.current.y) * 0.14;
      setIrisOffset({
        x: currentVec.current.x * (compact ? 5.5 : 8.5),
        y: currentVec.current.y * (compact ? 4.0 : 6.0),
      });
      setPulsePhase((Math.sin(t * 0.008) + 1) * 0.5);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [compact]);

  // Natural blinks every 4-7 seconds
  useEffect(() => {
    let timeoutId: number;
    const scheduleBlink = () => {
      const delay = 4000 + Math.random() * 3000;
      timeoutId = window.setTimeout(() => {
        setIsBlinking(true);
        window.setTimeout(() => setIsBlinking(false), 140);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  const sizePx = compact ? 76 : 104;
  const ringColor = isDragOver ? '#D4AF37' : STATE_RING_COLOR[eyeState];
  const pupilScale =
    eyeState === 'LISTENING'
      ? 1.28
      : eyeState === 'SPEAKING'
      ? 0.95 + (audioLevel > 0.02 ? audioLevel * 0.65 : pulsePhase * 0.45)
      : 1;

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
        <div className="mb-1.5 px-2.5 py-0.5 rounded-full bg-obsidian-900/95 border border-aurion-gold/60 text-[10px] font-medium text-aurion-lime tracking-wide whitespace-nowrap shadow-lg">
          {banner}
        </div>
      )}

      {isDragOver && (
        <div className="mb-1.5 px-2.5 py-0.5 rounded-full bg-aurion-gold text-obsidian-950 text-[10px] font-bold tracking-wider whitespace-nowrap animate-pulse">
          Solte para converter
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        title="AURION Eye — Clique para abrir HUB Radial"
        style={{ width: sizePx, height: sizePx }}
        className={`relative rounded-full flex items-center justify-center transition-transform duration-300 active:scale-95 focus:outline-none ${
          isDragOver ? 'scale-110' : 'hover:scale-105'
        }`}
      >
        {/* Outer reactive aura */}
        <span
          className="absolute inset-0 rounded-full blur-md transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${ringColor}44 0%, transparent 72%)`,
            opacity: eyeState === 'IDLE' && !isDragOver ? 0.55 : 0.95,
          }}
        />

        {/* Listening sound wave ring */}
        {eyeState === 'LISTENING' && (
          <span className="absolute -inset-1.5 rounded-full border border-aurion-lime/70 animate-ping pointer-events-none" />
        )}

        {/* Active tunnel rotating arc */}
        {(activeTunnelsCount > 0 || eyeState === 'EXECUTING_TUNNEL' || eyeState === 'THINKING') && (
          <svg
            viewBox="0 0 100 100"
            className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] animate-spin-slow pointer-events-none"
          >
            <circle
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke={eyeState === 'THINKING' ? '#8B5CF6' : '#B8FF2C'}
              strokeWidth="2.5"
              strokeDasharray="65 230"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Focus countdown ring */}
        {focusRemainingSec !== null && focusRemainingSec > 0 && (
          <svg viewBox="0 0 100 100" className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 pointer-events-none">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2.5"
              strokeDasharray={289}
              strokeDashoffset={289 * (1 - focusPct)}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Obsidian GlassLiquid Sphere */}
        <div
          className="relative w-full h-full rounded-full bg-obsidian-950/95 border shadow-2xl flex items-center justify-center overflow-hidden backdrop-blur-xl"
          style={{
            borderColor: ringColor,
            boxShadow: `inset 0 2px 10px rgba(255,255,255,0.08), 0 0 22px ${ringColor}33`,
          }}
        >
          {/* Specular glass reflection */}
          <div className="absolute top-1.5 left-1/4 w-1/2 h-1/4 rounded-full bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

          {/* Sacred Eye of Horus Vector */}
          <svg viewBox="0 0 100 100" className="w-[78%] h-[78%]">
            {/* Brow & Outer Eye Contour in Metallic Gold */}
            <path
              d="M14 42 Q50 18 86 42"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M18 49 Q50 31 82 49 Q50 67 18 49 Z"
              fill="#0C0D12"
              stroke="#D4AF37"
              strokeWidth="2.3"
            />
            {/* Horus spiral teardrop */}
            <path
              d="M48 62 L48 76 Q48 84 40 84 Q35 84 35 79"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M64 59 L74 79"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Tracked Iris & Neon-Lime Pupil */}
            <g
              transform={`translate(${irisOffset.x}, ${irisOffset.y}) scale(1, ${isBlinking ? 0.12 : 1})`}
              style={{ transformOrigin: '50px 49px', transition: 'transform 60ms linear' }}
            >
              <circle cx="50" cy="49" r="10.5" fill="#11131A" stroke="#D4AF37" strokeWidth="1.6" />
              <circle
                cx="50"
                cy="49"
                r={5.2 * pupilScale}
                fill={eyeState === 'ALERT' ? '#EF4444' : '#B8FF2C'}
              />
              <circle cx="52.2" cy="46.5" r="1.5" fill="#FFFFFF" opacity="0.85" />
            </g>
          </svg>
        </div>
      </button>

      {focusRemainingSec !== null && focusRemainingSec > 0 && !compact && (
        <span className="mt-1 px-2 py-0.5 rounded bg-obsidian-900/90 border border-obsidian-border text-[10px] font-mono text-aurion-gold">
          {String(Math.floor(focusRemainingSec / 60)).padStart(2, '0')}:
          {String(focusRemainingSec % 60).padStart(2, '0')}
        </span>
      )}
    </div>
  );
};
