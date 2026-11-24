from contextlib import asynccontextmanager
import os
import uuid
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.routes import RUNTIME_REFS, public_router, router
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, init_db_and_seed
from app.core.redis_client import create_redis_client
from app.core.security import VaultService, verify_bearer_token
from app.models.entities import ConnectorSecret
from app.router.adaptive_router import AurionAdaptiveRouter
from app.workers.gui_worker import AutonomousGuiWorker
from app.ws.tunnel_manager import TunnelManager


async def _vault_secret_getter(key_name: str):
    vault = VaultService()
    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(ConnectorSecret).where(
                    ConnectorSecret.name == key_name,
                    ConnectorSecret.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if not row:
            env_val = os.getenv(key_name, "").strip()
            return env_val or None
        return vault.decrypt(row.encrypted_value)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db_and_seed()
    redis_client = await create_redis_client()
    tunnel_manager = TunnelManager()
    adaptive_router = AurionAdaptiveRouter(
        redis_client=redis_client,
        vault_getter=_vault_secret_getter,
        claude_daily_cap=get_settings().claude_daily_cap,
    )
    gui_worker = AutonomousGuiWorker(adaptive_router, tunnel_manager)

    RUNTIME_REFS["redis"] = redis_client
    RUNTIME_REFS["tunnel"] = tunnel_manager
    RUNTIME_REFS["router"] = adaptive_router
    RUNTIME_REFS["gui_worker"] = gui_worker
    try:
        yield
    finally:
        await redis_client.aclose()


app = FastAPI(title="AURION VPS Harness", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public_router)
app.include_router(router)


@app.websocket("/ws/tunnel")
async def websocket_tunnel(websocket: WebSocket, token: str | None = Query(default=None)):
    auth_header = websocket.headers.get("authorization")
    if not (verify_bearer_token(token) or verify_bearer_token(auth_header)):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    tunnel: TunnelManager = RUNTIME_REFS["tunnel"]
    session_id = uuid.uuid4().hex[:12]
    await tunnel.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_json()
            await tunnel.handle_client_message(session_id, data)
    except WebSocketDisconnect:
        await tunnel.disconnect(session_id)


@app.websocket("/ws/audio")
async def websocket_audio(websocket: WebSocket, token: str | None = Query(default=None)):
    if not verify_bearer_token(token):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.accept()
    tunnel: TunnelManager = RUNTIME_REFS["tunnel"]
    await tunnel.broadcast({"type": "EYE_STATE", "state": "LISTENING"})
    try:
        while True:
            _chunk = await websocket.receive_bytes()
    except WebSocketDisconnect:
        await tunnel.broadcast({"type": "EYE_STATE", "state": "IDLE"})
