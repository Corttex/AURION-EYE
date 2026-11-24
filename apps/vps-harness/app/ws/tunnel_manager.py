import asyncio
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, Optional

from fastapi import WebSocket


class TunnelManager:
    """Manages authenticated WebSocket connections across Desktop Eye, Rede MAIN and Chrome Bridge."""

    def __init__(self) -> None:
        self.connections: Dict[str, WebSocket] = {}
        self.devices: Dict[str, Dict[str, Any]] = {
            "vps_main": {
                "id": "vps_main",
                "name": "VPS-Principal (Hetzner)",
                "node_type": "VPS",
                "tunnel_ip": "10.66.0.1",
                "client_version": "1.0.0",
                "latency_ms": 14,
                "online": True,
                "permissions": {
                    "microphone": False,
                    "screen_capture": False,
                    "local_rpa": False,
                    "chrome_bridge": True,
                },
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }
        }
        self.eye_state: str = "IDLE"
        self.banner: Optional[str] = None
        self.active_tunnels_count: int = 0
        self.pending_emails_count: int = 1
        self.aborted_sessions: set[str] = set()
        self._pending_futures: Dict[str, asyncio.Future] = {}
        self.logs: Deque[Dict[str, Any]] = deque(maxlen=250)
        self.add_log("INFO", "VPS", "Gateway Aurion /ws/tunnel inicializado.")

    def add_log(self, level: str, source: str, message: str) -> None:
        self.logs.append({
            "id": uuid.uuid4().hex[:8],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "source": source,
            "message": message,
        })

    def gateway_state_payload(self) -> Dict[str, Any]:
        return {
            "type": "GATEWAY_STATE",
            "payload": {
                "eye_state": self.eye_state,
                "active_tunnels_count": self.active_tunnels_count,
                "gateway_status": "ATIVO",
                "active_sessions": max(1, len(self.connections)),
                "pending_emails_count": self.pending_emails_count,
                "banner": self.banner,
            },
        }

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        await websocket.accept()
        self.connections[session_id] = websocket
        self.aborted_sessions.discard(session_id)
        self.add_log("TUNNEL", "VPS", f"Sessão conectada: {session_id}")
        await self.send_event(session_id, self.gateway_state_payload())
        await self.broadcast(self.gateway_state_payload())

    async def disconnect(self, session_id: str) -> None:
        self.connections.pop(session_id, None)
        if session_id in self.devices:
            self.devices[session_id]["online"] = False
        self.add_log("WARN", "VPS", f"Sessão desconectada: {session_id}")
        await self.broadcast(self.gateway_state_payload())

    async def broadcast(self, event: Dict[str, Any]) -> None:
        dead = []
        for sid, ws in list(self.connections.items()):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(sid)
        for sid in dead:
            self.connections.pop(sid, None)

    async def send_event(self, session_id: str, event: Dict[str, Any]) -> None:
        if event.get("type") == "EYE_STATE":
            self.eye_state = event.get("state", self.eye_state)
            self.banner = event.get("banner")
        ws = self.connections.get(session_id)
        if ws is None:
            await self.broadcast(event)
            return
        try:
            await ws.send_json(event)
        except Exception:
            self.connections.pop(session_id, None)

    async def is_aborted(self, session_id: str) -> bool:
        return session_id in self.aborted_sessions

    async def handle_client_message(self, session_id: str, msg: Dict[str, Any]) -> None:
        msg_type = msg.get("type")
        if msg_type == "PING":
            await self.send_event(session_id, {"type": "PONG"})
        elif msg_type == "REGISTER_NODE":
            node_type = msg.get("node_type", "DESKTOP_PC")
            self.devices[session_id] = {
                "id": session_id,
                "name": msg.get("name", f"{node_type}-{session_id[:6]}"),
                "node_type": node_type,
                "tunnel_ip": "10.66.0.12" if node_type == "DESKTOP_PC" else "10.66.0.18",
                "client_version": msg.get("client_version", "1.0.0"),
                "latency_ms": 8 if node_type == "DESKTOP_PC" else 6,
                "online": True,
                "permissions": msg.get("permissions", {
                    "microphone": True,
                    "screen_capture": True,
                    "local_rpa": False,
                    "chrome_bridge": True,
                }),
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }
            self.add_log("TUNNEL", node_type, f"Nó registrado: {self.devices[session_id]['name']}")
            await self.broadcast(self.gateway_state_payload())
        elif msg_type == "EYE_STATE_SET":
            self.eye_state = msg.get("state", "IDLE")
            await self.broadcast(self.gateway_state_payload())
        elif msg_type == "RPA_PANIC":
            self.aborted_sessions.add(session_id)
            self.eye_state = "ALERT"
            self.banner = f"PANIC ABORT: {msg.get('reason', 'Tecla de pânico')}"
            self.add_log("ERROR", "DESKTOP_EYE", self.banner)
            await self.broadcast(self.gateway_state_payload())
        elif msg_type == "FOCUS_EYE_REQUEST":
            self.add_log("INFO", "WEB_MAIN", "Sinal ← VOLTAR enviado para o Aurion Eye")
            await self.broadcast({"type": "FOCUS_EYE", "source": "web-main"})
        elif msg_type in ("DESKTOP_ACTION_RESULT", "APPROVAL_RESPONSE"):
            req_id = msg.get("request_id")
            fut = self._pending_futures.pop(req_id, None) if req_id else None
            if fut and not fut.done():
                result = msg.get("payload") if msg_type == "DESKTOP_ACTION_RESULT" else msg.get("approved", False)
                fut.set_result(result)

    async def request_desktop_action(self, session_id: str, action: Dict[str, Any], timeout: float = 15.0) -> Dict[str, Any]:
        req_id = uuid.uuid4().hex[:10]
        loop = asyncio.get_running_loop()
        fut: asyncio.Future = loop.create_future()
        self._pending_futures[req_id] = fut
        cmd = action.get("cmd")
        if cmd == "CAPTURE_SCREEN":
            event: Dict[str, Any] = {"type": "CAPTURE_SCREEN", "request_id": req_id}
        else:
            event = {
                "type": "EXECUTE_INPUT",
                "request_id": req_id,
                "action": action.get("action", "WAIT"),
                "norm_x": action.get("norm_x", 500),
                "norm_y": action.get("norm_y", 500),
                "text": action.get("text", ""),
            }
        await self.send_event(session_id, event)
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending_futures.pop(req_id, None)
            return {"aborted": True, "reason": "Timeout aguardando resposta do desktop"}

    async def request_user_approval(self, session_id: str, details: Dict[str, Any], timeout: float = 60.0) -> bool:
        req_id = uuid.uuid4().hex[:10]
        loop = asyncio.get_running_loop()
        fut: asyncio.Future = loop.create_future()
        self._pending_futures[req_id] = fut
        await self.send_event(session_id, {
            "type": "APPROVAL_REQUEST",
            "payload": {"request_id": req_id, **details},
        })
        try:
            return bool(await asyncio.wait_for(fut, timeout=timeout))
        except asyncio.TimeoutError:
            self._pending_futures.pop(req_id, None)
            return False
