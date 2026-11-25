import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EyeModuleId,
  EyeState,
  PillFeedbackPayload,
  WsServerEvent,
} from '@aurion/shared-protocol';
import { HorusEyeSphere } from './components/HorusEyeSphere';
import { RADIAL_NODES, RadialHub } from './components/RadialHub';
import {
  ChatMessage,
  ChatPanel,
  ConnectorsPanel,
  ConverterPanel,
  EmailsPanel,
  HabitsPanel,
  LocalPermissions,
  NotesPanel,
  SettingsPanel,
  TasksPanel,
  TunnelsPanel,
} from './components/panels/ModulePanels';
import { apiFetch, getWebMainUrl, getWsUrl } from './lib/apiClient';
import {
  captureScreenIfTauri,
  executeRpaIfTauri,
  openRedeMainUrl,
  OverlayMode,
  setOverlayMode,
} from './lib/tauriBridge';
import {
  AurionVoiceName,
  speakWithAurion,
  startOneShotRecognition,
  WakeWordDetector,
} from './lib/voiceEngine';

export default function App() {
  const [mode, setMode] = useState<OverlayMode>('sphere');
  const [activeModule, setActiveModule] = useState<EyeModuleId>('chat');
  const [eyeState, setEyeState] = useState<EyeState>('IDLE');
  const [activeTunnelsCount, setActiveTunnelsCount] = useState(0);
  const [pendingEmailsCount, setPendingEmailsCount] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [pill, setPill] = useState<PillFeedbackPayload | null>(null);
  const [focusRemainingSec, setFocusRemainingSec] = useState<number | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [listening, setListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voiceName, setVoiceName] = useState<AurionVoiceName>('pt-BR-AntonioNeural');
  const [wakeWordContinuous, setWakeWordContinuous] = useState(false);
  const [wakeWord, setWakeWord] = useState<'Aurion' | 'Hórus'>('Aurion');
  const [connectionVersion, setConnectionVersion] = useState(0);
  const [productionMax, setProductionMax] = useState(false);
  const [pendingRpa, setPendingRpa] = useState<{
    request_id: string;
    action: string;
    norm_x: number;
    norm_y: number;
    text?: string;
  } | null>(null);
  const [permissions, setPermissions] = useState<LocalPermissions>({
    microphone: true,
    screen_capture: true,
    local_rpa: false,
    chrome_bridge: true,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      text: 'Olho de Hórus sincronizado com a VPS. Clique nos nós ou arraste um arquivo para converter.',
      provider: 'aurion-gateway',
    },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const permissionsRef = useRef(permissions);
  permissionsRef.current = permissions;
  const productionMaxRef = useRef(productionMax);
  productionMaxRef.current = productionMax;
  const stopRecRef = useRef<(() => void) | null>(null);
  const wakeDetectorRef = useRef<WakeWordDetector | null>(null);
  const ttsRef = useRef(ttsEnabled);
  ttsRef.current = ttsEnabled;
  const voiceRef = useRef(voiceName);
  voiceRef.current = voiceName;

  // Sync Tauri window dimensions when mode changes
  useEffect(() => {
    setOverlayMode(mode);
  }, [mode]);

  // Global Alt+Space shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        setMode((prev) => (prev === 'sphere' ? 'radial' : 'sphere'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus 25-min timer
  useEffect(() => {
    if (focusRemainingSec === null || focusRemainingSec <= 0) return;
    const id = window.setTimeout(() => setFocusRemainingSec((s) => (s ? s - 1 : 0)), 1000);
    return () => clearTimeout(id);
  }, [focusRemainingSec]);

  // WebSocket Tunnel Connection to VPS Harness
  useEffect(() => {
    let closed = false;
    let timer: number;

    const connect = () => {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'REGISTER_NODE',
            node_type: 'DESKTOP_PC',
            name: 'Desktop-PC (Aurion Eye)',
            client_version: '1.0.0',
            permissions: permissionsRef.current,
          })
        );
      };

      ws.onmessage = async (evt) => {
        try {
          const event = JSON.parse(evt.data) as WsServerEvent;
          if (event.type === 'GATEWAY_STATE') {
            setEyeState(event.payload.eye_state);
            setActiveTunnelsCount(event.payload.active_tunnels_count);
            if (event.payload.pending_emails_count !== undefined) {
              setPendingEmailsCount(event.payload.pending_emails_count);
            }
            if (event.payload.banner !== undefined) setBanner(event.payload.banner);
          } else if (event.type === 'EYE_STATE') {
            setEyeState(event.state);
            setBanner(event.banner ?? null);
          } else if (event.type === 'PILL_FEEDBACK') {
            setPill({ label: event.label, detail: event.detail, variant: event.variant });
          } else if (event.type === 'FOCUS_EYE') {
            setMode('radial');
          } else if (event.type === 'CAPTURE_SCREEN') {
            if (!permissionsRef.current.screen_capture) {
              ws.send(JSON.stringify({ type: 'DESKTOP_ACTION_RESULT', request_id: event.request_id, payload: { aborted: true } }));
              return;
            }
            const cap = await captureScreenIfTauri();
            ws.send(JSON.stringify({ type: 'DESKTOP_ACTION_RESULT', request_id: event.request_id, payload: cap }));
          } else if (event.type === 'EXECUTE_INPUT') {
            if (!productionMaxRef.current) {
              // Modo Supervisionado: sempre pergunta ao usuário antes de mexer no mouse/teclado
              setPendingRpa({
                request_id: event.request_id,
                action: event.action,
                norm_x: event.norm_x,
                norm_y: event.norm_y,
                text: event.text,
              });
              setMode('popover');
              return;
            }
            const ok = await executeRpaIfTauri({
              action: event.action,
              norm_x: event.norm_x,
              norm_y: event.norm_y,
              text: event.text,
            });
            ws.send(JSON.stringify({ type: 'DESKTOP_ACTION_RESULT', request_id: event.request_id, payload: { aborted: !ok } }));
          }
        } catch {
          // ignore malformed event
        }
      };

      ws.onclose = () => {
        if (!closed) timer = window.setTimeout(connect, 2500);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [connectionVersion]);

  const handlePanic = useCallback((reason: string) => {
    setEyeState('ALERT');
    setBanner(`PÂNICO: ${reason}`);
    wsRef.current?.send(JSON.stringify({ type: 'RPA_PANIC', reason }));
  }, []);

  const handleFileDrop = useCallback((file: File) => {
    setDroppedFile(file);
    setActiveModule('converter');
    setMode('popover');
  }, []);

  const speakReply = useCallback(async (text: string) => {
    if (!ttsRef.current) return;
    await speakWithAurion(text, {
      voice: voiceRef.current,
      onLevel: setAudioLevel,
      onStart: () => setEyeState('SPEAKING'),
      onEnd: () => {
        setAudioLevel(0);
        setEyeState('IDLE');
      },
    });
  }, []);

  const handleSendChat = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { id: String(Date.now()), role: 'user', text }]);
    const res = await apiFetch<{ content: string; provider_used: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'desktop-eye', message: text }),
    });
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now() + 1), role: 'assistant', text: res.content, provider: res.provider_used },
    ]);
    await speakReply(res.content);
  }, [speakReply]);

  const toggleVoiceCapture = useCallback(() => {
    if (!permissionsRef.current.microphone) {
      setPill({ label: 'Microfone bloqueado', detail: 'Ative em Ajustes', variant: 'warning' });
      return;
    }
    if (listening) {
      stopRecRef.current?.();
      stopRecRef.current = null;
      setListening(false);
      setEyeState('IDLE');
      return;
    }
    setListening(true);
    setEyeState('LISTENING');
    stopRecRef.current = startOneShotRecognition(
      (transcript) => {
        setListening(false);
        handleSendChat(transcript);
      },
      (err) => {
        setListening(false);
        setEyeState('IDLE');
        setPill({ label: 'Voz', detail: err, variant: 'warning' });
      },
      () => {
        setListening(false);
      }
    );
  }, [listening, handleSendChat]);

  // Global Alt+V push-to-talk shortcut
  useEffect(() => {
    const onVoiceKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyV') {
        e.preventDefault();
        setActiveModule('chat');
        setMode('popover');
        toggleVoiceCapture();
      }
    };
    window.addEventListener('keydown', onVoiceKey);
    return () => window.removeEventListener('keydown', onVoiceKey);
  }, [toggleVoiceCapture]);

  // Continuous wake-word listener ("Aurion..." / "Hórus...")
  useEffect(() => {
    wakeDetectorRef.current?.stop();
    if (!wakeWordContinuous || !permissions.microphone) return;

    const detector = new WakeWordDetector();
    wakeDetectorRef.current = detector;
    detector.start(wakeWord, (cmd) => {
      setActiveModule('chat');
      setMode('popover');
      if (cmd === 'Estou ouvindo') {
        speakReply('Estou ouvindo. Como posso ajudar?');
      } else {
        handleSendChat(cmd);
      }
    });
    return () => detector.stop();
  }, [wakeWordContinuous, wakeWord, permissions.microphone, handleSendChat, speakReply]);

  const toggleProductionMax = useCallback(() => {
    setProductionMax((prev) => {
      const next = !prev;
      setPermissions((p) => ({ ...p, local_rpa: next }));
      setBanner(next ? 'PRODUÇÃO MAX ATIVO (Acesso Livre)' : 'Modo Supervisionado');
      return next;
    });
  }, []);

  const resolvePendingRpa = useCallback(async (approved: boolean) => {
    if (!pendingRpa) return;
    const req = pendingRpa;
    setPendingRpa(null);
    if (!approved) {
      wsRef.current?.send(
        JSON.stringify({ type: 'DESKTOP_ACTION_RESULT', request_id: req.request_id, payload: { aborted: true } })
      );
      return;
    }
    const ok = await executeRpaIfTauri({
      action: req.action,
      norm_x: req.norm_x,
      norm_y: req.norm_y,
      text: req.text,
    });
    wsRef.current?.send(
      JSON.stringify({ type: 'DESKTOP_ACTION_RESULT', request_id: req.request_id, payload: { aborted: !ok } })
    );
  }, [pendingRpa]);

  if (mode === 'sphere') {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-transparent">
        <HorusEyeSphere
          eyeState={eyeState}
          activeTunnelsCount={activeTunnelsCount}
          focusRemainingSec={focusRemainingSec}
          audioLevel={audioLevel}
          banner={banner}
          isDragOver={isDragOver}
          onDragStateChange={setIsDragOver}
          onClick={() => setMode('radial')}
          onPanicTrigger={handlePanic}
          onFileDrop={handleFileDrop}
        />
      </div>
    );
  }

  if (mode === 'radial') {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-transparent p-3">
        <RadialHub
          eyeState={eyeState}
          activeTunnelsCount={activeTunnelsCount}
          pendingEmailsCount={pendingEmailsCount}
          focusRemainingSec={focusRemainingSec}
          productionMax={productionMax}
          onToggleProductionMax={toggleProductionMax}
          onSelectModule={(id) => {
            setActiveModule(id);
            setMode('popover');
          }}
          onCollapse={() => setMode('sphere')}
          onOpenRedeMain={() => openRedeMainUrl(getWebMainUrl())}
          onFileDrop={handleFileDrop}
        />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-transparent p-2">
      <div className="w-full max-w-[1040px] h-[660px] rounded-2xl bg-black border border-[#9333EA]/40 shadow-[0_0_90px_rgba(168,85,247,0.22)] flex flex-col overflow-hidden">
        {/* Top Command Bar */}
        <div className="px-4 py-2.5 bg-black border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-[0.24em] text-[#F5D0FE]">AURION CO.</span>
            <span className="text-[10px] font-mono text-zinc-500">
              {RADIAL_NODES.find((n) => n.id === activeModule)?.label || 'COMANDO'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleProductionMax}
              className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wider transition-all ${
                productionMax
                  ? 'bg-[#D946EF]/25 border-[#F0ABFC] text-[#FAE8FF] shadow-[0_0_16px_rgba(232,121,249,0.55)]'
                  : 'bg-zinc-950 border-white/15 text-zinc-400 hover:border-[#C026D3]/60'
              }`}
            >
              {productionMax ? '⚡ PRODUÇÃO MAX: LIVRE ACESSO' : '🛡️ SUPERVISIONADO (PERGUNTAR)'}
            </button>
            <button
              type="button"
              onClick={() => openRedeMainUrl(getWebMainUrl())}
              className="px-3 py-1 rounded-full bg-zinc-950 border border-[#C026D3]/65 text-[10px] font-bold tracking-wider text-[#F5D0FE] hover:bg-[#1E0536]"
            >
              ◈ REDE MAIN
            </button>
            <button
              type="button"
              onClick={() => setMode('sphere')}
              className="px-2.5 py-1 rounded-full bg-zinc-950 border border-white/15 text-[10px] text-zinc-400 hover:text-white"
            >
              Minimizar
            </button>
          </div>
        </div>

        {/* Supervised Machine Action Prompt (Human-in-the-Loop) */}
        {pendingRpa && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[#1A052E] border border-[#F0ABFC]/70 flex items-center justify-between gap-3 shadow-[0_0_24px_rgba(217,70,239,0.35)]">
            <div className="text-xs text-[#FAE8FF]">
              <span className="font-bold text-[#F0ABFC]">CONFIRMAÇÃO DE MÁQUINA:</span> AURION solicita{' '}
              <code className="px-1.5 py-0.5 rounded bg-black text-white">{pendingRpa.action}</code>{' '}
              em ({pendingRpa.norm_x.toFixed(2)}, {pendingRpa.norm_y.toFixed(2)})
              {pendingRpa.text ? ` • "${pendingRpa.text}"` : ''}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => resolvePendingRpa(true)}
                className="px-3 py-1 rounded-lg bg-[#C026D3] hover:bg-[#D946EF] text-white text-[11px] font-bold"
              >
                Permitir Agora
              </button>
              <button
                type="button"
                onClick={() => resolvePendingRpa(false)}
                className="px-3 py-1 rounded-lg bg-zinc-900 border border-white/15 text-zinc-300 text-[11px]"
              >
                Bloquear
              </button>
            </div>
          </div>
        )}

        {/* 100% Black Split Body: Left Corner Galaxy + Function Rail | Right Active Workspace */}
        <div className="flex-1 flex overflow-hidden bg-black">
          {/* Left Corner Dock with Main Galaxy Button + Key Functions */}
          <div className="w-[228px] border-r border-white/10 bg-black p-3 flex flex-col justify-between shrink-0">
            <div className="flex flex-col items-center pb-3 border-b border-white/10">
              <HorusEyeSphere
                eyeState={eyeState}
                activeTunnelsCount={activeTunnelsCount}
                focusRemainingSec={focusRemainingSec}
                audioLevel={audioLevel}
                compact
                onClick={() => setMode('radial')}
                onFileDrop={handleFileDrop}
              />
              <span className="text-[9px] font-mono text-zinc-500 tracking-widest uppercase mt-0.5">
                Voltar à Órbita
              </span>
            </div>

            <div className="flex-1 py-2 space-y-1 overflow-y-auto">
              {RADIAL_NODES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveModule(id)}
                  className={`w-full px-2.5 py-2 rounded-lg flex items-center gap-2.5 text-left text-[11px] font-semibold tracking-wider transition-all ${
                    activeModule === id
                      ? 'bg-[#2E074F] border border-[#E879F9]/60 text-white shadow-[0_0_14px_rgba(217,70,239,0.28)]'
                      : 'text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-zinc-950'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 text-[9px] font-mono text-zinc-500 text-center">
              ESC 2x = Pânico RPA
            </div>
          </div>

          {/* Main 100% Black Content Workspace */}
          <div className="flex-1 p-4 overflow-hidden bg-black">
          {activeModule === 'chat' && (
            <ChatPanel
              messages={messages}
              pill={pill}
              listening={listening}
              onVoiceToggle={toggleVoiceCapture}
              onSendMessage={handleSendChat}
            />
          )}
          {activeModule === 'tasks' && <TasksPanel />}
          {activeModule === 'tunnels' && <TunnelsPanel />}
          {activeModule === 'habits' && (
            <HabitsPanel
              focusRemainingSec={focusRemainingSec}
              onStartFocus={() => {
                setFocusRemainingSec(25 * 60);
                setEyeState('FOCUS');
              }}
            />
          )}
          {activeModule === 'notes' && <NotesPanel />}
          {activeModule === 'converter' && <ConverterPanel initialFile={droppedFile} />}
          {activeModule === 'connectors' && <ConnectorsPanel />}
          {activeModule === 'emails' && <EmailsPanel />}
          {activeModule === 'settings' && (
            <SettingsPanel
              permissions={permissions}
              onChangePermissions={setPermissions}
              wakeWord={wakeWord}
              onChangeWakeWord={setWakeWord}
              ttsEnabled={ttsEnabled}
              onToggleTts={setTtsEnabled}
              voiceName={voiceName}
              onChangeVoiceName={setVoiceName}
              wakeWordContinuous={wakeWordContinuous}
              onToggleWakeWordContinuous={setWakeWordContinuous}
              onTestVoice={() => speakReply('Sistema de voz Aurion ativo e sincronizado em português.')}
              onReconnectTunnel={() => setConnectionVersion((v) => v + 1)}
            />
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
