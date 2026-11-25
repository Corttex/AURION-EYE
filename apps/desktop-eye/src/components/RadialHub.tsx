import React, { useState } from 'react';
import {
  Activity,
  CheckSquare,
  FileText,
  Flame,
  KeyRound,
  Mail,
  MessageSquare,
  RefreshCw,
  Settings,
} from 'lucide-react';
import type { EyeModuleId, EyeState } from '@aurion/shared-protocol';
import { HorusEyeSphere } from './HorusEyeSphere';

export interface RadialNodeMeta {
  id: EyeModuleId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export const RADIAL_NODES: RadialNodeMeta[] = [
  { id: 'chat', label: 'COMANDO IA', Icon: MessageSquare },
  { id: 'tasks', label: 'TAREFAS', Icon: CheckSquare },
  { id: 'tunnels', label: 'EM TÚNEL', Icon: Activity },
  { id: 'habits', label: 'HÁBITOS', Icon: Flame },
  { id: 'notes', label: 'MEMÓRIA', Icon: FileText },
  { id: 'converter', label: 'CONVERSOR', Icon: RefreshCw },
  { id: 'connectors', label: 'COFRE API', Icon: KeyRound },
  { id: 'emails', label: 'COMUNICAÇÃO', Icon: Mail },
  { id: 'settings', label: 'SISTEMA', Icon: Settings },
];

const DEGREE_TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

interface RadialHubProps {
  eyeState: EyeState;
  activeTunnelsCount: number;
  pendingEmailsCount: number;
  focusRemainingSec: number | null;
  onSelectModule: (id: EyeModuleId) => void;
  onCollapse: () => void;
  onOpenRedeMain: () => void;
  onFileDrop: (file: File) => void;
}

export const RadialHub: React.FC<RadialHubProps> = ({
  eyeState,
  activeTunnelsCount,
  pendingEmailsCount,
  focusRemainingSec,
  onSelectModule,
  onCollapse,
  onOpenRedeMain,
  onFileDrop,
}) => {
  const [hoveredNode, setHoveredNode] = useState<EyeModuleId | null>(null);
  const radius = 144;
  const center = 210;

  return (
    <div className="relative w-[440px] h-[468px] flex flex-col items-center justify-between py-2 select-none">
      {/* Constellation HUD Canvas (Print 2 Astrolabe + Neural Lines) */}
      <div className="relative w-[420px] h-[406px] flex items-center justify-center">
        <svg
          viewBox="0 0 420 420"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <defs>
            <radialGradient id="hudBackdrop" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1E0536" stopOpacity="0.72" />
              <stop offset="65%" stopColor="#090212" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#04010A" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="beamDown" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5D0FE" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#C026D3" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#581C87" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Soft dark cosmic aura behind the HUD */}
          <circle cx={center} cy={center} r="196" fill="url(#hudBackdrop)" />

          {/* Concentric Astrolabe HUD Rings (Print 2 signature) */}
          <circle
            cx={center}
            cy={center}
            r="182"
            fill="none"
            stroke="#A855F7"
            strokeOpacity="0.18"
            strokeWidth="0.8"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#D946EF"
            strokeOpacity="0.32"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
          <circle
            cx={center}
            cy={center}
            r="96"
            fill="none"
            stroke="#E879F9"
            strokeOpacity="0.22"
            strokeWidth="0.9"
          />
          <circle
            cx={center}
            cy={center}
            r="68"
            fill="none"
            stroke="#F5D0FE"
            strokeOpacity="0.16"
            strokeWidth="0.75"
            strokeDasharray="12 6"
          />

          {/* Perimeter Degree Ticks */}
          {DEGREE_TICKS.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const inner = deg % 30 === 0 ? 175 : 178.5;
            const outer = 182;
            return (
              <line
                key={deg}
                x1={center + Math.cos(rad) * inner}
                y1={center + Math.sin(rad) * inner}
                x2={center + Math.cos(rad) * outer}
                y2={center + Math.sin(rad) * outer}
                stroke="#E879F9"
                strokeOpacity={deg % 30 === 0 ? 0.45 : 0.2}
                strokeWidth={deg % 30 === 0 ? 1.1 : 0.6}
              />
            );
          })}

          {/* Vertical Energy Pillar descending to REDE MAIN (Print 2 bottom beam) */}
          <line
            x1={center}
            y1={center + 38}
            x2={center}
            y2="412"
            stroke="url(#beamDown)"
            strokeWidth="2.2"
          />
          <ellipse
            cx={center}
            cy="406"
            rx="46"
            ry="7"
            fill="none"
            stroke="#D946EF"
            strokeOpacity="0.45"
            strokeWidth="1"
          />

          {/* Radiating Constellation Lines from Black Hole to each Node */}
          {RADIAL_NODES.map((node, index) => {
            const angleRad = ((index * (360 / RADIAL_NODES.length) - 90) * Math.PI) / 180;
            const x1 = center + Math.cos(angleRad) * 56;
            const y1 = center + Math.sin(angleRad) * 56;
            const x2 = center + Math.cos(angleRad) * (radius - 26);
            const y2 = center + Math.sin(angleRad) * (radius - 26);
            const isHovered = hoveredNode === node.id;

            return (
              <g key={`ray-${node.id}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isHovered ? '#FAE8FF' : '#C026D3'}
                  strokeOpacity={isHovered ? 0.9 : 0.32}
                  strokeWidth={isHovered ? 1.6 : 0.9}
                />
                <circle
                  cx={x2}
                  cy={y2}
                  r={isHovered ? 2.4 : 1.5}
                  fill={isHovered ? '#FFFFFF' : '#E879F9'}
                  opacity={isHovered ? 1 : 0.6}
                />
              </g>
            );
          })}
        </svg>

        {/* Central Compact Gargantua Black Hole + AURION A */}
        <div className="z-10">
          <HorusEyeSphere
            eyeState={eyeState}
            activeTunnelsCount={activeTunnelsCount}
            focusRemainingSec={focusRemainingSec}
            compact
            onClick={onCollapse}
            onFileDrop={onFileDrop}
          />
        </div>

        {/* 9 Constellation HUD Medallion Buttons (Print 2 style) */}
        {RADIAL_NODES.map((node, index) => {
          const angleDeg = index * (360 / RADIAL_NODES.length) - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;
          const isTopHalf = Math.sin(angleRad) < -0.35;

          const badge =
            node.id === 'tunnels' && activeTunnelsCount > 0
              ? activeTunnelsCount
              : node.id === 'emails' && pendingEmailsCount > 0
              ? pendingEmailsCount
              : null;

          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onSelectModule(node.id)}
              style={{
                transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
              }}
              className={`group absolute z-20 flex ${
                isTopHalf ? 'flex-col-reverse' : 'flex-col'
              } items-center gap-1 transition-transform duration-200 hover:scale-110 focus:outline-none`}
            >
              {/* Double-Ring Target Medallion with Crosshair Ticks */}
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg
                  viewBox="0 0 56 56"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  {/* Outer thin target ring */}
                  <circle
                    cx="28"
                    cy="28"
                    r="26"
                    fill="#0B0315"
                    fillOpacity="0.88"
                    stroke="#C026D3"
                    strokeOpacity="0.55"
                    strokeWidth="1"
                    className="group-hover:stroke-[#FAE8FF] group-hover:stroke-opacity-100 transition-all"
                  />
                  {/* Inner medallion ring */}
                  <circle
                    cx="28"
                    cy="28"
                    r="21"
                    fill="none"
                    stroke="#E879F9"
                    strokeOpacity="0.35"
                    strokeWidth="0.85"
                    strokeDasharray="6 3"
                    className="group-hover:stroke-[#FFFFFF] group-hover:stroke-opacity-90 transition-all"
                  />
                  {/* 4 Cardinal Crosshair Ticks (Print 2 detail) */}
                  <line x1="28" y1="0" x2="28" y2="5" stroke="#F5D0FE" strokeOpacity="0.7" strokeWidth="1" />
                  <line x1="28" y1="51" x2="28" y2="56" stroke="#F5D0FE" strokeOpacity="0.7" strokeWidth="1" />
                  <line x1="0" y1="28" x2="5" y2="28" stroke="#F5D0FE" strokeOpacity="0.7" strokeWidth="1" />
                  <line x1="51" y1="28" x2="56" y2="28" stroke="#F5D0FE" strokeOpacity="0.7" strokeWidth="1" />
                </svg>

                {/* Hover glow core */}
                <span className="absolute inset-2 rounded-full bg-[#D946EF]/0 group-hover:bg-[#D946EF]/25 blur-sm transition-colors pointer-events-none" />

                <node.Icon className="relative z-10 w-4 h-4 text-[#F3E8FF] group-hover:text-white drop-shadow-[0_0_6px_rgba(240,171,252,0.85)] transition-colors" />

                {badge !== null && (
                  <span className="absolute -top-0.5 -right-0.5 z-20 min-w-[16px] h-4 px-1 rounded-full bg-[#E879F9] text-[#090112] text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_#E879F9]">
                    {badge}
                  </span>
                )}
              </div>

              {/* Uppercase Strategic HUD Label */}
              <span className="text-[9px] font-semibold tracking-[0.16em] uppercase text-[#E9D5FF] group-hover:text-white bg-[#090212]/85 border border-[#A855F7]/25 group-hover:border-[#F0ABFC]/60 px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm transition-colors">
                {node.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Portal CTA anchored on the vertical energy beam */}
      <button
        type="button"
        onClick={onOpenRedeMain}
        className="relative z-20 px-6 py-1.5 rounded-full bg-[#120422]/95 border border-[#E879F9]/75 text-[#FAE8FF] text-[11px] font-bold tracking-[0.22em] uppercase hover:bg-[#240842] hover:border-white hover:shadow-[0_0_22px_rgba(232,121,249,0.65)] transition-all"
      >
        ◈ REDE MAIN
      </button>
    </div>
  );
};
