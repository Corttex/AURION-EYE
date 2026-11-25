export type ConnectionMode = 'cloud' | 'local';

export interface AurionConnectionConfig {
  mode: ConnectionMode;
  token: string;
}

export const CLOUD_ORIGIN = 'https://eyeglobal.aurionagency.com.br';
export const LOCAL_HTTP = 'http://localhost:8000';
export const LOCAL_WEB_MAIN = 'http://localhost:3015';

const ENV_HTTP =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_VPS_HTTP_URL || '';
const ENV_WS =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_VPS_WS_URL || '';
const ENV_TOKEN =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AURION_TOKEN ||
  'aurion-dev-secret-token-2026';

const CFG_KEY = 'aurion_eye_connection_v1';

export function getConnectionConfig(): AurionConnectionConfig {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CFG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AurionConnectionConfig>;
        return {
          mode: parsed.mode === 'cloud' ? 'cloud' : 'local',
          token: parsed.token || ENV_TOKEN,
        };
      }
    } catch {
      // ignore invalid json
    }
  }
  return { mode: 'local', token: ENV_TOKEN };
}

export function setConnectionConfig(cfg: AurionConnectionConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export function getVpsHttpUrl(): string {
  const cfg = getConnectionConfig();
  if (cfg.mode === 'cloud') return CLOUD_ORIGIN;
  return ENV_HTTP || LOCAL_HTTP;
}

export function getWebMainUrl(): string {
  const cfg = getConnectionConfig();
  if (cfg.mode === 'cloud') return CLOUD_ORIGIN;
  return (
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WEB_MAIN_URL ||
    LOCAL_WEB_MAIN
  );
}

export const WEB_MAIN_URL = LOCAL_WEB_MAIN;

export function getAuthToken(): string {
  return getConnectionConfig().token;
}

export function getWsUrl(): string {
  const cfg = getConnectionConfig();
  const baseWs =
    cfg.mode === 'cloud'
      ? 'wss://eyeglobal.aurionagency.com.br/ws/tunnel'
      : ENV_WS || 'ws://localhost:8000/ws/tunnel';
  return `${baseWs}?token=${encodeURIComponent(cfg.token)}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${getAuthToken()}`);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const resp = await fetch(`${getVpsHttpUrl()}${path}`, { ...init, headers });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }
  return (await resp.json()) as T;
}

export async function apiUploadConvert(file: File, targetFormat: string): Promise<Blob> {
  const form = new FormData();
  form.append('file', file);
  form.append('target_format', targetFormat);
  const resp = await fetch(`${getVpsHttpUrl()}/api/converter/process`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return await resp.blob();
}
