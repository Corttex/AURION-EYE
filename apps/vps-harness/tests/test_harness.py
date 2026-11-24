import pytest
from fastapi.testclient import TestClient

from app.core.redis_client import InMemoryRedis
from app.core.security import VaultService
from app.main import app
from app.router.adaptive_router import AurionAdaptiveRouter, TaskType


def test_vault_aes256_roundtrip():
    vault = VaultService()
    secret = "sk-aurion-super-secret-value-999"
    encrypted = vault.encrypt(secret)
    assert encrypted != secret
    assert vault.decrypt(encrypted) == secret
    assert "999" in vault.mask(secret)


@pytest.mark.asyncio
async def test_adaptive_router_claude_locked_until_two_failures():
    redis = InMemoryRedis()

    async def fake_vault(name: str):
        if name == "ANTHROPIC_API_KEY":
            return "sk-ant-fake"
        return None

    router = AurionAdaptiveRouter(redis_client=redis, vault_getter=fake_vault, claude_daily_cap=2)
    assert await router._can_use_claude(failure_count=0, force_claude=False) is False
    assert await router._can_use_claude(failure_count=1, force_claude=False) is False
    assert await router._can_use_claude(failure_count=2, force_claude=False) is True
    assert await router._can_use_claude(failure_count=0, force_claude=True) is True

    # Local fallback responds gracefully when no free keys are active
    res = await router.route_completion(
        messages=[{"role": "user", "content": "oi aurion"}],
        task_type=TaskType.FAST_VOICE,
    )
    assert res["provider_used"] == "aurion_local_orchestrator"


def test_api_endpoints_and_websocket_tunnel():
    headers = {"Authorization": "Bearer aurion-dev-secret-token-2026"}
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["gateway_status"] == "ATIVO"

        # Unauthorized check
        assert client.get("/api/tasks").status_code == 401

        # Create task & verify Kanban
        created = client.post(
            "/api/tasks",
            headers=headers,
            json={"title": "Testar fluxo E2E", "status": "READY", "project": "Aurion"},
        )
        assert created.status_code == 200
        task_id = created.json()["id"]

        tasks = client.get("/api/tasks", headers=headers).json()
        assert any(t["id"] == task_id for t in tasks)

        # Human-in-the-loop email approve
        emails = client.get("/api/emails", headers=headers).json()
        pending = [e for e in emails if e["status"] == "PENDING_APPROVAL"]
        if pending:
            resp = client.post(f"/api/emails/{pending[0]['id']}/approve-send", headers=headers)
            assert resp.status_code == 200
            assert resp.json()["status"] == "SENT"

        # JSON -> CSV converter
        conv = client.post(
            "/api/converter/process",
            headers=headers,
            files={"file": ("sample.json", b'[{"nome":"Aurion","ok":true}]', "application/json")},
            data={"target_format": "csv"},
        )
        assert conv.status_code == 200
        assert b"nome,ok" in conv.content

        # Voice quick task intent via /api/chat
        voice_task = client.post(
            "/api/chat",
            headers=headers,
            json={"session_id": "voice-test", "message": "anote uma tarefa: Revisar pipeline de voz"},
        )
        assert voice_task.status_code == 200
        assert voice_task.json()["provider_used"] == "aurion-voice-intent"

        # WebSocket /ws/tunnel handshake
        with client.websocket_connect("/ws/tunnel?token=aurion-dev-secret-token-2026") as ws:
            first = ws.receive_json()
            assert first["type"] == "GATEWAY_STATE"
            assert first["payload"]["gateway_status"] == "ATIVO"

        # 3-Layer Memory, Multi-VPS & Execution Checkpoints
        mem_resp = client.post(
            "/api/memory/facts",
            headers=headers,
            json={"fact_text": "VPS Secundária roda Docker Swarm na porta 2375", "scope": "vps:worker-02", "importance": 8},
        )
        assert mem_resp.status_code == 200

        ctx = client.get("/api/memory/context?q=hetzner", headers=headers)
        assert ctx.status_code == 200
        assert "hetzner-main" in ctx.json()["context_block"]

        cp = client.post(
            "/api/checkpoints",
            headers=headers,
            json={"goal": "Deploy Evolution API", "steps": ["DNS", "Coolify", "QR Code"]},
        )
        assert cp.status_code == 200
        cp_id = cp.json()["id"]

        adv = client.post(
            f"/api/checkpoints/{cp_id}/advance",
            headers=headers,
            json={"note": "DNS apontado"},
        )
        assert adv.status_code == 200
        assert adv.json()["current_step"] == 1
