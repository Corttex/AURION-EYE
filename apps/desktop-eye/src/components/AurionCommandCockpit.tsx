import React, { useEffect, useState } from 'react';
import { Activity, ExternalLink, Search, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import type { EyeModuleId, EyeState, TunnelJob } from '@aurion/shared-protocol';
import { apiFetch } from '../lib/apiClient';
import { AurionGalaxyStage, GalaxyMemoryItem } from './AurionGalaxyStage';
import { RADIAL_NODES } from './RadialHub';

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
  onQuickPrompt: (prompt: string) => void;
  onOpenRedeMain: () => void;
  onCollapse: () => void;
  rightPanelContent: React.ReactNode;
}

export const AurionCommandCockpit: React.FC<AurionCommandCockpitProps> = ({
  eyeState,
  activeModule,
  productionMax,
  pendingRpa,
  onSelectModule,
  onToggleProductionMax,
  onResolveRpa,
  onQuickPrompt,
  onOpenRedeMain,
  onCollapse,
  rightPanelContent,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [memories, setMemories] = useState<GalaxyMemoryItem[]>([]);
  const [runningJobs, setRunningJobs] = useState<TunnelJob[]>([]);

  useEffect(() => {
    apiFetch<GalaxyMemoryItem[]>('/api/memory/facts').then(setMemories).catch(() => {});
    apiFetch<TunnelJob[]>('/api/tunnels')
      .then((jobs) => setRunningJobs(jobs.filter((j) => j.status === 'RUNNING')))
      .catch(() => {});
  }, []);

  const handleSmoothCollapse = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      onCollapse();
    }, 460);
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    onSelectModule('chat');
    onQuickPrompt(quickQuery.trim());
    setQuickQuery('');
  };

  const activeNodeMeta = RADIAL_NODES.find((n) => n.id === activeModule);

  return (
    <div
      className={`w-screen h-screen bg-black/35 backdrop-blur-[2px] flex items-center justify-center p-4 aurion-backdrop-enter transition-all duration-500 ease-out ${
        isClosing ? 'opacity-0 scale-[0.95] blur-sm' : 'opacity-100 scale-100'
      }`}
    >
      {/* Centered ~55% Screen Floating Pure-Black Command Central */}
      <div className="w-[920px] max-w-[94vw] h-[560px] max-h-[86vh] rounded-2xl bg-black border border-[#C026D3]/45 shadow-[0_0_90px_rgba(168,85,247,0.32)] text-zinc-100 flex flex-col overflow-hidden">
        {/* Top Command Strip: Brand + Quick Search/Request + Produção MAX + Rede MAIN */}
        <div className="px-4 py-2.5 border-b border-white/10 bg-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold tracking-[0.34em] text-[#F5D0FE]">AURION</span>
            {runningJobs.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectModule('tunnels')}
                className="px-2 py-0.5 rounded-full bg-[#24073F] border border-[#E879F9]/55 text-[10px] font-semibold text-[#FAE8FF] flex items-center gap-1"
              >
                <Activity className="w-3 h-3 text-[#F0ABFC] animate-pulse" />
                {runningJobs.length} em túnel
              </button>
            )}
          </div>

          {/* Central Quick Command / Search Input */}
          <form onSubmit={handleQuickSubmit} className="flex-1 max-w-[340px] relative">
            <Search className="w-3.5 h-3.5 text-[#E879F9] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Pedir ferramenta, pesquisar ou mandar comando..."
              className="w-full bg-[#09040F] border border-white/15 focus:border-[#E879F9] rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-400 focus:outline-none transition-colors"
            />
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleProductionMax}
              className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 transition-all duration-300 ${
                productionMax
                  ? 'bg-[#C026D3]/30 border-[#F0ABFC] text-white shadow-[0_0_16px_rgba(232,121,249,0.5)]'
                  : 'bg-[#09040F] border-white/15 text-zinc-200 hover:border-[#C026D3]/60'
              }`}
              title="Supervisionado pergunta antes de mexer no PC; Produção MAX libera acesso autônomo"
            >
              {productionMax ? <Zap className="w-3.5 h-3.5 text-[#F0ABFC]" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
              {productionMax ? 'Produção MAX' : 'Supervisionado'}
            </button>

            <button
              type="button"
              onClick={onOpenRedeMain}
              className="px-2.5 py-1 rounded-full bg-[#19052E] border border-[#C026D3]/70 text-[11px] font-semibold text-[#FAE8FF] hover:bg-[#2A084C] flex items-center gap-1 transition-all"
              title="Abrir Painel Web Completo (Rede MAIN)"
            >
              <ExternalLink className="w-3 h-3" /> Painel Web
            </button>

            <button
              type="button"
              onClick={handleSmoothCollapse}
              className="px-2.5 py-1 rounded-full bg-[#09040F] border border-white/15 text-[11px] text-zinc-300 hover:text-white hover:border-white/35 transition-all"
            >
              Recolher
            </button>
          </div>
        </div>

        {/* Supervised Machine Action Prompt (Human-in-the-Loop) */}
        {pendingRpa && (
          <div className="aurion-panel-switch mx-4 mt-2.5 px-3.5 py-2 rounded-xl bg-[#1C0632] border border-[#F0ABFC]/80 flex items-center justify-between gap-3 shadow-[0_0_24px_rgba(217,70,239,0.35)]">
            <div className="text-xs text-white">
              <span className="font-bold text-[#F0ABFC]">CONFIRMAR AÇÃO NO PC:</span>{' '}
              <code className="px-1.5 py-0.5 rounded bg-black text-[#F5D0FE]">{pendingRpa.action}</code>{' '}
              em ({pendingRpa.norm_x.toFixed(2)}, {pendingRpa.norm_y.toFixed(2)})
              {pendingRpa.text ? ` • "${pendingRpa.text}"` : ''}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onResolveRpa(true)}
                className="px-3 py-1 rounded-lg bg-[#C026D3] hover:bg-[#D946EF] text-white text-xs font-bold"
              >
                Permitir
              </button>
              <button
                type="button"
                onClick={() => onResolveRpa(false)}
                className="px-3 py-1 rounded-lg bg-black border border-white/20 text-zinc-200 text-xs"
              >
                Bloquear
              </button>
            </div>
          </div>
        )}

        {/* 2-Stage Split Body inside the 50% Centered Black Window */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-black">
          {/* LEFT/CENTER: Purple Galaxy + 3D Purple Glass Orbital Buttons */}
          <div className="flex-1 relative min-w-0 bg-black">
            <AurionGalaxyStage
              eyeState={eyeState}
              activeModule={activeModule}
              memories={memories}
              onSelectModule={onSelectModule}
              onMinimize={handleSmoothCollapse}
            />
          </div>

          {/* RIGHT DRAWER: Active Function Content (Pedidos, Execuções em Túnel, Memória, Configs) */}
          <aside className="aurion-stagger-2 w-[360px] shrink-0 border-l border-white/10 bg-[#050209] flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#E879F9]" />
                <span className="text-xs font-bold tracking-wider text-white uppercase">
                  {activeNodeMeta?.label || 'Comando IA'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {activeNodeMeta?.subtitle || 'Voz & Orquestrador'}
              </span>
            </div>

            <div key={activeModule} className="flex-1 p-3.5 overflow-hidden aurion-panel-switch">
              {rightPanelContent}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
