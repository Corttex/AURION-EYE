'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  Download,
  Mic,
  Play,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getEffectiveToken, resolveHttpBase, vpsFetch, vpsUploadConvert } from '@/lib/aurionApi';
import { useAurionStore } from '@/store/useAurionStore';

export const ChatSessionsView: React.FC = () => {
  const [msgs, setMsgs] = useState<Array<{ role: string; text: string; provider?: string }>>([
    { role: 'assistant', text: 'AURION Rede MAIN pronta. Todas as chamadas passam pelo Adaptive Router (trava Claude ativa).', provider: 'aurion-gateway' },
  ]);
  const [input, setInput] = useState('');
  const [forceClaude, setForceClaude] = useState(false);
  const [voiceReply, setVoiceReply] = useState(true);
  const [listening, setListening] = useState(false);

  const speak = async (text: string) => {
    if (!voiceReply) return;
    try {
      const resp = await fetch(`${resolveHttpBase()}/api/voice/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getEffectiveToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice: 'pt-BR-AntonioNeural' }),
      });
      if (!resp.ok) throw new Error('tts failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR';
        window.speechSynthesis.speak(u);
      }
    }
  };

  const sendText = async (text: string) => {
    if (!text.trim()) return;
    setMsgs((p) => [...p, { role: 'user', text }]);
    const res = await vpsFetch<{ content: string; provider_used: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'web-main', message: text, force_claude: forceClaude }),
    });
    setMsgs((p) => [...p, { role: 'assistant', text: res.content, provider: res.provider_used }]);
    await speak(res.content);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    await sendText(text);
  };

  const captureVoice = () => {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          onend: (() => void) | null;
          onerror: (() => void) | null;
          start: () => void;
        })
      | undefined;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'pt-BR';
    setListening(true);
    rec.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript;
      if (t) sendText(t);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-zinc-400">Sessão Persistente: <strong className="text-aurion-lime">main-orchestrator</strong></span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setVoiceReply((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${voiceReply ? 'border-aurion-lime/50 text-aurion-lime bg-aurion-lime/10' : 'border-obsidian-border text-zinc-400'}`}
          >
            {voiceReply ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Voz Neural {voiceReply ? 'ON' : 'OFF'}
          </button>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={forceClaude} onChange={(e) => setForceClaude(e.target.checked)} className="accent-aurion-gold" />
            Escalonar Claude (Cirúrgico)
          </label>
        </div>
      </div>
      <div className="flex-1 rounded-xl bg-obsidian-900 border border-obsidian-border p-4 overflow-y-auto space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`p-3 rounded-xl text-xs ${m.role === 'user' ? 'bg-obsidian-800 ml-16' : 'bg-obsidian-950 border border-aurion-gold/25 mr-16'}`}>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.provider && <span className="text-[10px] font-mono text-aurion-gold mt-1 inline-block">Motor: {m.provider}</span>}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <button
          type="button"
          onClick={captureVoice}
          title="Falar comando (PT-BR)"
          className={`px-3 py-2 rounded-lg border ${listening ? 'bg-aurion-lime text-obsidian-950 border-aurion-lime animate-pulse' : 'bg-obsidian-900 border-obsidian-border text-aurion-lime hover:border-aurion-lime'}`}
        >
          <Mic className="w-4 h-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fale ou envie um prompt ao Aurion Adaptive Router..."
          className="flex-1 bg-obsidian-900 border border-obsidian-border rounded-lg px-3 py-2 text-xs"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-aurion-lime text-obsidian-950 text-xs font-bold flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> Enviar
        </button>
      </form>
    </div>
  );
};

export const LogsView: React.FC = () => {
  const { logs } = useAurionStore();
  const [levelFilter, setLevelFilter] = useState('ALL');
  const visible = logs.filter((l) => levelFilter === 'ALL' || l.level === levelFilter);

  const exportLogs = () => {
    const text = visible.map((l) => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aurion-tunnel.log';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {['ALL', 'INFO', 'WARN', 'ERROR', 'TUNNEL'].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono ${levelFilter === lvl ? 'bg-aurion-lime text-obsidian-950 font-bold' : 'bg-obsidian-850 text-zinc-400'}`}
            >
              {lvl}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportLogs} className="px-3 py-1.5 rounded-lg bg-obsidian-850 border border-obsidian-border text-xs flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar .log
        </button>
      </div>
      <div className="rounded-xl bg-obsidian-900 border border-obsidian-border p-4 font-mono text-xs space-y-1.5 max-h-[500px] overflow-y-auto">
        {visible.map((l) => (
          <div key={l.id} className="flex gap-3">
            <span className="text-zinc-500 shrink-0">{l.timestamp.slice(11, 19)}</span>
            <span className="text-aurion-gold shrink-0">[{l.level}]</span>
            <span className="text-aurion-purple shrink-0">{l.source}</span>
            <span className="text-zinc-200">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CronView: React.FC = () => {
  const { cronJobs, refreshAll } = useAurionStore();
  return (
    <div className="rounded-xl bg-obsidian-900 border border-obsidian-border overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-obsidian-850 text-zinc-400 border-b border-obsidian-border">
          <tr>
            <th className="p-3">Rotina</th>
            <th className="p-3">Agendamento</th>
            <th className="p-3">Agente</th>
            <th className="p-3">Último Status</th>
            <th className="p-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-obsidian-border">
          {cronJobs.map((c) => (
            <tr key={c.id}>
              <td className="p-3 font-semibold">{c.name}</td>
              <td className="p-3 font-mono text-aurion-gold">{c.human_schedule} ({c.cron_expr})</td>
              <td className="p-3 font-mono text-aurion-lime">{c.assigned_agent}</td>
              <td className="p-3 text-zinc-300">{c.last_status}</td>
              <td className="p-3 text-right">
                <button
                  type="button"
                  onClick={async () => {
                    await vpsFetch(`/api/cron/${c.id}/trigger`, { method: 'POST' });
                    refreshAll();
                  }}
                  className="px-3 py-1 rounded bg-aurion-lime text-obsidian-950 font-bold text-[11px] inline-flex items-center gap-1"
                >
                  <Play className="w-3 h-3" /> Executar Agora
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const McpAndVaultView: React.FC<{ mode: 'mcp' | 'cofre' }> = ({ mode }) => {
  const { secrets, refreshAll } = useAurionStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('API_TOKEN');
  const [value, setValue] = useState('');

  const items = mode === 'mcp' ? secrets.filter((s) => s.category === 'MCP') : secrets;

  const createSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !value.trim()) return;
    await vpsFetch('/api/vault', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), category, value: value.trim() }),
    });
    setName('');
    setValue('');
    refreshAll();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={createSecret} className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border grid grid-cols-1 md:grid-cols-4 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex: GROQ_API_KEY)" className="bg-obsidian-950 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-obsidian-950 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs">
          <option value="API_TOKEN">API_TOKEN</option>
          <option value="MCP">MCP</option>
          <option value="GITHUB_KEY">GITHUB_KEY</option>
          <option value="WEBHOOK">WEBHOOK</option>
          <option value="CHANNEL">CHANNEL</option>
        </select>
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor secreto..." className="bg-obsidian-950 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs" />
        <button type="submit" className="rounded-lg bg-aurion-lime text-obsidian-950 font-bold text-xs flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Salvar AES-256
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.id} className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-100">{item.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-obsidian-800 text-aurion-gold font-mono">{item.category}</span>
              </div>
              <p className="text-xs font-mono text-zinc-500 mt-1">{item.masked_value}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await vpsFetch(`/api/vault/${item.id}/toggle`, { method: 'POST' });
                  refreshAll();
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold ${item.is_active ? 'bg-aurion-lime text-obsidian-950' : 'bg-obsidian-800 text-zinc-400'}`}
              >
                {item.is_active ? 'ATIVO' : 'INATIVO'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await vpsFetch<{ value: string }>(`/api/vault/${item.id}/reveal`, { method: 'POST' });
                  await navigator.clipboard.writeText(res.value);
                }}
                className="p-2 rounded bg-obsidian-850 border border-obsidian-border hover:border-aurion-gold"
              >
                <Clipboard className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChannelsAndEmailsView: React.FC = () => {
  const { emails, refreshAll } = useAurionStore();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-aurion-gold">WhatsApp • Evolution API</h2>
        <div className="p-3 rounded-lg bg-obsidian-950 border border-obsidian-border text-xs space-y-1">
          <div className="flex justify-between"><span>Instância:</span><span className="font-mono text-aurion-lime">aurion-main-wa</span></div>
          <div className="flex justify-between"><span>Status:</span><span className="text-aurion-lime font-bold">Conectado</span></div>
          <div className="flex justify-between"><span>Webhook Entrada:</span><span className="font-mono text-zinc-400">/api/webhooks/in/evolution-wa</span></div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-aurion-gold">
          <ShieldAlert className="w-4 h-4" /> Caixa de E-mail (Human-in-the-Loop)
        </div>
        {emails.map((mail) => (
          <div key={mail.id} className="p-3 rounded-lg bg-obsidian-950 border border-obsidian-border space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold text-zinc-100">{mail.subject}</span>
              <span className="font-mono text-[10px] text-aurion-lime">{mail.status}</span>
            </div>
            <p className="text-zinc-400">Para: {mail.recipient}</p>
            <p className="text-zinc-300 whitespace-pre-wrap">{mail.body}</p>
            {mail.status === 'PENDING_APPROVAL' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await vpsFetch(`/api/emails/${mail.id}/approve-send`, { method: 'POST' });
                    refreshAll();
                  }}
                  className="px-3 py-1 rounded bg-aurion-lime text-obsidian-950 font-bold flex items-center gap-1"
                >
                  <Send className="w-3 h-3" /> Aprovar & Enviar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await vpsFetch(`/api/emails/${mail.id}/discard`, { method: 'POST' });
                    refreshAll();
                  }}
                  className="px-3 py-1 rounded bg-obsidian-800 text-zinc-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Descartar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SettingsAndMatrixView: React.FC = () => {
  const { providers, statusMatrix } = useAurionStore();
  const tiers: Array<{ key: 'WORKS' | 'TESTING' | 'BACKLOG'; label: string; dot: string; border: string }> = [
    { key: 'WORKS', label: '● Funciona', dot: 'text-aurion-lime', border: 'border-aurion-lime/40' },
    { key: 'TESTING', label: '● Em Fase de Testes', dot: 'text-aurion-purple', border: 'border-aurion-purple/40' },
    { key: 'BACKLOG', label: '○ Backlog / Ainda Não', dot: 'text-zinc-400', border: 'border-obsidian-border' },
  ];

  return (
    <div className="space-y-6">
      {/* Adaptive Router Provider Matrix */}
      <div className="rounded-xl bg-obsidian-900 border border-obsidian-border p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-aurion-gold">
          Aurion Adaptive Router — Provedores & Trava Claude
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {providers.map((p) => (
            <div key={p.id} className="p-3 rounded-lg bg-obsidian-950 border border-obsidian-border text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-100">{p.name}</span>
                <span className={`text-[10px] font-mono ${p.is_last_resort ? 'text-aurion-gold' : 'text-aurion-lime'}`}>
                  {p.is_last_resort ? 'ÚLTIMO RECURSO' : `P${p.priority}`}
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400">{p.model}</div>
              <div className="flex justify-between text-[10px] text-zinc-400 pt-1">
                <span>Score: {p.reliability_score}%</span>
                <span>{p.has_key ? 'Chave Ativa' : 'Sem Chave no Cofre'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Column System Status Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {tiers.map((tier) => (
          <div key={tier.key} className={`rounded-xl bg-obsidian-900 border ${tier.border} p-4 space-y-2.5`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${tier.dot}`}>{tier.label}</h3>
            {statusMatrix
              .filter((item) => item.tier === tier.key)
              .map((item) => (
                <div key={item.name} className="p-2.5 rounded-lg bg-obsidian-950 border border-obsidian-border">
                  <div className="text-xs font-semibold text-zinc-100">{item.name}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{item.detail}</div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const PairingView: React.FC = () => {
  const { devices } = useAurionStore();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {devices.map((d) => (
        <div key={d.id} className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-100">{d.name}</span>
            <span className={`font-mono text-[11px] ${d.online ? 'text-aurion-lime' : 'text-zinc-500'}`}>
              {d.online ? `ONLINE • ${d.latency_ms}ms` : 'OFFLINE'}
            </span>
          </div>
          <div className="text-zinc-400 font-mono text-[11px]">IP Túnel: {d.tunnel_ip} • v{d.client_version}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(d.permissions).map(([k, v]) => (
              <span key={k} className={`px-2 py-0.5 rounded text-[10px] font-mono ${v ? 'bg-aurion-lime/15 text-aurion-lime' : 'bg-obsidian-800 text-zinc-500'}`}>
                {k}: {v ? 'ON' : 'OFF'}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const NotesAndConverterView: React.FC = () => {
  const { notes } = useAurionStore();
  const [file, setFile] = useState<File | null>(null);
  const [fmt, setFmt] = useState('webp');
  const [status, setStatus] = useState('');

  const convert = async () => {
    if (!file) return;
    setStatus('Processando na VPS...');
    try {
      const blob = await vpsUploadConvert(file, fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.split('.')[0]}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Arquivo convertido!');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Erro');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-aurion-gold">Base de Conhecimento Markdown</h2>
        {notes.map((n) => (
          <div key={n.id} className="p-3 rounded-lg bg-obsidian-950 border border-obsidian-border space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{n.title}</span>
              {n.indexed_in_memory && <CheckCircle2 className="w-3.5 h-3.5 text-aurion-lime" />}
            </div>
            <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap">{n.content_md}</pre>
          </div>
        ))}
      </div>
      <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-aurion-gold">Conversor em Lote (VPS)</h2>
        <label className="border-2 border-dashed border-aurion-gold/40 rounded-xl p-6 flex flex-col items-center cursor-pointer">
          <Upload className="w-6 h-6 text-aurion-gold mb-2" />
          <span className="text-xs text-zinc-300">{file ? file.name : 'Selecionar arquivo para converter'}</span>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <div className="flex gap-2">
          <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="bg-obsidian-950 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs">
            <option value="webp">WEBP</option>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="html">HTML</option>
          </select>
          <button type="button" onClick={convert} disabled={!file} className="flex-1 py-1.5 rounded-lg bg-aurion-lime text-obsidian-950 font-bold text-xs disabled:opacity-40">
            Converter
          </button>
        </div>
        {status && <p className="text-xs text-aurion-lime">{status}</p>}
      </div>
    </div>
  );
};

export const SimpleCatalogView: React.FC<{ title: string; items: Array<{ name: string; desc: string; tag: string }> }> = ({ title, items }) => (
  <div className="space-y-3">
    <h2 className="text-xs font-bold uppercase tracking-wider text-aurion-gold">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.name} className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-100">{item.name}</span>
            <span className="px-2 py-0.5 rounded bg-obsidian-800 text-[10px] font-mono text-aurion-lime">{item.tag}</span>
          </div>
          <p className="text-xs text-zinc-400">{item.desc}</p>
        </div>
      ))}
    </div>
  </div>
);
