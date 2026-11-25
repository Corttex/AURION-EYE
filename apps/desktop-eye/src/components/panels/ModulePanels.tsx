import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clipboard,
  Mic,
  Pause,
  Play,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  XOctagon,
} from 'lucide-react';
import type {
  AgentTask,
  ConnectorSecretView,
  EmailDraft,
  Habit,
  Note,
  PillFeedbackPayload,
  TunnelJob,
} from '@aurion/shared-protocol';
import { apiFetch, apiUploadConvert } from '../../lib/apiClient';

export interface LocalPermissions {
  microphone: boolean;
  screen_capture: boolean;
  local_rpa: boolean;
  chrome_bridge: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  provider?: string;
}

export const ChatPanel: React.FC<{
  messages: ChatMessage[];
  pill: PillFeedbackPayload | null;
  onSendMessage: (msg: string) => Promise<void>;
  onVoiceToggle: () => void;
  listening: boolean;
}> = ({ messages, pill, onSendMessage, onVoiceToggle, listening }) => {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const txt = input.trim();
    setInput('');
    setBusy(true);
    try {
      await onSendMessage(txt);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-2">
      {pill && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aurion-lime/15 border border-aurion-lime/40 text-aurion-lime text-[11px] self-start">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-semibold">{pill.label}</span>
          {pill.detail && <span className="text-zinc-300 truncate max-w-[200px]">• {pill.detail}</span>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.slice(-15).map((m) => (
          <div
            key={m.id}
            className={`p-2.5 rounded-xl text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-obsidian-900 border border-obsidian-border ml-8 text-zinc-100'
                : 'bg-obsidian-800/90 border border-aurion-gold/25 mr-6 text-zinc-200'
            }`}
          >
            <p>{m.text}</p>
            {m.provider && (
              <span className="mt-1 inline-block text-[10px] text-aurion-gold font-mono">
                via {m.provider}
              </span>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="flex items-center gap-1.5 pt-1 border-t border-obsidian-border">
        <button
          type="button"
          onClick={onVoiceToggle}
          title="Alternar escuta por voz"
          className={`p-2 rounded-lg border transition-colors ${
            listening
              ? 'bg-aurion-lime text-obsidian-950 border-aurion-lime animate-pulse'
              : 'bg-obsidian-900 text-aurion-lime border-obsidian-border hover:border-aurion-lime'
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fale ou digite com o Aurion..."
          className="flex-1 bg-obsidian-900 border border-obsidian-border rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-aurion-gold"
        />
        <button
          type="submit"
          disabled={busy}
          className="p-2 rounded-lg bg-aurion-lime text-obsidian-950 hover:brightness-110 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export const TasksPanel: React.FC = () => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [title, setTitle] = useState('');

  const load = () => {
    apiFetch<AgentTask[]>('/api/tasks').then(setTasks).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), status: 'TODO' }),
    });
    setTitle('');
    load();
  };

  const markDone = async (id: string) => {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DONE' }),
    });
    load();
  };

  const priorityTasks = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS' || t.status === 'READY');

  return (
    <div className="flex flex-col h-full gap-2">
      <form onSubmit={addTask} className="flex gap-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa rápida (Enter → A Fazer)..."
          className="flex-1 bg-obsidian-900 border border-obsidian-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-aurion-gold"
        />
        <button type="submit" className="px-2.5 rounded-lg bg-aurion-lime text-obsidian-950 font-semibold text-xs">
          <Plus className="w-4 h-4" />
        </button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {priorityTasks.map((t) => (
          <div key={t.id} className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-border flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                <span>{t.id}</span>
                <span className="text-aurion-gold">{t.assigned_agent}</span>
                <span className="px-1 rounded bg-obsidian-800 text-aurion-lime">{t.status}</span>
              </div>
              <p className="text-xs text-zinc-100 mt-0.5">{t.title}</p>
            </div>
            <button
              type="button"
              onClick={() => markDone(t.id)}
              title="Concluir"
              className="p-1.5 rounded-lg bg-obsidian-800 hover:bg-aurion-lime hover:text-obsidian-950 text-zinc-300"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TunnelsPanel: React.FC = () => {
  const [jobs, setJobs] = useState<TunnelJob[]>([]);

  const load = () => {
    apiFetch<TunnelJob[]>('/api/tunnels').then(setJobs).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: 'pause' | 'resume' | 'abort') => {
    await apiFetch(`/api/tunnels/${id}/${action}`, { method: 'POST' });
    load();
  };

  return (
    <div className="flex flex-col h-full gap-2 overflow-y-auto pr-1">
      {jobs.map((job) => (
        <div key={job.id} className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-zinc-100">{job.worker_name}</span>
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-obsidian-800 text-aurion-gold font-mono">
                {job.node_target}
              </span>
            </div>
            <span className="text-[10px] font-mono text-aurion-lime">{job.status}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-obsidian-800 overflow-hidden">
            <div className="h-full bg-aurion-lime transition-all" style={{ width: `${job.progress}%` }} />
          </div>
          <div className="text-[10px] font-mono text-zinc-400 bg-obsidian-950 p-1.5 rounded space-y-0.5">
            {job.logs_stream.slice(-3).map((line, i) => (
              <div key={i} className="truncate">{line}</div>
            ))}
          </div>
          {job.status === 'RUNNING' && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => act(job.id, 'pause')}
                className="flex-1 py-1 rounded bg-obsidian-800 text-xs flex items-center justify-center gap-1 hover:border-aurion-gold border border-obsidian-border"
              >
                <Pause className="w-3 h-3" /> Pausar
              </button>
              <button
                type="button"
                onClick={() => act(job.id, 'abort')}
                className="flex-1 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-xs flex items-center justify-center gap-1"
              >
                <XOctagon className="w-3 h-3" /> Abortar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const HabitsPanel: React.FC<{ onStartFocus: () => void; focusRemainingSec: number | null }> = ({
  onStartFocus,
  focusRemainingSec,
}) => {
  const [habits, setHabits] = useState<Habit[]>([]);

  const load = () => {
    apiFetch<Habit[]>('/api/habits').then(setHabits).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const inc = async (id: string) => {
    await apiFetch(`/api/habits/${id}/increment`, { method: 'POST' });
    load();
  };

  return (
    <div className="flex flex-col h-full gap-2.5 overflow-y-auto pr-1">
      <button
        type="button"
        onClick={onStartFocus}
        className="w-full py-2 rounded-xl bg-aurion-gold/15 border border-aurion-gold/50 text-aurion-gold text-xs font-semibold flex items-center justify-center gap-2 hover:bg-aurion-gold/25"
      >
        <Play className="w-3.5 h-3.5" />
        {focusRemainingSec && focusRemainingSec > 0
          ? `Foco ativo (${Math.floor(focusRemainingSec / 60)}m)`
          : 'Iniciar Bloco de Foco (25 min)'}
      </button>

      {habits.map((h) => (
        <div key={h.id} className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-100">{h.name}</p>
            <p className="text-[11px] text-zinc-400">
              Hoje: <span className="text-aurion-lime font-mono">{h.current_count}/{h.target_count}</span> • 🔥 {h.streak_days}d streak
            </p>
          </div>
          <button
            type="button"
            onClick={() => inc(h.id)}
            className="px-2.5 py-1 rounded-lg bg-aurion-lime text-obsidian-950 text-xs font-bold"
          >
            +1
          </button>
        </div>
      ))}
    </div>
  );
};

export const NotesPanel: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [title, setTitle] = useState('Scratchpad Rápido');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    apiFetch<Note[]>('/api/notes')
      .then((rows) => {
        setNotes(rows);
        if (rows[0]) {
          setActiveId(rows[0].id);
          setTitle(rows[0].title);
          setContent(rows[0].content_md);
        }
      })
      .catch(() => {});
  }, []);

  // Debounced auto-save (500ms)
  useEffect(() => {
    if (!content) return;
    const t = window.setTimeout(() => {
      apiFetch<Note>('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ id: activeId, title, content_md: content, tags: ['scratchpad'] }),
      })
        .then((saved) => {
          setActiveId(saved.id);
          setStatus('Salvo na VPS');
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [content, title, activeId]);

  const indexMemory = async () => {
    if (!activeId) return;
    await apiFetch(`/api/notes/${activeId}/index`, { method: 'POST' });
    setStatus('Indexado na memória semântica');
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-obsidian-900 border border-obsidian-border rounded-lg px-2 py-1 text-xs font-semibold"
        />
        <span className="text-[10px] text-zinc-400">{notes.length} notas</span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Capture ideias em Markdown..."
        className="flex-1 bg-obsidian-900 border border-obsidian-border rounded-xl p-2.5 text-xs font-mono resize-none focus:outline-none focus:border-aurion-gold"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-aurion-lime">{status}</span>
        <button
          type="button"
          onClick={indexMemory}
          className="px-3 py-1 rounded-lg bg-obsidian-800 border border-aurion-gold/60 text-aurion-gold text-xs flex items-center gap-1.5 hover:bg-obsidian-900"
        >
          <Sparkles className="w-3.5 h-3.5" /> Indexar na Memória
        </button>
      </div>
    </div>
  );
};

export const ConverterPanel: React.FC<{ initialFile: File | null }> = ({ initialFile }) => {
  const [file, setFile] = useState<File | null>(initialFile);
  const [targetFmt, setTargetFmt] = useState('webp');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      const ext = initialFile.name.split('.').pop()?.toLowerCase();
      if (ext === 'json') setTargetFmt('csv');
      else if (ext === 'csv') setTargetFmt('json');
      else if (ext === 'md' || ext === 'txt') setTargetFmt('html');
      else setTargetFmt('webp');
    }
  }, [initialFile]);

  const convert = async () => {
    if (!file) return;
    setMsg('Convertendo na VPS...');
    try {
      const blob = await apiUploadConvert(file, targetFmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.split('.')[0]}.${targetFmt}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Conversão concluída e baixada!');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro na conversão');
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 justify-between">
      <label className="flex-1 border-2 border-dashed border-aurion-gold/45 rounded-xl bg-obsidian-900/70 flex flex-col items-center justify-center p-4 cursor-pointer hover:border-aurion-lime">
        <Upload className="w-6 h-6 text-aurion-gold mb-1.5" />
        <span className="text-xs text-zinc-200 text-center">
          {file ? file.name : 'Arraste para o Olho ou clique para selecionar arquivo'}
        </span>
        <input
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>

      <div className="flex items-center gap-2">
        <select
          value={targetFmt}
          onChange={(e) => setTargetFmt(e.target.value)}
          className="bg-obsidian-900 border border-obsidian-border rounded-lg px-2.5 py-1.5 text-xs"
        >
          <option value="webp">WEBP</option>
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
        </select>
        <button
          type="button"
          disabled={!file}
          onClick={convert}
          className="flex-1 py-1.5 rounded-lg bg-aurion-lime text-obsidian-950 font-bold text-xs disabled:opacity-40"
        >
          Converter Agora
        </button>
      </div>
      {msg && <p className="text-[11px] text-aurion-lime text-center">{msg}</p>}
    </div>
  );
};

export const ConnectorsPanel: React.FC = () => {
  const [items, setItems] = useState<ConnectorSecretView[]>([]);
  const [query, setQuery] = useState('');
  const [clearSec, setClearSec] = useState<number | null>(null);

  const load = () => {
    apiFetch<ConnectorSecretView[]>('/api/vault').then(setItems).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (clearSec === null) return;
    if (clearSec <= 0) {
      navigator.clipboard?.writeText('').catch(() => {});
      setClearSec(null);
      return;
    }
    const id = window.setTimeout(() => setClearSec((s) => (s ? s - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [clearSec]);

  const copySecret = async (id: string) => {
    const res = await apiFetch<{ value: string }>(`/api/vault/${id}/reveal`, { method: 'POST' });
    await navigator.clipboard.writeText(res.value);
    setClearSec(30);
  };

  const toggleMcp = async (id: string) => {
    await apiFetch(`/api/vault/${id}/toggle`, { method: 'POST' });
    load();
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar MCP ou chave..."
          className="flex-1 bg-obsidian-900 border border-obsidian-border rounded-lg px-2.5 py-1.5 text-xs"
        />
        {clearSec !== null && (
          <span className="text-[10px] px-2 py-1 rounded bg-aurion-gold/20 text-aurion-gold font-mono">
            Limpa em {clearSec}s
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {filtered.map((item) => (
          <div key={item.id} className="p-2 rounded-xl bg-obsidian-900 border border-obsidian-border flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-100 truncate">{item.name}</span>
                <span className="text-[9px] px-1 rounded bg-obsidian-800 text-aurion-gold">{item.category}</span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500">{item.masked_value}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {item.category === 'MCP' && (
                <button
                  type="button"
                  onClick={() => toggleMcp(item.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.is_active ? 'bg-aurion-lime text-obsidian-950' : 'bg-obsidian-800 text-zinc-400'
                  }`}
                >
                  {item.is_active ? 'ON' : 'OFF'}
                </button>
              )}
              <button
                type="button"
                onClick={() => copySecret(item.id)}
                title="Copiar (auto-limpa em 30s)"
                className="p-1.5 rounded bg-obsidian-800 hover:border-aurion-gold border border-obsidian-border text-zinc-200"
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

export const EmailsPanel: React.FC = () => {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);

  const load = () => {
    apiFetch<EmailDraft[]>('/api/emails').then(setDrafts).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, kind: 'approve-send' | 'discard') => {
    await apiFetch(`/api/emails/${id}/${kind}`, { method: 'POST' });
    load();
  };

  const pending = drafts.filter((d) => d.status === 'PENDING_APPROVAL');

  return (
    <div className="flex flex-col h-full gap-2 overflow-y-auto pr-1">
      <div className="px-2.5 py-1.5 rounded-lg bg-aurion-gold/10 border border-aurion-gold/30 text-[11px] text-aurion-gold flex items-center gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        Trava Human-in-the-Loop ativa: nenhum disparo sem seu aval.
      </div>
      {pending.length === 0 ? (
        <p className="text-xs text-zinc-400 text-center py-8">Nenhum rascunho pendente de aprovação.</p>
      ) : (
        pending.map((d) => (
          <div key={d.id} className="p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-border space-y-2">
            <div className="text-[11px] text-zinc-400">Para: <span className="text-zinc-100">{d.recipient}</span></div>
            <div className="text-xs font-semibold text-aurion-gold">{d.subject}</div>
            <p className="text-[11px] text-zinc-300 whitespace-pre-wrap bg-obsidian-950 p-2 rounded">{d.body}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => act(d.id, 'approve-send')}
                className="flex-1 py-1.5 rounded-lg bg-aurion-lime text-obsidian-950 font-bold text-xs flex items-center justify-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Enviar
              </button>
              <button
                type="button"
                onClick={() => act(d.id, 'discard')}
                className="px-3 py-1.5 rounded-lg bg-obsidian-800 border border-obsidian-border text-zinc-300 text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Descartar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

import type { AurionVoiceName } from '../../lib/voiceEngine';
import {
  AurionConnectionConfig,
  getConnectionConfig,
  setConnectionConfig,
} from '../../lib/apiClient';

export const SettingsPanel: React.FC<{
  permissions: LocalPermissions;
  onChangePermissions: (next: LocalPermissions) => void;
  wakeWord: 'Aurion' | 'Hórus';
  onChangeWakeWord: (w: 'Aurion' | 'Hórus') => void;
  ttsEnabled: boolean;
  onToggleTts: (v: boolean) => void;
  voiceName: AurionVoiceName;
  onChangeVoiceName: (v: AurionVoiceName) => void;
  wakeWordContinuous: boolean;
  onToggleWakeWordContinuous: (v: boolean) => void;
  onTestVoice: () => void;
  onReconnectTunnel: () => void;
}> = ({
  permissions,
  onChangePermissions,
  wakeWord,
  onChangeWakeWord,
  ttsEnabled,
  onToggleTts,
  voiceName,
  onChangeVoiceName,
  wakeWordContinuous,
  onToggleWakeWordContinuous,
  onTestVoice,
  onReconnectTunnel,
}) => {
  const [connCfg, setConnCfg] = useState<AurionConnectionConfig>(() => getConnectionConfig());
  const [savedNotice, setSavedNotice] = useState('');

  const saveConnection = () => {
    setConnectionConfig(connCfg);
    onReconnectTunnel();
    setSavedNotice(
      connCfg.mode === 'cloud'
        ? 'Conectado a eyeglobal.aurionagency.com.br'
        : 'Conectado ao Localhost'
    );
  };

  const toggle = (k: keyof LocalPermissions) => {
    onChangePermissions({ ...permissions, [k]: !permissions[k] });
  };

  const labels: Array<{ key: keyof LocalPermissions; label: string }> = [
    { key: 'microphone', label: 'Acesso ao Microfone' },
    { key: 'screen_capture', label: 'Captura de Tela sob Demanda' },
    { key: 'local_rpa', label: 'Controle RPA Local (Mouse e Teclado)' },
    { key: 'chrome_bridge', label: 'Ponte Extensão Chrome' },
  ];

  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1">
      <div className="space-y-1.5 p-2.5 rounded-xl bg-obsidian-900 border border-aurion-gold/30">
        <span className="text-[10px] uppercase tracking-wider text-aurion-gold font-semibold">
          Servidor Cérebro (VPS / Local)
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setConnCfg((c) => ({ ...c, mode: 'cloud' }))}
            className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold truncate ${
              connCfg.mode === 'cloud'
                ? 'bg-aurion-lime text-obsidian-950 border-aurion-lime'
                : 'bg-obsidian-950 text-zinc-300 border-obsidian-border'
            }`}
          >
            ☁️ eyeglobal...
          </button>
          <button
            type="button"
            onClick={() => setConnCfg((c) => ({ ...c, mode: 'local' }))}
            className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold ${
              connCfg.mode === 'local'
                ? 'bg-aurion-lime text-obsidian-950 border-aurion-lime'
                : 'bg-obsidian-950 text-zinc-300 border-obsidian-border'
            }`}
          >
            💻 Localhost
          </button>
        </div>
        <input
          type="password"
          value={connCfg.token}
          onChange={(e) => setConnCfg((c) => ({ ...c, token: e.target.value }))}
          placeholder="AURION_TOKEN da VPS..."
          className="w-full bg-obsidian-950 border border-obsidian-border rounded-lg px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:border-aurion-gold"
        />
        <button
          type="button"
          onClick={saveConnection}
          className="w-full py-1.5 rounded-lg bg-aurion-gold/20 border border-aurion-gold/60 text-aurion-gold text-[11px] font-bold hover:bg-aurion-gold/30"
        >
          Salvar &amp; Reconectar Túnel
        </button>
        {savedNotice && <p className="text-[10px] text-aurion-lime text-center">{savedNotice}</p>}
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">Permissões Locais</span>
        {labels.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center justify-between p-2 rounded-lg bg-obsidian-900 border border-obsidian-border text-xs cursor-pointer"
          >
            <span>{label}</span>
            <input
              type="checkbox"
              checked={permissions[key]}
              onChange={() => toggle(key)}
              className="accent-aurion-lime w-4 h-4"
            />
          </label>
        ))}
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">Voz Bidirecional (PT-BR Neural)</span>
        <label className="flex items-center justify-between p-2 rounded-lg bg-obsidian-900 border border-obsidian-border text-xs cursor-pointer">
          <span>Resposta Falada (TTS)</span>
          <input
            type="checkbox"
            checked={ttsEnabled}
            onChange={() => onToggleTts(!ttsEnabled)}
            className="accent-aurion-lime w-4 h-4"
          />
        </label>
        <label className="flex items-center justify-between p-2 rounded-lg bg-obsidian-900 border border-obsidian-border text-xs cursor-pointer">
          <span>Escuta Contínua ("{wakeWord}...")</span>
          <input
            type="checkbox"
            checked={wakeWordContinuous}
            onChange={() => onToggleWakeWordContinuous(!wakeWordContinuous)}
            className="accent-aurion-lime w-4 h-4"
          />
        </label>
        <div className="flex gap-2">
          <select
            value={voiceName}
            onChange={(e) => onChangeVoiceName(e.target.value as AurionVoiceName)}
            className="flex-1 bg-obsidian-900 border border-obsidian-border rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="pt-BR-AntonioNeural">Antonio (Alfred / Masculina)</option>
            <option value="pt-BR-FranciscaNeural">Francisca (Feminina)</option>
          </select>
          <button
            type="button"
            onClick={onTestVoice}
            className="px-3 py-1.5 rounded-lg bg-aurion-gold/20 border border-aurion-gold/50 text-aurion-gold text-xs font-semibold hover:bg-aurion-gold/30"
          >
            Testar Voz
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">Wake-Word de Voz</span>
        <div className="flex gap-2">
          {(['Aurion', 'Hórus'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onChangeWakeWord(w)}
              className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                wakeWord === w
                  ? 'bg-aurion-lime text-obsidian-950 border-aurion-lime'
                  : 'bg-obsidian-900 text-zinc-300 border-obsidian-border'
              }`}
            >
              "{w}..."
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
