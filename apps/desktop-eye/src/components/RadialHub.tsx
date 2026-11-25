import React from 'react';
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
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'tasks', label: 'Tarefas', Icon: CheckSquare },
  { id: 'tunnels', label: 'Em Túnel', Icon: Activity },
  { id: 'habits', label: 'Hábitos', Icon: Flame },
  { id: 'notes', label: 'Anotações', Icon: FileText },
  { id: 'converter', label: 'Conversor', Icon: RefreshCw },
  { id: 'connectors', label: 'Conectores', Icon: KeyRound },
  { id: 'emails', label: 'Emails', Icon: Mail },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
];

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
  const radius = 118;

  return (
    <div className="relative w-[360px] h-[380px] flex flex-col items-center justify-between py-3">
      <div className="relative w-[320px] h-[300px] flex items-center justify-center">
        {/* Orbital Ring Guide */}
        <div className="absolute w-[236px] h-[236px] rounded-full border border-aurion-gold/20 bg-obsidian-950/40 backdrop-blur-md pointer-events-none" />

        {/* Central Compact Eye */}
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

        {/* 9 Orbital Nodes at 360° */}
        {RADIAL_NODES.map((node, index) => {
          const angleRad = ((index * (360 / RADIAL_NODES.length) - 90) * Math.PI) / 180;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;
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
              onClick={() => onSelectModule(node.id)}
              style={{
                transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
              }}
              className="group absolute z-20 flex flex-col items-center gap-0.5 transition-all duration-200 hover:scale-110"
            >
              <div className="relative w-10 h-10 rounded-full bg-obsidian-800/95 border border-obsidian-border group-hover:border-aurion-gold flex items-center justify-center shadow-lg">
                <node.Icon className="w-4 h-4 text-zinc-200 group-hover:text-aurion-lime transition-colors" />
                {badge !== null && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-aurion-lime text-obsidian-950 text-[10px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium text-zinc-300 bg-obsidian-950/85 px-1.5 py-0.2 rounded">
                {node.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Fixed Bottom REDE MAIN CTA */}
      <button
        type="button"
        onClick={onOpenRedeMain}
        className="px-5 py-1.5 rounded-full bg-obsidian-800 border border-aurion-gold/80 text-aurion-lime text-xs font-bold tracking-widest hover:bg-obsidian-900 hover:shadow-[0_0_16px_rgba(212,175,55,0.35)] transition-all"
      >
        ◈ REDE MAIN
      </button>
    </div>
  );
};
