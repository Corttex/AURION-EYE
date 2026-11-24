export type OverlayMode = 'sphere' | 'radial' | 'popover';

export interface CursorVector {
  x: number;
  y: number;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function setOverlayMode(mode: OverlayMode): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_overlay_mode', { mode });
  } catch {
    // ignore outside Tauri
  }
}

export async function openRedeMainUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
      return;
    } catch {
      // fallback
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function captureScreenIfTauri(): Promise<{
  image_base64: string;
  width: number;
  height: number;
  aborted: boolean;
}> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('capture_screen_normalized');
  }
  return { image_base64: '', width: 1280, height: 720, aborted: false };
}

export async function executeRpaIfTauri(cmd: {
  action: string;
  norm_x: number;
  norm_y: number;
  text?: string;
}): Promise<boolean> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('execute_rpa_input', {
      cmd,
      screenW: window.screen.width || 1920,
      screenH: window.screen.height || 1080,
    });
  }
  return true;
}

export function subscribeCursorVector(
  onVector: (vec: CursorVector) => void,
  onPanic?: (reason: string) => void
): () => void {
  let unlistenCursor: (() => void) | null = null;
  let unlistenPanic: (() => void) | null = null;

  if (isTauriRuntime()) {
    import('@tauri-apps/api/event').then(async ({ listen }) => {
      unlistenCursor = await listen<CursorVector>('cursor-vector', (e) => onVector(e.payload));
      if (onPanic) {
        unlistenPanic = await listen<string>('aurion://rpa-panic', (e) => onPanic(e.payload));
      }
    });
    return () => {
      unlistenCursor?.();
      unlistenPanic?.();
    };
  }

  // Browser preview fallback: track window pointer relative to viewport center + ESC 2x panic
  let lastEsc = 0;
  const handleMove = (e: MouseEvent) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const x = Math.max(-1, Math.min(1, (e.clientX - cx) / 260));
    const y = Math.max(-1, Math.min(1, (e.clientY - cy) / 260));
    onVector({ x, y });
  };
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const now = Date.now();
      if (now - lastEsc < 600 && onPanic) {
        onPanic('ESC duplo pressionado');
      }
      lastEsc = now;
    }
  };
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('keydown', handleKey);
  return () => {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('keydown', handleKey);
  };
}
