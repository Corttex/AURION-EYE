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
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { EyeModuleId, EyeState } from '@aurion/shared-protocol';
import { HorusEyeSphere } from './HorusEyeSphere';

export interface RadialNodeMeta {
  id: EyeModuleId;
  label: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export const RADIAL_NODES: RadialNodeMeta[] = [
  { id: 'chat', label: 'COMANDO IA', subtitle: 'Voz, prompt & Hermes 3', Icon: MessageSquare },
  { id: 'tasks', label: 'DEMANDAS', subtitle: 'Kanban & missões ativas', Icon: CheckSquare },
  { id: 'tunnels', label: 'EXECUÇÕES', subtitle: 'Túneis VPS & RPA ao vivo', Icon: Activity },
  { id: 'notes', label: 'MEMÓRIA', subtitle: 'Obsidian & notas lineares', Icon: FileText },
  { id: 'connectors', label: 'COFRE API', subtitle: '50 LLMs & chaves AES-256', Icon: KeyRound },
  { id: 'emails', label: 'COMUNICAÇÃO', subtitle: 'WhatsApp & E-mails HITL', Icon: Mail },
  { id: 'converter', label: 'CONVERSOR', subtitle: 'Arquivos & mídia em lote', Icon: RefreshCw },
  { id: 'habits', label: 'HÁBITOS', subtitle: 'Foco 25m & streaks diários', Icon: Flame },
  { id: 'settings', label: 'SISTEMA', subtitle: 'Permissões & conexão', Icon: Settings },
];

interface RadialHubProps {
  eyeState: EyeState;
  activeTunnelsCount: number;
  pendingEmailsCount: number;
  focusRemainingSec: number | null;
  productionMax: boolean;
  onToggleProductionMax: () => void;
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
  productionMax,
  onToggleProductionMax,
  onSelectModule,
  onCollapse,
  onOpenRedeMain,
  onFileDrop,
}) => {
  const [hoveredNode, setHoveredNode] = useState<EyeModuleId | null>(null);

  // Sagittarius-inspired wide orbital arc on the right + central-left black hole
  const centerX = 290;
  const centerY = 260;
  const arcRadius = 210;

  return (
    <div className="relative w-full max-w-[920px] h-[610px] rounded-2xl bg-black border border-[#9333EA]/35 shadow-[0_0_80px_rgba(168,85,247,0.22)] flex flex-col overflow-hidden select-none">
      {/* Top Minimal Cosmic Bar */}
      <div className="relative z-20 px-5 py-3 border-b border-white/10 bg-black flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-[0.28em] text-[#F5D0FE]">AURION CO.</span>
          <span className="text-[10px] font-mono text-zinc-500">SINGULARITY HUD</span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Modo Produção MAX Toggle */}
          <button
            type="button"
            onClick={onToggleProductionMax}
            className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
              productionMax
                ? 'bg-[#D946EF]/20 border-[#F0ABFC] text-[#FAE8FF] shadow-[0_0_16px_rgba(232,121,249,0.55)]'
                : 'bg-zinc-950 border-white/15 text-zinc-400 hover:border-[#C026D3]/60 hover:text-zinc-200'
            }`}
            title="Alternar entre Modo Supervisionado (pergunta antes de agir) e Produção MAX (livre acesso)"
          >
            {productionMax ? <Zap className="w-3 h-3 text-[#F0ABFC]" /> : <ShieldAlert className="w-3 h-3 text-amber-400" />}
            {productionMax ? 'PRODUÇÃO MAX: ATIVO' : 'SUPERVISIONADO (PERGUNTAR)'}
          </button>

          <button
            type="button"
            onClick={onOpenRedeMain}
            className="px-3 py-1 rounded-full bg-zinc-950 border border-[#C026D3]/60 text-[10px] font-bold tracking-[0.18em] text-[#F5D0FE] hover:bg-[#1E0536] transition-all"
          >
            ◈ REDE MAIN
          </button>

          <button
            type="button"
            onClick={onCollapse}
            className="px-2.5 py-1 rounded-full bg-zinc-950 border border-white/15 text-[10px] text-zinc-400 hover:text-white"
            title="Minimizar para Galáxia flutuante"
          >
            Minimizar
          </button>
        </div>
      </div>

      {/* 100% Black Sagittarius Orbital Field */}
      <div className="relative flex-1 bg-black overflow-hidden">
        <svg viewBox="0 0 880 540" className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <radialGradient id="sagGlow" cx="33%" cy="48%" r="48%">
              <stop offset="0%" stopColor="#3B0764" stopOpacity="0.32" />
              <stop offset="55%" stopColor="#120322" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="880" height="540" fill="url(#sagGlow)" />

          {/* Concentric Fine Orbital Rings */}
          <circle cx={centerX} cy={centerY} r="135" fill="none" stroke="#A855F7" strokeOpacity="0.14" strokeWidth="0.9" />
          <circle cx={centerX} cy={centerY} r={arcRadius} fill="none" stroke="#D946EF" strokeOpacity="0.26" strokeWidth="1" strokeDasharray="3 6" />
          <circle cx={centerX} cy={centerY} r="285" fill="none" stroke="#9333EA" strokeOpacity="0.12" strokeWidth="0.8" />

          {/* Glowing Orbital Arc Connectors from Singularity to each Key Function */}
          {RADIAL_NODES.map((node, idx) => {
            const t = idx / (RADIAL_NODES.length - 1);
            const angleDeg = -64 + t * 128; // Sweeping right-hand orbital arc (-64° to +64°)
            const rad = (angleDeg * Math.PI) / 180;
            const nx = centerX + Math.cos(rad) * arcRadius;
            const ny = centerY + Math.sin(rad) * arcRadius;
            const isHovered = hoveredNode === node.id;

            const ctrlX = centerX + Math.cos(rad) * 110;
            const ctrlY = centerY + Math.sin(rad) * 55;

            return (
              <g key={`arc-${node.id}`}>
                <path
                  d={`M ${centerX + 42} ${centerY} Q ${ctrlX} ${ctrlY} ${nx} ${ny}`}
                  fill="none"
                  stroke={isHovered ? '#FAE8FF' : '#C026D3'}
                  strokeOpacity={isHovered ? 0.92 : 0.25}
                  strokeWidth={isHovered ? 1.8 : 0.9}
                />
                <circle
                  cx={nx}
                  cy={ny}
                  r={isHovered ? 3.5 : 2}
                  fill={isHovered ? '#FFFFFF' : '#E879F9'}
                />
              </g>
            );
          })}
        </svg>

        {/* Left-Center Main Black Hole Button */}
        <div
          style={{ left: `${centerX}px`, top: `${centerY}px`, transform: 'translate(-50%, -50%)' }}
          className="absolute z-10 flex flex-col items-center"
        >
          <HorusEyeSphere
            eyeState={eyeState}
            activeTunnelsCount={activeTunnelsCount}
            focusRemainingSec={focusRemainingSec}
            onClick={onCollapse}
            onFileDrop={onFileDrop}
          />
          <span className="mt-1 text-[9px] font-mono tracking-[0.22em] text-zinc-500 uppercase">
            Clique na função à direita
          </span>
        </div>

        {/* 9 Key Function Nodes along the Orbital Arc */}
        {RADIAL_NODES.map((node, idx) => {
          const t = idx / (RADIAL_NODES.length - 1);
          const angleDeg = -64 + t * 128;
          const rad = (angleDeg * Math.PI) / 180;
          const nx = centerX + Math.cos(rad) * arcRadius;
          const ny = centerY + Math.sin(rad) * arcRadius;

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
                left: `${nx.toFixed(1)}px`,
                top: `${ny.toFixed(1)}px`,
                transform: 'translate(-18px, -50%)',
              }}
              className="group absolute z-20 flex items-center gap-3 text-left focus:outline-none"
            >
              <div className="relative w-9 h-9 rounded-full bg-black border border-[#C026D3]/60 group-hover:border-[#FAE8FF] group-hover:scale-110 group-hover:shadow-[0_0_16px_rgba(232,121,249,0.65)] flex items-center justify-center transition-all">
                <node.Icon className="w-4 h-4 text-[#E9D5FF] group-hover:text-white" />
                {badge !== null && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#E879F9] text-black text-[9px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>

              <div className="px-2.5 py-1 rounded-lg bg-black/90 border border-white/10 group-hover:border-[#E879F9]/55 transition-all">
                <div className="text-[11px] font-bold tracking-[0.14em] text-[#F5D0FE] group-hover:text-white whitespace-nowrap">
                  {node.label}
                </div>
                <div className="text-[9px] text-zinc-500 group-hover:text-zinc-300 whitespace-nowrap">
                  {node.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
