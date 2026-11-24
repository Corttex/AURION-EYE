'use client';

import React, { useState } from 'react';
import {
  Activity,
  Bot,
  Clock,
  Cpu,
  FileText,
  KeyRound,
  Layers,
  Link2,
  MessageSquare,
  Plug,
  Radio,
  Settings,
  Terminal,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import type { WebMainRouteId } from '@aurion/shared-protocol';
import { setStoredToken, vpsFetch } from '@/lib/aurionApi';
import { useAurionStore } from '@/store/useAurionStore';

export const NAV_ITEMS: Array<{
  id: WebMainRouteId;
  label: string;
  headerTitle: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashquadro', label: 'AGENTES (DASHQUADRO)', headerTitle: 'DASHBOARD DASHQUADRO', Icon: Bot },
  { id: 'chat', label: 'CHAT & SESSÕES', headerTitle: 'CHAT & SESSÕES MULTI-AGENTE', Icon: MessageSquare },
  { id: 'logs', label: 'LOGS', headerTitle: 'LOGS EM TEMPO REAL', Icon: Activity },
  { id: 'cron', label: 'CRON', headerTitle: 'ROTINAS & AGENDAMENTOS CRON', Icon: Clock },
  { id: 'habilidades', label: 'HABILIDADES', headerTitle: 'CATÁLOGO DE HABILIDADES (SKILLS)', Icon: Layers },
  { id: 'plugins', label: 'PLUGINS', headerTitle: 'PLUGINS DO HARNESS', Icon: Plug },
  { id: 'mcp', label: 'MCP', headerTitle: 'SERVIDORES MODEL CONTEXT PROTOCOL', Icon: Cpu },
  { id: 'canais', label: 'CANAIS', headerTitle: 'CANAIS (WHATSAPP & E-MAIL HITL)', Icon: Radio },
  { id: 'webhooks', label: 'WEBHOOKS', headerTitle: 'WEBHOOKS DE ENTRADA & SAÍDA', Icon: Webhook },
  { id: 'emparelhamento', label: 'EMPARELHAMENTO', headerTitle: 'EMPARELHAMENTO DE NÓS', Icon: Link2 },
  { id: 'cofre', label: 'COFRE & CHAVES', headerTitle: 'COFRE CRIPTOGRAFADO AES-256', Icon: KeyRound },
  { id: 'anotacoes', label: 'ANOTAÇÕES & CONVERSOR', headerTitle: 'ANOTAÇÕES & CONVERSOR EM LOTE', Icon: FileText },
  { id: 'perfis', label: 'PERFIS', headerTitle: 'PERFIS & PERMISSÕES DE AGENTES', Icon: Users },
  { id: 'configuracoes', label: 'CONFIGURAÇÕES', headerTitle: 'CONFIGURAÇÕES & MATRIZ DO SISTEMA', Icon: Settings },
];

export const ShellLayout: React.FC<{
  children: React.ReactNode;
  onBackToEye: () => void;
}> = ({ children, onBackToEye }) => {
  const {
    activeRoute,
    setActiveRoute,
    activeProfile,
    setActiveProfile,
    selectedNodeId,
    setSelectedNodeId,
    gatewayStatus,
    activeSessions,
    devices,
    authRequired,
    setAuthRequired,
    refreshAll,
  } = useAurionStore();

  const [cmdInput, setCmdInput] = useState('');
  const [cmdOutput, setCmdOutput] = useState<string | null>(null);
  const [cmdBusy, setCmdBusy] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setStoredToken(tokenInput);
    setAuthRequired(false);
    setTokenInput('');
    await refreshAll();
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === activeRoute) || NAV_ITEMS[0];

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = cmdInput.trim();
    if (!raw || cmdBusy) return;
    if (raw === '/clear') {
      setCmdInput('');
      setCmdOutput(null);
      return;
    }
    setCmdBusy(true);
    try {
      const res = await vpsFetch<{ output: string; provider_used?: string }>('/api/command', {
        method: 'POST',
        body: JSON.stringify({ command: raw }),
      });
      setCmdOutput(res.provider_used ? `[${res.provider_used}] ${res.output}` : res.output);
      setCmdInput('');
    } catch (err) {
      setCmdOutput(err instanceof Error ? err.message : 'Falha ao executar comando');
    } finally {
      setCmdBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-obsidian-950 text-zinc-100">
      {/* LEFT FIXED SIDEBAR (240px) */}
      <aside className="w-[240px] shrink-0 bg-obsidian-900 border-r border-[#1A1D26] flex flex-col">
        {/* Identity */}
        <div className="px-4 pt-4 pb-3 border-b border-[#1A1D26] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-obsidian-950 border border-aurion-gold flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.25)]">
            <svg viewBox="0 0 100 100" className="w-5 h-5">
              <path d="M16 50 Q50 30 84 50 Q50 70 16 50 Z" fill="none" stroke="#D4AF37" strokeWidth="6" />
              <circle cx="50" cy="50" r="10" fill="#B8FF2C" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold tracking-widest text-zinc-100">AURION</div>
            <div className="text-[10px] tracking-wider text-[#6B7280] font-semibold">CENTRO DE COMANDO</div>
          </div>
        </div>

        {/* Profile Selector */}
        <div className="px-3 py-2.5 border-b border-[#1A1D26]">
          <select
            value={activeProfile}
            onChange={(e) => setActiveProfile(e.target.value)}
            className="w-full bg-[#13151E] border border-obsidian-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-aurion-gold"
          >
            <option value="admin_root">admin_root</option>
            <option value="aurion_agency">aurion_agency</option>
            <option value="medcore_ops">medcore_ops</option>
          </select>
        </div>

        {/* 14 Operational Routes */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeRoute === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveRoute(id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left ${
                  active
                    ? 'bg-obsidian-800 text-zinc-100 border border-obsidian-border'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-obsidian-850'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    active ? 'bg-aurion-lime shadow-[0_0_8px_#B8FF2C]' : 'bg-transparent'
                  }`}
                />
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-aurion-lime' : 'text-zinc-500'}`} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* SYSTEM Footer */}
        <div className="p-3 border-t border-[#1A1D26] space-y-2 bg-obsidian-950/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">SYSTEM</div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">STATUS DO GATEWAY:</span>
            <span className="text-aurion-lime font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-aurion-lime animate-pulse" />
              {gatewayStatus}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">SESSÕES ATIVAS:</span>
            <span className="font-mono text-zinc-100">{activeSessions}</span>
          </div>
          <button
            type="button"
            onClick={onBackToEye}
            className="w-full py-1.5 rounded-lg bg-[#161822] border border-[#262A38] hover:border-aurion-gold text-xs font-semibold text-zinc-200 transition-colors"
          >
            ← VOLTAR
          </button>
          <button
            type="button"
            onClick={() => setAuthRequired(true)}
            className="w-full py-1 rounded-lg bg-obsidian-900 border border-obsidian-border hover:border-aurion-lime text-[10px] font-mono text-zinc-400 hover:text-aurion-lime transition-colors"
          >
            🔑 Trocar Token
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER (56px) */}
        <header className="h-[56px] shrink-0 bg-obsidian-950 border-b border-obsidian-border px-5 flex items-center justify-between">
          <h1 className="text-xs font-bold tracking-[0.18em] text-zinc-200 uppercase">
            {currentNav.headerTitle}
          </h1>

          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              NÓ DE DESTINO:
            </span>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="bg-obsidian-850 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs font-mono text-aurion-lime focus:outline-none focus:border-aurion-gold"
            >
              <option value="vps_main">VPS-Principal (Hetzner • 14ms)</option>
              <option value="desktop_pc">Desktop-PC (Túnel Ativo • 8ms)</option>
              {devices
                .filter((d) => d.id !== 'vps_main')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.online ? `Ativo • ${d.latency_ms}ms` : 'Offline'})
                  </option>
                ))}
            </select>
          </div>
        </header>

        {/* ROUTE CONTENT */}
        <main className="flex-1 overflow-y-auto p-5 bg-obsidian-950 relative">{children}</main>

        {/* AUTH TOKEN MODAL FOR REMOTE PRODUCTION DOMAIN */}
        {authRequired && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveToken}
              className="w-full max-w-md rounded-2xl bg-obsidian-900 border border-aurion-gold/60 p-6 space-y-4 shadow-2xl"
            >
              <div className="space-y-1">
                <div className="text-xs font-bold tracking-widest text-aurion-gold uppercase">
                  Acesso Restrito • AURION Centro de Comando
                </div>
                <p className="text-xs text-zinc-400">
                  Informe o <span className="font-mono text-zinc-200">AURION_TOKEN</span> configurado no <span className="font-mono text-zinc-200">.env</span> da sua VPS para autenticar este navegador com segurança.
                </p>
              </div>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Cole o AURION_TOKEN aqui..."
                autoFocus
                className="w-full bg-obsidian-950 border border-obsidian-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-aurion-lime"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-aurion-lime text-obsidian-950 text-xs font-bold hover:brightness-110"
              >
                Autenticar no Gateway
              </button>
            </form>
          </div>
        )}

        {/* COMMAND OUTPUT DRAWER */}
        {cmdOutput !== null && (
          <div className="bg-obsidian-900 border-t border-aurion-gold/40 px-4 py-2.5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-xs font-mono text-aurion-lime">
              <Terminal className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{cmdOutput}</span>
            </div>
            <button
              type="button"
              onClick={() => setCmdOutput(null)}
              className="text-zinc-500 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* BOTTOM FIXED TERMINAL COMMAND BAR (48px) */}
        <form
          onSubmit={handleTerminalSubmit}
          className="h-[48px] shrink-0 bg-obsidian-900 border-t border-obsidian-border px-4 flex items-center gap-2.5"
        >
          <span className="font-mono text-sm font-bold text-aurion-lime">&gt;_</span>
          <input
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder="Executar comando manual... (/run, /tunnel, /mcp reload, /cron trigger, /clear)"
            className="flex-1 bg-transparent text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={cmdBusy}
            className="px-3 py-1 rounded bg-obsidian-800 border border-obsidian-border hover:border-aurion-lime text-[11px] font-mono text-zinc-300"
          >
            {cmdBusy ? '...' : 'ENTER'}
          </button>
        </form>
      </div>
    </div>
  );
};
