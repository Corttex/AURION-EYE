import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Mail, MessageSquare, ShieldAlert, Target, Zap } from 'lucide-react';
import type { EmailDraft, EyeModuleId, EyeState, Habit } from '@aurion/shared-protocol';
import { apiFetch } from '../lib/apiClient';
import { AurionGalaxyStage, GalaxyMemoryItem } from './AurionGalaxyStage';
import { RADIAL_NODES } from './RadialHub';

interface CronPreview {
  id: string;
  name: string;
  human_schedule: string;
  last_status: string;
}

interface PendingRpa {
  request_id: string;
  action: string;
  norm_x: number;
  norm_y: number;
  text?: string;
}

interface AurionCommandCockpitProps {
  eyeState: EyeState;
  activeModule: EyeModuleId;
  productionMax: boolean;
  pendingRpa: PendingRpa | null;
  onSelectModule: (id: EyeModuleId) => void;
  onToggleProductionMax: () => void;
  onResolveRpa: (approved: boolean) => void;
  onOpenRedeMain: () => void;
  onCollapse: () => void;
  rightPanelContent: React.ReactNode;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const AurionCommandCockpit: React.FC<AurionCommandCockpitProps> = ({
  eyeState,
  activeModule,
  productionMax,
  pendingRpa,
  onSelectModule,
  onToggleProductionMax,
  onResolveRpa,
  onOpenRedeMain,
  onCollapse,
  rightPanelContent,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [crons, setCrons] = useState<CronPreview[]>([]);
  const [memories, setMemories] = useState<GalaxyMemoryItem[]>([]);

  useEffect(() => {
    apiFetch<EmailDraft[]>('/api/emails').then(setEmails).catch(() => {});
    apiFetch<Habit[]>('/api/habits').then(setHabits).catch(() => {});
    apiFetch<CronPreview[]>('/api/cron').then(setCrons).catch(() => {});
    apiFetch<GalaxyMemoryItem[]>('/api/memory/facts').then(setMemories).catch(() => {});
  }, []);

  const handleSmoothCollapse = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      onCollapse();
    }, 460);
  };

  // Current month calendar cells
  const calendarMeta = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    const cells: Array<number | null> = [
      ...Array.from({ length: firstDow }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return { today, monthLabel, cells };
  }, []);

  const activeNodeMeta = RADIAL_NODES.find((n) => n.id === activeModule);

  return (
    <div
      className={`w-screen h-screen bg-black text-zinc-100 flex flex-col overflow-hidden aurion-backdrop-enter transition-all duration-500 ease-out ${
        isClosing ? 'opacity-0 scale-[0.96] blur-sm' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle Top Command Bar */}
      <div className="px-5 py-2.5 border-b border-white/[0.08] bg-black/95 flex items-center justify-between gap-4 z-30">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold tracking-[0.42em] text-[#F5D0FE]">AURION</span>
          <span className="h-3 w-px bg-white/15" />
          <span className="text-[10px] font-mono tracking-[0.18em] text-zinc-500 uppercase">
            {eyeState === 'IDLE' ? 'SINGULARITY ONLINE' : eyeState}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleProductionMax}
            className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all duration-300 ${
              productionMax
                ? 'bg-[#C026D3]/25 border-[#F0ABFC] text-[#FAE8FF] shadow-[0_0_18px_rgba(232,121,249,0.5)]'
                : 'bg-black border-white/15 text-zinc-400 hover:border-[#C026D3]/60 hover:text-zinc-200'
            }`}
          >
            {productionMax ? <Zap className="w-3 h-3 text-[#F0ABFC]" /> : <ShieldAlert className="w-3 h-3 text-amber-400" />}
            {productionMax ? 'PRODUÇÃO MAX: LIVRE ACESSO' : 'SUPERVISIONADO (PERGUNTAR)'}
          </button>

          <button
            type="button"
            onClick={onOpenRedeMain}
            className="px-3 py-1 rounded-full bg-black border border-[#C026D3]/60 text-[10px] font-bold tracking-[0.18em] text-[#F5D0FE] hover:bg-[#1E0536] transition-all duration-300"
          >
            ◈ REDE MAIN
          </button>

          <button
            type="button"
            onClick={handleSmoothCollapse}
            className="px-3 py-1 rounded-full bg-black border border-white/15 text-[10px] tracking-wider text-zinc-400 hover:text-white hover:border-white/30 transition-all duration-300"
          >
            Recolher Galáxia
          </button>
        </div>
      </div>

      {/* Human-in-the-Loop Machine Confirmation Banner */}
      {pendingRpa && (
        <div className="aurion-panel-switch mx-5 mt-2.5 px-4 py-2.5 rounded-xl bg-[#1A052E] border border-[#F0ABFC]/70 flex items-center justify-between gap-3 shadow-[0_0_24px_rgba(217,70,239,0.35)] z-30">
          <div className="text-xs text-[#FAE8FF]">
            <span className="font-bold text-[#F0ABFC]">CONFIRMAÇÃO DE MÁQUINA:</span> AURION solicita{' '}
            <code className="px-1.5 py-0.5 rounded bg-black text-white">{pendingRpa.action}</code>{' '}
            em ({pendingRpa.norm_x.toFixed(2)}, {pendingRpa.norm_y.toFixed(2)})
            {pendingRpa.text ? ` • "${pendingRpa.text}"` : ''}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onResolveRpa(true)}
              className="px-3 py-1 rounded-lg bg-[#C026D3] hover:bg-[#D946EF] text-white text-[11px] font-bold"
            >
              Permitir Agora
            </button>
            <button
              type="button"
              onClick={() => onResolveRpa(false)}
              className="px-3 py-1 rounded-lg bg-black border border-white/15 text-zinc-300 text-[11px]"
            >
              Bloquear
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Cosmic Cockpit (Sagittarius Architecture in AURION Purple) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT COLUMN: E-mails / Comunicações + Calendário + Objetivos (staggered slow fade-in) */}
        <aside className="aurion-stagger-1 w-[252px] shrink-0 border-r border-white/[0.08] bg-black/95 p-3.5 flex flex-col gap-3 overflow-y-auto">
          {/* Card 1: Comunicações & Triagem */}
          <div
            onClick={() => onSelectModule('emails')}
            className="p-3 rounded-xl bg-[#07030D] border border-white/[0.1] hover:border-[#C026D3]/55 transition-colors duration-300 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#E879F9] flex items-center gap-1.5 uppercase">
                <Mail className="w-3 h-3" /> E-MAILS & HITL
              </span>
              <span className="text-[9px] font-mono text-zinc-500">
                {emails.filter((e) => e.status === 'PENDING_APPROVAL').length} pendentes
              </span>
            </div>
            <div className="space-y-2">
              {(emails.length > 0 ? emails.slice(0, 3) : []).map((mail) => (
                <div
                  key={mail.id}
                  className="p-2 rounded-lg bg-black/70 border border-white/[0.06] hover:border-[#E879F9]/35 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-[#D946EF] shrink-0" />
                    <span className="text-[11px] font-semibold text-zinc-100 truncate">
                      {mail.recipient}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5 pl-3.5">{mail.subject}</p>
                </div>
              ))}
              {emails.length === 0 && (
                <p className="text-[10px] text-zinc-500">Caixa limpa — nenhuma aprovação pendente.</p>
              )}
            </div>
          </div>

          {/* Card 2: Calendário & Rotinas */}
          <div className="p-3 rounded-xl bg-[#07030D] border border-white/[0.1]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#E879F9] flex items-center gap-1.5 uppercase">
                <Calendar className="w-3 h-3" /> CALENDÁRIO
              </span>
              <span className="text-[9px] font-mono text-zinc-500">{calendarMeta.monthLabel}</span>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center text-[9px] font-mono text-zinc-500 mb-1">
              {WEEKDAYS.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-mono">
              {calendarMeta.cells.map((day, idx) => (
                <span
                  key={idx}
                  className={`mx-auto w-5 h-5 flex items-center justify-center rounded-full ${
                    day === calendarMeta.today
                      ? 'bg-[#C026D3] text-white font-bold shadow-[0_0_10px_#E879F9]'
                      : day
                      ? 'text-zinc-300'
                      : ''
                  }`}
                >
                  {day ?? ''}
                </span>
              ))}
            </div>

            {crons.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-white/[0.08] space-y-1">
                {crons.slice(0, 2).map((c) => (
                  <div key={c.id} className="text-[10px] text-zinc-400 flex items-center justify-between gap-2">
                    <span className="truncate text-zinc-300">{c.name}</span>
                    <span className="text-[9px] font-mono text-[#E879F9] shrink-0">CRON</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Objetivos & Hábitos com Barras Roxas */}
          <div
            onClick={() => onSelectModule('habits')}
            className="p-3 rounded-xl bg-[#07030D] border border-white/[0.1] hover:border-[#C026D3]/55 transition-colors duration-300 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#E879F9] flex items-center gap-1.5 uppercase">
                <Target className="w-3 h-3" /> OBJETIVOS
              </span>
              <span className="text-[9px] font-mono text-zinc-500">{habits.length} ativos</span>
            </div>
            <div className="space-y-2.5">
              {habits.slice(0, 3).map((h) => {
                const pct = Math.min(100, Math.round((h.current_count / Math.max(1, h.target_count)) * 100));
                return (
                  <div key={h.id}>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-zinc-200 truncate">{h.name}</span>
                      <span className="font-mono text-[#F0ABFC]">{pct}%</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-zinc-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#9333EA] to-[#F0ABFC] transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* CENTER STAGE: Massive Slow-Orbiting Purple Particle Galaxy (DISCO / LENTE + Orbital Arc) */}
        <main className="flex-1 relative min-w-0 bg-black">
          <AurionGalaxyStage
            eyeState={eyeState}
            activeModule={activeModule}
            memories={memories}
            onSelectModule={onSelectModule}
            onMinimize={handleSmoothCollapse}
          />
        </main>

        {/* RIGHT COLUMN: Live AURION Chat / Selected Module Drawer (staggered slow fade-in + crossfade) */}
        <aside className="aurion-stagger-3 w-[336px] shrink-0 border-l border-white/[0.08] bg-black/95 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E879F9] shadow-[0_0_8px_#E879F9]" />
              <span className="text-[11px] font-mono tracking-[0.22em] text-[#F5D0FE] uppercase">
                {activeNodeMeta?.label || 'COMANDO IA'}
              </span>
            </div>
            {activeModule !== 'chat' && (
              <button
                type="button"
                onClick={() => onSelectModule('chat')}
                className="px-2 py-0.5 rounded-md bg-[#1B0730] border border-[#C026D3]/50 text-[10px] text-[#F5D0FE] hover:text-white flex items-center gap-1 transition-colors"
              >
                <MessageSquare className="w-3 h-3" /> Chat
              </button>
            )}
          </div>

          <div key={activeModule} className="flex-1 p-3.5 overflow-hidden aurion-panel-switch">
            {rightPanelContent}
          </div>
        </aside>
      </div>
    </div>
  );
};
