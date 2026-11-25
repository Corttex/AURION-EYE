import { getAuthToken, getVpsHttpUrl } from './apiClient';

export type AurionVoiceName = 'pt-BR-AntonioNeural' | 'pt-BR-FranciscaNeural';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Speaks text using neural PT-BR TTS from VPS (/api/voice/tts -> Edge TTS)
 * with real-time RMS audio level callback for Eye pupil modulation,
 * falling back transparently to browser SpeechSynthesis if offline.
 */
export async function speakWithAurion(
  text: string,
  options: {
    voice?: AurionVoiceName;
    onLevel?: (level: number) => void;
    onStart?: () => void;
    onEnd?: () => void;
  } = {}
): Promise<void> {
  const { voice = 'pt-BR-AntonioNeural', onLevel, onStart, onEnd } = options;

  try {
    const resp = await fetch(`${getVpsHttpUrl()}/api/voice/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice }),
    });

    if (!resp.ok) throw new Error('TTS HTTP error');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    let rafId = 0;
    let ctx: AudioContext | null = null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const sample = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / (data.length * 255);
        onLevel?.(Math.min(1, avg * 2.4));
        rafId = requestAnimationFrame(sample);
      };
      rafId = requestAnimationFrame(sample);
    } catch {
      // AudioContext analysis optional
    }

    onStart?.();
    await new Promise<void>((resolve) => {
      audio.onended = () => {
        cancelAnimationFrame(rafId);
        onLevel?.(0);
        URL.revokeObjectURL(url);
        ctx?.close().catch(() => {});
        onEnd?.();
        resolve();
      };
      audio.onerror = () => {
        cancelAnimationFrame(rafId);
        onLevel?.(0);
        URL.revokeObjectURL(url);
        ctx?.close().catch(() => {});
        onEnd?.();
        resolve();
      };
      audio.play().catch(() => {
        cancelAnimationFrame(rafId);
        onEnd?.();
        resolve();
      });
    });
  } catch {
    // Fallback to native Windows/browser PT-BR SpeechSynthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-BR';
      utter.rate = 1.05;
      onStart?.();
      await new Promise<void>((resolve) => {
        utter.onend = () => {
          onLevel?.(0);
          onEnd?.();
          resolve();
        };
        utter.onerror = () => {
          onLevel?.(0);
          onEnd?.();
          resolve();
        };
        window.speechSynthesis.speak(utter);
      });
    } else {
      onEnd?.();
    }
  }
}

export function startOneShotRecognition(
  onResult: (transcript: string) => void,
  onError?: (err: string) => void,
  onEnd?: () => void
): () => void {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    onError?.('Reconhecimento de voz não suportado neste navegador. Use Chrome ou Edge.');
    onEnd?.();
    return () => {};
  }

  const rec = new Ctor();
  rec.lang = 'pt-BR';
  rec.continuous = false;
  rec.interimResults = false;

  rec.onresult = (ev) => {
    const res = ev.results[ev.resultIndex];
    if (res && res[0]?.transcript) {
      onResult(res[0].transcript.trim());
    }
  };
  rec.onerror = (ev) => onError?.(ev.error || 'erro_microfone');
  rec.onend = () => onEnd?.();

  rec.start();
  return () => {
    try {
      rec.stop();
    } catch {
      // ignore
    }
  };
}

export class WakeWordDetector {
  private rec: SpeechRecognitionLike | null = null;
  private running = false;

  start(wakeWord: 'Aurion' | 'Hórus', onCommand: (cmd: string) => void): boolean {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;

    this.stop();
    this.running = true;

    const launch = () => {
      if (!this.running) return;
      const rec = new Ctor();
      this.rec = rec;
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (!ev.results[i].isFinal) continue;
          const phrase = ev.results[i][0].transcript.trim();
          const normalized = phrase.toLowerCase();
          const aliases = wakeWord === 'Aurion' ? ['aurion', 'áurion', 'orion'] : ['hórus', 'horus'];
          const matched = aliases.find((a) => normalized.includes(a));
          if (matched) {
            const idx = normalized.indexOf(matched);
            const after = phrase.slice(idx + matched.length).replace(/^[,:\s]+/, '').trim();
            onCommand(after || 'Estou ouvindo');
          }
        }
      };

      rec.onend = () => {
        if (this.running) {
          window.setTimeout(launch, 350);
        }
      };
      rec.onerror = () => {
        // handled by onend auto-restart
      };

      try {
        rec.start();
      } catch {
        // ignore double start
      }
    };

    launch();
    return true;
  }

  stop(): void {
    this.running = false;
    try {
      this.rec?.stop();
    } catch {
      // ignore
    }
    this.rec = null;
  }
}
