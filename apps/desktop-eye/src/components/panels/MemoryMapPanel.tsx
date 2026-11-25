import React, { useEffect, useMemo, useState } from 'react';
import { Brain, FileText, Plus, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { NotesPanel } from './ModulePanels';

interface MemoryFactItem {
  id: string;
  scope: string;
  fact_text: string;
  tags: string[];
  importance: number;
  updated_at: string;
}

interface VpsItem {
  id: string;
  name: string;
  host: string;
  specs: string;
  status: string;
  services: string[];
}

interface NeuronNode {
  id: string;
  label: string;
  scope: string;
  importance: number;
  tags: string[];
  updatedAt: string;
  x: number;
  y: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  color: string;
  glow: string;
  radius: number;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const SCOPE_PALETTE: Record<string, { angle: number; color: string; glow: string }> = {
  vps: { angle: -2.25, color: '#F0ABFC', glow: '#D946EF' },
  project: { angle: -0.55, color: '#C084FC', glow: '#9333EA' },
  global: { angle: 0.72, color: '#E879F9', glow: '#A855F7' },
  notes: { angle: 2.35, color: '#F5D0FE', glow: '#C026D3' },
};

function getScopeMeta(scope: string) {
  const prefix = scope.split(':')[0]?.toLowerCase() || 'global';
  return SCOPE_PALETTE[prefix] || SCOPE_PALETTE.global;
}

export const MemoryMapPanel: React.FC = () => {
  const [tab, setTab] = useState<'map' | 'notes'>('map');
  const [facts, setFacts] = useState<MemoryFactItem[]>([]);
  const [vpsNodes, setVpsNodes] = useState<VpsItem[]>([]);
  const [selected, setSelected] = useState<NeuronNode | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [newFact, setNewFact] = useState('');
  const [newScope, setNewScope] = useState('project:aurion');
  const [saving, setSaving] = useState(false);

  const loadMemories = () => {
    apiFetch<MemoryFactItem[]>('/api/memory/facts').then(setFacts).catch(() => {});
    apiFetch<VpsItem[]>('/api/vps').then(setVpsNodes).catch(() => {});
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/memory/facts', {
        method: 'POST',
        body: JSON.stringify({
          fact_text: newFact.trim(),
          scope: newScope,
          tags: ['manual'],
          importance: 8,
        }),
      });
      setNewFact('');
      loadMemories();
    } finally {
      setSaving(false);
    }
  };

  // Build organic dendritic neural layout on 680x430 canvas
  const somaX = 250;
  const somaY = 215;

  const neurons = useMemo<NeuronNode[]>(() => {
    const rawItems: Array<{
      id: string;
      label: string;
      scope: string;
      importance: number;
      tags: string[];
      updatedAt: string;
    }> = [
      ...vpsNodes.map((v) => ({
        id: v.id,
        label: `VPS ${v.name} (${v.host}) — ${v.specs} • Serviços: ${v.services.join(', ')}`,
        scope: `vps:${v.name}`,
        importance: 10,
        tags: [v.status, 'infra'],
        updatedAt: 'Ativo',
      })),
      ...facts.map((f) => ({
        id: f.id,
        label: f.fact_text,
        scope: f.scope,
        importance: f.importance,
        tags: f.tags || [],
        updatedAt: f.updated_at?.slice(0, 16).replace('T', ' ') || '',
      })),
    ];

    return rawItems.map((item, idx) => {
      const meta = getScopeMeta(item.scope);
      const r1 = hashStr(item.id + 'a');
      const r2 = hashStr(item.id + 'b');
      const r3 = hashStr(item.id + 'c');

      const spread = (r1 - 0.5) * 1.15 + (idx % 3 - 1) * 0.16;
      const angle = meta.angle + spread;
      const dist = 95 + r2 * 135;

      const x = Math.max(28, Math.min(652, somaX + Math.cos(angle) * dist * 1.25));
      const y = Math.max(24, Math.min(406, somaY + Math.sin(angle) * dist * 0.92));

      // Organic curving dendrite control points
      const bend = (r3 - 0.5) * 85;
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const c1x = somaX + Math.cos(angle) * (dist * 0.36) + perpX * bend * 0.55;
      const c1y = somaY + Math.sin(angle) * (dist * 0.36) + perpY * bend * 0.55;
      const c2x = somaX + Math.cos(angle) * (dist * 0.78) - perpX * bend * 0.45;
      const c2y = somaY + Math.sin(angle) * (dist * 0.78) - perpY * bend * 0.45;

      return {
        ...item,
        x,
        y,
        c1x,
        c1y,
        c2x,
        c2y,
        color: meta.color,
        glow: meta.glow,
        radius: 3.4 + (item.importance / 10) * 3.6,
      };
    });
  }, [facts, vpsNodes]);

  // Ambient fine background dendritic filaments for the organic Neurones look
  const ambientFilaments = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const angle = (i / 42) * Math.PI * 2 + hashStr(`amb-${i}`) * 0.28;
      const dist = 70 + hashStr(`ambd-${i}`) * 165;
      const tx = somaX + Math.cos(angle) * dist * 1.28;
      const ty = somaY + Math.sin(angle) * dist * 0.95;
      const bend = (hashStr(`ambb-${i}`) - 0.5) * 70;
      const c1x = somaX + Math.cos(angle) * dist * 0.4 - Math.sin(angle) * bend;
      const c1y = somaY + Math.sin(angle) * dist * 0.4 + Math.cos(angle) * bend;
      return {
        d: `M ${somaX} ${somaY} Q ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`,
        tx,
        ty,
        r: 1.0 + hashStr(`ambr-${i}`) * 1.2,
      };
    });
  }, []);

  useEffect(() => {
    if (!selected && neurons[0]) {
      setSelected(neurons[0]);
    }
  }, [neurons, selected]);

  if (tab === 'notes') {
    return (
      <div className="flex flex-col h-full gap-2">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <span className="text-xs font-bold tracking-widest text-[#F5D0FE]">NOTAS LINEARES (.MD)</span>
          <button
            type="button"
            onClick={() => setTab('map')}
            className="px-2.5 py-1 rounded-full bg-[#2E074F] border border-[#E879F9]/50 text-[10px] font-bold text-white flex items-center gap-1"
          >
            <Brain className="w-3 h-3" /> Ver Mapa Neural
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <NotesPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2.5 bg-black">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold tracking-[0.2em] text-[#F5D0FE] uppercase">
            MAPA DE MEMÓRIA NEURAL
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#1E0536] border border-[#C026D3]/40 text-[10px] font-mono text-[#E879F9]">
            {neurons.length} sinapses ativas
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTab('notes')}
          className="px-2.5 py-1 rounded-full bg-zinc-950 border border-white/15 hover:border-[#E879F9]/50 text-[10px] text-zinc-300 flex items-center gap-1"
        >
          <FileText className="w-3 h-3" /> Notas Markdown
        </button>
      </div>

      {/* Main 100% Black Dendritic Neural Canvas + Inspector */}
      <div className="relative flex-1 rounded-xl bg-black border border-[#9333EA]/30 overflow-hidden flex">
        <svg viewBox="0 0 680 430" className="w-full h-full">
          <defs>
            <radialGradient id="somaPurple" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#E879F9" stopOpacity="0.65" />
              <stop offset="65%" stopColor="#7E22CE" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <filter id="neuronGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle central neural core glow */}
          <circle cx={somaX} cy={somaY} r="90" fill="url(#somaPurple)" />

          {/* Ambient background micro-dendrites (Neurones organic texture) */}
          {ambientFilaments.map((f, idx) => (
            <g key={`amb-${idx}`} opacity="0.24">
              <path d={f.d} fill="none" stroke="#9333EA" strokeWidth="0.7" />
              <circle cx={f.tx} cy={f.ty} r={f.r} fill="#C084FC" />
            </g>
          ))}

          {/* Real Memory Dendritic Branches */}
          {neurons.map((n) => {
            const isActive = selected?.id === n.id || hoveredId === n.id;
            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelected(n)}
              >
                <path
                  d={`M ${somaX} ${somaY} C ${n.c1x.toFixed(1)} ${n.c1y.toFixed(1)}, ${n.c2x.toFixed(1)} ${n.c2y.toFixed(
                    1
                  )}, ${n.x.toFixed(1)} ${n.y.toFixed(1)}`}
                  fill="none"
                  stroke={isActive ? '#FAE8FF' : n.glow}
                  strokeWidth={isActive ? 2.1 : 1.05}
                  strokeOpacity={isActive ? 0.95 : 0.48}
                />
                {/* Outer halo dot */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isActive ? n.radius + 5 : n.radius + 2.2}
                  fill={n.glow}
                  opacity={isActive ? 0.45 : 0.2}
                />
                {/* Core memory point */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isActive ? n.radius + 1.2 : n.radius}
                  fill={isActive ? '#FFFFFF' : n.color}
                  filter="url(#neuronGlow)"
                />
              </g>
            );
          })}

          {/* Central Neural Soma */}
          <circle cx={somaX} cy={somaY} r="10" fill="#090112" stroke="#F0ABFC" strokeWidth="1.6" />
          <circle cx={somaX} cy={somaY} r="4" fill="#FFFFFF" filter="url(#neuronGlow)" />
        </svg>

        {/* Floating Memory Inspector Card (bottom-left inside black canvas) */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-black/90 border border-[#C026D3]/50 backdrop-blur-md shadow-[0_0_24px_rgba(168,85,247,0.28)]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-[#2E074F] text-[#F5D0FE] text-[10px] font-mono uppercase">
                {selected.scope}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                IMP {selected.importance}/10 • {selected.updatedAt}
              </span>
            </div>
            <p className="text-xs text-zinc-100 leading-relaxed">{selected.label}</p>
          </div>
        )}
      </div>

      {/* Quick Sprout New Memory Bar */}
      <form onSubmit={handleAddMemory} className="flex items-center gap-2">
        <select
          value={newScope}
          onChange={(e) => setNewScope(e.target.value)}
          className="bg-zinc-950 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-[#E9D5FF] focus:outline-none focus:border-[#E879F9]"
        >
          <option value="project:aurion">Projeto</option>
          <option value="vps:hetzner-main">VPS</option>
          <option value="global">Global</option>
        </select>
        <input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          placeholder="Adicionar nova memória neural na VPS..."
          className="flex-1 bg-zinc-950 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#E879F9]"
        />
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-[#C026D3] hover:bg-[#D946EF] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
        >
          {saving ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Memorizar
        </button>
      </form>
    </div>
  );
};
