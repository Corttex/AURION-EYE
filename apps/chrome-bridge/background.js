const CLOUD_WS_URL = 'wss://eyeglobal.aurionagency.com.br/ws/tunnel';
const LOCAL_WS_URL = 'ws://localhost:8000/ws/tunnel';
const DEFAULT_TOKEN = 'aurion-dev-secret-token-2026';

let socket = null;
let tryLocalFallback = false;

async function resolveBridgeTarget() {
  try {
    const stored = await chrome.storage.local.get(['vpsWsUrl', 'aurionToken']);
    if (stored.vpsWsUrl) {
      return {
        wsUrl: stored.vpsWsUrl,
        token: stored.aurionToken || DEFAULT_TOKEN,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    wsUrl: tryLocalFallback ? LOCAL_WS_URL : CLOUD_WS_URL,
    token: DEFAULT_TOKEN,
  };
}

async function connectBridge() {
  const { wsUrl, token } = await resolveBridgeTarget();
  socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        type: 'REGISTER_NODE',
        node_type: 'CHROME_BRIDGE',
        name: 'Chrome Extension Bridge (DOM)',
        client_version: '1.0.0',
        permissions: {
          microphone: false,
          screen_capture: false,
          local_rpa: false,
          chrome_bridge: true,
        },
      })
    );
  };

  socket.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'CHROME_DOM_ACTION') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          socket.send(
            JSON.stringify({
              type: 'DESKTOP_ACTION_RESULT',
              request_id: msg.request_id,
              payload: { ok: false, error: 'Nenhuma aba ativa' },
            })
          );
          return;
        }
        const response = await chrome.tabs.sendMessage(tab.id, msg);
        socket.send(
          JSON.stringify({
            type: 'DESKTOP_ACTION_RESULT',
            request_id: msg.request_id,
            payload: response || { ok: true },
          })
        );
      }
    } catch (err) {
      console.error('[AURION BRIDGE ERROR]', err);
    }
  };

  socket.onclose = () => {
    tryLocalFallback = !tryLocalFallback;
    setTimeout(connectBridge, 4000);
  };
}

connectBridge();
