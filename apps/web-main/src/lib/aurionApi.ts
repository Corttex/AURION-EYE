const ENV_HTTP = process.env.NEXT_PUBLIC_VPS_HTTP_URL || '';
const ENV_WS = process.env.NEXT_PUBLIC_VPS_WS_URL || '';
const ENV_TOKEN = process.env.NEXT_PUBLIC_AURION_TOKEN || '';
const TOKEN_STORAGE_KEY = 'aurion_auth_token';

function isLocalHost(host: string): boolean {
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

export function resolveHttpBase(): string {
  if (ENV_HTTP) return ENV_HTTP;
  if (typeof window !== 'undefined') {
    if (!isLocalHost(window.location.hostname)) {
      return window.location.origin;
    }
  }
  return 'http://localhost:8000';
}

export function resolveWsUrl(): string {
  if (ENV_WS) return ENV_WS;
  if (typeof window !== 'undefined') {
    if (!isLocalHost(window.location.hostname)) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/ws/tunnel`;
    }
  }
  return 'ws://localhost:8000/ws/tunnel';
}

export function getEffectiveToken(): string {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  if (ENV_TOKEN) return ENV_TOKEN;
  if (typeof window !== 'undefined' && !isLocalHost(window.location.hostname)) {
    return '';
  }
  return 'aurion-dev-secret-token-2026';
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  if (token.trim()) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getGatewayWsUrl(): string {
  return `${resolveWsUrl()}?token=${encodeURIComponent(getEffectiveToken())}`;
}

export class AurionAuthError extends Error {
  constructor(message = 'Token AURION necessário') {
    super(message);
    this.name = 'AurionAuthError';
  }
}

export async function vpsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getEffectiveToken();
  const headers = new Headers(init?.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${resolveHttpBase()}${path}`, { ...init, headers });
  if (res.status === 401) {
    throw new AurionAuthError();
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function vpsUploadConvert(file: File, targetFormat: string): Promise<Blob> {
  const form = new FormData();
  form.append('file', file);
  form.append('target_format', targetFormat);
  const res = await fetch(`${resolveHttpBase()}/api/converter/process`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getEffectiveToken()}` },
    body: form,
  });
  if (res.status === 401) {
    throw new AurionAuthError();
  }
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return await res.blob();
}
