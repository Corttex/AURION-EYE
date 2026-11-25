import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EyeModuleId,
  EyeState,
  PillFeedbackPayload,
  WsServerEvent,
} from '@aurion/shared-protocol';
import { HorusEyeSphere } from './components/HorusEyeSphere';
import { AurionCommandCockpit } from './components/AurionCommandCockpit';
import {
  ChatMessage,
  ChatPanel,
  ConnectorsPanel,
  ConverterPanel,
  EmailsPanel,
  HabitsPanel,
  LocalPermissions,
  SettingsPanel,
  TasksPanel,
  TunnelsPanel,
} from './components/panels/ModulePanels';
import { MemoryMapPanel } from './components/panels/MemoryMapPanel';
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
      <div className="w-screen h-screen flex items-center justify-center bg-transparent aurion-backdrop-enter">
        <HorusEyeSphere
          eyeState={eyeState}
          activeTunnelsCount={activeTunnelsCount}
          focusRemainingSec={focusRemainingSec}
          audioLevel={audioLevel}
          banner={banner}
          isDragOver={isDragOver}
          onDragStateChange={setIsDragOver}
          onClick={() => setMode('popover')}
          onPanicTrigger={handlePanic}
          onFileDrop={handleFileDrop}
        />
      </div>
    );
  }

  const activePanelNode = (
    <>
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
      {activeModule === 'notes' && <MemoryMapPanel />}
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
    </>
  );

  return (
    <AurionCommandCockpit
      eyeState={eyeState}
      activeModule={activeModule}
      productionMax={productionMax}
      pendingRpa={pendingRpa}
      onSelectModule={setActiveModule}
      onToggleProductionMax={toggleProductionMax}
      onResolveRpa={resolvePendingRpa}
      onOpenRedeMain={() => openRedeMainUrl(getWebMainUrl())}
      onCollapse={() => setMode('sphere')}
      rightPanelContent={activePanelNode}
    />
  );
}
