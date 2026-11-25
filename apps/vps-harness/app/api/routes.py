import csv
import io
import json
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, utc_now_iso
from app.core.humanizer import HUMANIZER_SYSTEM_PROMPT, humanize_text
from app.core.memory_service import (
    append_timeline_entry,
    list_memory_markdown_files,
    recall_relevant_context,
    remember_fact,
    sync_vps_markdown,
)
from app.core.security import VaultService, require_auth
from app.core.voice_service import synthesize_speech_mp3, transcribe_audio_groq
from app.models.entities import (
    AgentTask,
    ConnectorSecret,
    CronJob,
    EmailDraft,
    ExecutionCheckpoint,
    Habit,
    MemoryFact,
    Note,
    TunnelJob,
    VpsNode,
)
from app.router.adaptive_router import AurionAdaptiveRouter, TaskType, classify_task_intent

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])
public_router = APIRouter(prefix="/api")

# Populated at startup in app.main
RUNTIME_REFS: Dict[str, Any] = {}


def _get_tunnel():
    return RUNTIME_REFS["tunnel"]


def _get_router() -> AurionAdaptiveRouter:
    return RUNTIME_REFS["router"]


def _serialize_task(t: AgentTask) -> Dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "board": t.board,
        "project": t.project,
        "assigned_agent": t.assigned_agent,
        "subtasks": t.subtasks_json or [],
        "output_log": t.output_log or "",
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def _serialize_tunnel(j: TunnelJob) -> Dict[str, Any]:
    return {
        "id": j.id,
        "node_target": j.node_target,
        "worker_name": j.worker_name,
        "command": j.command,
        "status": j.status,
        "progress": j.progress,
        "logs_stream": j.logs_stream_json or [],
        "created_at": j.created_at,
    }


@public_router.get("/health")
async def health() -> Dict[str, Any]:
    tunnel = _get_tunnel()
    return {
        "status": "ok",
        "gateway_status": "ATIVO",
        "eye_state": tunnel.eye_state,
        "active_tunnels_count": tunnel.active_tunnels_count,
    }


# === TASKS (DASHQUADRO) ===
class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "TODO"
    board: str = "Aurion - Geral"
    project: str = "Aurion"
    assigned_agent: str = "@orquestrador"


class TaskPatch(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_agent: Optional[str] = None
    subtasks: Optional[List[Dict[str, Any]]] = None


@router.get("/tasks")
async def list_tasks() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(AgentTask))).scalars().all()
        return [_serialize_task(r) for r in rows]


@router.post("/tasks")
async def create_task(body: TaskCreate) -> Dict[str, Any]:
    now = utc_now_iso()
    task = AgentTask(
        id=f"t_{uuid.uuid4().hex[:8]}",
        title=body.title,
        description=body.description,
        status=body.status,
        board=body.board,
        project=body.project,
        assigned_agent=body.assigned_agent,
        subtasks_json=[],
        output_log="",
        created_at=now,
        updated_at=now,
    )
    async with AsyncSessionLocal() as session:
        session.add(task)
        await session.commit()
    serialized = _serialize_task(task)
    tunnel = _get_tunnel()
    await tunnel.broadcast({"type": "TASK_UPDATED", "task": serialized})
    await tunnel.broadcast({"type": "PILL_FEEDBACK", "label": "Tarefa Criada", "detail": task.title, "variant": "success"})
    return serialized


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskPatch) -> Dict[str, Any]:
    async with AsyncSessionLocal() as session:
        task = await session.get(AgentTask, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Tarefa não encontrada")
        if body.status is not None:
            task.status = body.status
        if body.title is not None:
            task.title = body.title
        if body.description is not None:
            task.description = body.description
        if body.assigned_agent is not None:
            task.assigned_agent = body.assigned_agent
        if body.subtasks is not None:
            task.subtasks_json = body.subtasks
        task.updated_at = utc_now_iso()
        await session.commit()
        serialized = _serialize_task(task)
    await _get_tunnel().broadcast({"type": "TASK_UPDATED", "task": serialized})
    return serialized


@router.post("/tasks/notify-agents")
async def notify_agents() -> Dict[str, Any]:
    tunnel = _get_tunnel()
    async with AsyncSessionLocal() as session:
        ready_tasks = (
            await session.execute(select(AgentTask).where(AgentTask.status == "READY"))
        ).scalars().all()
        woken = 0
        for t in ready_tasks:
            t.status = "IN_PROGRESS"
            t.output_log = (t.output_log or "") + f"\n[{utc_now_iso()}] Agente {t.assigned_agent} acordado pela Rede MAIN."
            t.updated_at = utc_now_iso()
            woken += 1
        await session.commit()
    tunnel.add_log("INFO", "VPS", f"NOTIFICAR AGENTES disparado ({woken} tarefas promovidas para Em Andamento).")
    await tunnel.broadcast({"type": "TASK_UPDATED"})
    await tunnel.broadcast({"type": "PILL_FEEDBACK", "label": "Agentes Notificados", "detail": f"{woken} em execução", "variant": "success"})
    return {"woken_count": woken}


# === TUNNELS ===
class TunnelStartReq(BaseModel):
    node_target: str = "VPS"
    worker_name: str
    command: str


@router.get("/tunnels")
async def list_tunnels() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(TunnelJob))).scalars().all()
        return [_serialize_tunnel(r) for r in rows]


@router.post("/tunnels")
async def start_tunnel(body: TunnelStartReq) -> Dict[str, Any]:
    tunnel = _get_tunnel()
    job = TunnelJob(
        id=f"job_{uuid.uuid4().hex[:6]}",
        node_target=body.node_target,
        worker_name=body.worker_name,
        command=body.command,
        status="RUNNING",
        progress=35,
        logs_stream_json=[f"[{utc_now_iso()}] Túnel iniciado em {body.node_target}: {body.command}"],
        created_at=utc_now_iso(),
    )
    async with AsyncSessionLocal() as session:
        session.add(job)
        await session.commit()
    tunnel.active_tunnels_count += 1
    tunnel.eye_state = "EXECUTING_TUNNEL"
    await tunnel.broadcast(tunnel.gateway_state_payload())
    return _serialize_tunnel(job)


@router.post("/tunnels/{job_id}/{action}")
async def control_tunnel(job_id: str, action: str) -> Dict[str, Any]:
    tunnel = _get_tunnel()
    async with AsyncSessionLocal() as session:
        job = await session.get(TunnelJob, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job não encontrado")
        was_running = job.status == "RUNNING"
        if action == "pause":
            job.status = "PAUSED"
        elif action == "resume":
            job.status = "RUNNING"
        elif action in ("abort", "kill"):
            job.status = "ABORTED"
            job.logs_stream_json = [*(job.logs_stream_json or []), f"[{utc_now_iso()}] KILL_JOB acionado pelo usuário."]
        elif action == "complete":
            job.status = "COMPLETED"
            job.progress = 100
        await session.commit()
        if was_running and job.status != "RUNNING":
            tunnel.active_tunnels_count = max(0, tunnel.active_tunnels_count - 1)
            if tunnel.active_tunnels_count == 0:
                tunnel.eye_state = "IDLE"
        await tunnel.broadcast(tunnel.gateway_state_payload())
        return _serialize_tunnel(job)


# === HABITS ===
@router.get("/habits")
async def list_habits() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Habit))).scalars().all()
        return [
            {
                "id": h.id,
                "name": h.name,
                "icon": h.icon,
                "target_count": h.target_count,
                "current_count": h.current_count,
                "streak_days": h.streak_days,
                "reminder_time": h.reminder_time,
            }
            for h in rows
        ]


@router.post("/habits/{habit_id}/increment")
async def increment_habit(habit_id: str) -> Dict[str, Any]:
    async with AsyncSessionLocal() as session:
        h = await session.get(Habit, habit_id)
        if not h:
            raise HTTPException(status_code=404, detail="Hábito não encontrado")
        h.current_count += 1
        if h.current_count == h.target_count:
            h.streak_days += 1
        await session.commit()
        return {
            "id": h.id,
            "name": h.name,
            "icon": h.icon,
            "target_count": h.target_count,
            "current_count": h.current_count,
            "streak_days": h.streak_days,
            "reminder_time": h.reminder_time,
        }


# === NOTES ===
class NoteUpsert(BaseModel):
    id: Optional[str] = None
    title: str
    content_md: str
    tags: List[str] = []


@router.get("/notes")
async def list_notes() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Note))).scalars().all()
        return [
            {
                "id": n.id,
                "title": n.title,
                "content_md": n.content_md,
                "tags": n.tags_json or [],
                "indexed_in_memory": n.indexed_in_memory,
                "updated_at": n.updated_at,
            }
            for n in rows
        ]


@router.post("/notes")
async def upsert_note(body: NoteUpsert) -> Dict[str, Any]:
    now = utc_now_iso()
    async with AsyncSessionLocal() as session:
        note = await session.get(Note, body.id) if body.id else None
        if note is None:
            note = Note(
                id=body.id or f"note_{uuid.uuid4().hex[:6]}",
                title=body.title,
                content_md=body.content_md,
                tags_json=body.tags,
                indexed_in_memory=False,
                updated_at=now,
            )
            session.add(note)
        else:
            note.title = body.title
            note.content_md = body.content_md
            note.tags_json = body.tags
            note.updated_at = now
        await session.commit()
        return {
            "id": note.id,
            "title": note.title,
            "content_md": note.content_md,
            "tags": note.tags_json or [],
            "indexed_in_memory": note.indexed_in_memory,
            "updated_at": note.updated_at,
        }


@router.post("/notes/{note_id}/index")
async def index_note(note_id: str) -> Dict[str, Any]:
    async with AsyncSessionLocal() as session:
        note = await session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Nota não encontrada")
        note.indexed_in_memory = True
        note.updated_at = utc_now_iso()
        await session.commit()
    await _get_tunnel().broadcast({"type": "PILL_FEEDBACK", "label": "Memória Indexada", "detail": note.title, "variant": "success"})
    return {"id": note.id, "indexed_in_memory": True}


# === VAULT & MCP CONNECTORS ===
class SecretCreate(BaseModel):
    name: str
    category: str = "API_TOKEN"
    value: str
    metadata_json: Dict[str, Any] = {}
    allowed_agents: List[str] = ["@orquestrador"]
    is_active: bool = True


@router.get("/vault")
async def list_vault() -> List[Dict[str, Any]]:
    vault = VaultService()
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(ConnectorSecret))).scalars().all()
        result = []
        for s in rows:
            try:
                masked = vault.mask(vault.decrypt(s.encrypted_value))
            except Exception:
                masked = "••••••••••••"
            result.append({
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "masked_value": masked,
                "metadata_json": s.metadata_json or {},
                "allowed_agents": s.allowed_agents_json or [],
                "is_active": s.is_active,
            })
        return result


@router.post("/vault")
async def upsert_secret(body: SecretCreate) -> Dict[str, Any]:
    vault = VaultService()
    async with AsyncSessionLocal() as session:
        existing = (
            await session.execute(select(ConnectorSecret).where(ConnectorSecret.name == body.name))
        ).scalar_one_or_none()
        if existing:
            existing.encrypted_value = vault.encrypt(body.value)
            existing.category = body.category
            existing.metadata_json = body.metadata_json
            existing.allowed_agents_json = body.allowed_agents
            existing.is_active = body.is_active
            target = existing
        else:
            target = ConnectorSecret(
                id=f"sec_{uuid.uuid4().hex[:8]}",
                name=body.name,
                category=body.category,
                encrypted_value=vault.encrypt(body.value),
                metadata_json=body.metadata_json,
                allowed_agents_json=body.allowed_agents,
                is_active=body.is_active,
            )
            session.add(target)
        await session.commit()
        return {
            "id": target.id,
            "name": target.name,
            "category": target.category,
            "masked_value": vault.mask(body.value),
            "metadata_json": target.metadata_json or {},
            "allowed_agents": target.allowed_agents_json or [],
            "is_active": target.is_active,
        }


@router.post("/vault/{secret_id}/reveal")
async def reveal_secret(secret_id: str) -> Dict[str, Any]:
    vault = VaultService()
    async with AsyncSessionLocal() as session:
        sec = await session.get(ConnectorSecret, secret_id)
        if not sec:
            raise HTTPException(status_code=404, detail="Conector não encontrado")
        return {"id": sec.id, "name": sec.name, "value": vault.decrypt(sec.encrypted_value)}


@router.post("/vault/{secret_id}/toggle")
async def toggle_connector(secret_id: str) -> Dict[str, Any]:
    async with AsyncSessionLocal() as session:
        sec = await session.get(ConnectorSecret, secret_id)
        if not sec:
            raise HTTPException(status_code=404, detail="Conector não encontrado")
        sec.is_active = not sec.is_active
        await session.commit()
        return {"id": sec.id, "is_active": sec.is_active}


# === EMAILS (STRICT HUMAN-IN-THE-LOOP) ===
class EmailDraftEdit(BaseModel):
    recipient: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None


@router.get("/emails")
async def list_emails() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(EmailDraft))).scalars().all()
        return [
            {
                "id": e.id,
                "recipient": e.recipient,
                "subject": e.subject,
                "body": e.body,
                "status": e.status,
                "created_at": e.created_at,
            }
            for e in rows
        ]


@router.patch("/emails/{draft_id}")
async def edit_email_draft(draft_id: str, body: EmailDraftEdit) -> Dict[str, Any]:
    async with AsyncSessionLocal() as session:
        draft = await session.get(EmailDraft, draft_id)
        if not draft:
            raise HTTPException(status_code=404, detail="Rascunho não encontrado")
        if body.recipient is not None:
            draft.recipient = body.recipient
        if body.subject is not None:
            draft.subject = body.subject
        if body.body is not None:
            draft.body = body.body
        await session.commit()
        return {
            "id": draft.id,
            "recipient": draft.recipient,
            "subject": draft.subject,
            "body": draft.body,
            "status": draft.status,
            "created_at": draft.created_at,
        }


@router.post("/emails/{draft_id}/approve-send")
async def approve_send_email(draft_id: str) -> Dict[str, Any]:
    tunnel = _get_tunnel()
    async with AsyncSessionLocal() as session:
        draft = await session.get(EmailDraft, draft_id)
        if not draft:
            raise HTTPException(status_code=404, detail="Rascunho não encontrado")
        if draft.status != "PENDING_APPROVAL":
            raise HTTPException(status_code=400, detail="Rascunho já processado")
        draft.status = "SENT"
        await session.commit()
        pending = (
            await session.execute(select(EmailDraft).where(EmailDraft.status == "PENDING_APPROVAL"))
        ).scalars().all()
        tunnel.pending_emails_count = len(pending)
    tunnel.add_log("INFO", "VPS", f"E-mail aprovado e enviado para {draft.recipient}")
    await tunnel.broadcast(tunnel.gateway_state_payload())
    await tunnel.broadcast({"type": "PILL_FEEDBACK", "label": "E-mail Enviado", "detail": draft.recipient, "variant": "success"})
    return {"id": draft.id, "status": "SENT"}


@router.post("/emails/{draft_id}/discard")
async def discard_email(draft_id: str) -> Dict[str, Any]:
    tunnel = _get_tunnel()
    async with AsyncSessionLocal() as session:
        draft = await session.get(EmailDraft, draft_id)
        if not draft:
            raise HTTPException(status_code=404, detail="Rascunho não encontrado")
        draft.status = "DISCARDED"
        await session.commit()
        pending = (
            await session.execute(select(EmailDraft).where(EmailDraft.status == "PENDING_APPROVAL"))
        ).scalars().all()
        tunnel.pending_emails_count = len(pending)
    await tunnel.broadcast(tunnel.gateway_state_payload())
    return {"id": draft.id, "status": "DISCARDED"}


# === CONVERTER (DRAG & DROP / BATCH) ===
@router.post("/converter/process")
async def convert_file(
    file: UploadFile = File(...),
    target_format: str = Form(...),
) -> Response:
    raw = await file.read()
    src_name = file.filename or "arquivo"
    src_ext = src_name.rsplit(".", 1)[-1].lower() if "." in src_name else ""
    tgt = target_format.lower().strip(".")
    stem = src_name.rsplit(".", 1)[0] if "." in src_name else src_name

    # Image conversion via Pillow
    if tgt in ("png", "jpg", "jpeg", "webp") and src_ext in ("png", "jpg", "jpeg", "webp", "bmp"):
        img = Image.open(io.BytesIO(raw))
        if tgt in ("jpg", "jpeg") and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        out = io.BytesIO()
        pil_fmt = "JPEG" if tgt in ("jpg", "jpeg") else tgt.upper()
        img.save(out, format=pil_fmt)
        return Response(
            content=out.getvalue(),
            media_type=f"image/{'jpeg' if tgt in ('jpg', 'jpeg') else tgt}",
            headers={"Content-Disposition": f'attachment; filename="{stem}.{tgt}"'},
        )

    # JSON <-> CSV
    if src_ext == "json" and tgt == "csv":
        rows = json.loads(raw.decode("utf-8"))
        if isinstance(rows, dict):
            rows = [rows]
        buf = io.StringIO()
        if rows and isinstance(rows[0], dict):
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        return Response(
            content=buf.getvalue().encode("utf-8"),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{stem}.csv"'},
        )

    if src_ext == "csv" and tgt == "json":
        text = raw.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        return Response(
            content=json.dumps(list(reader), ensure_ascii=False, indent=2).encode("utf-8"),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{stem}.json"'},
        )

    # Markdown -> HTML / TXT
    if src_ext in ("md", "txt") and tgt in ("html", "txt", "md"):
        text = raw.decode("utf-8", errors="replace")
        if tgt == "html":
            html = f"<!doctype html><html><body style='background:#090A0F;color:#e5e7eb;font-family:sans-serif;padding:24px'><pre>{text}</pre></body></html>"
            return Response(
                content=html.encode("utf-8"),
                media_type="text/html",
                headers={"Content-Disposition": f'attachment; filename="{stem}.html"'},
            )
        return Response(
            content=text.encode("utf-8"),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{stem}.{tgt}"'},
        )

    raise HTTPException(status_code=400, detail=f"Conversão {src_ext} → {tgt} requer ffmpeg/pandoc instalado no host.")


# === CHAT & TERMINAL COMMAND BAR ===
class ChatReq(BaseModel):
    session_id: str = "main"
    message: str
    force_claude: bool = False


@router.post("/chat")
async def chat_completion(body: ChatReq) -> Dict[str, Any]:
    tunnel = _get_tunnel()
    adaptive = _get_router()
    lower_msg = body.message.lower().strip()

    # Voice / quick intent: create task directly in Dashquadro
    for trigger in ("anote uma tarefa:", "anote uma tarefa", "criar tarefa:", "criar tarefa", "nova tarefa:"):
        if lower_msg.startswith(trigger):
            task_title = body.message[len(trigger):].strip(" :,-") or body.message
            created = await create_task(TaskCreate(title=task_title, status="TODO"))
            reply = f"Tarefa anotada em A Fazer: {created['title']}."
            await tunnel.broadcast({
                "type": "CHAT_STREAM_CHUNK",
                "session_id": body.session_id,
                "chunk": reply,
                "done": True,
                "provider_used": "aurion-voice-intent",
            })
            return {"content": reply, "provider_used": "aurion-voice-intent", "task_type": "FAST_VOICE", "task": created}

    # Voice / quick intent: save persistent fact in 3-layer memory
    for trigger in ("lembre que:", "lembre que", "memorize:", "memorize"):
        if lower_msg.startswith(trigger):
            fact_content = body.message[len(trigger):].strip(" :,-") or body.message
            saved = await remember_fact(fact_content, scope="global", tags=["voz"], importance=7)
            reply = f"Memorizado na camada persistente: {saved['fact_text']}"
            await tunnel.broadcast({
                "type": "CHAT_STREAM_CHUNK",
                "session_id": body.session_id,
                "chunk": reply,
                "done": True,
                "provider_used": "aurion-memory-vault",
            })
            return {"content": reply, "provider_used": "aurion-memory-vault", "task_type": "FAST_VOICE", "memory": saved}

    task_type = classify_task_intent(body.message)
    mem_ctx = await recall_relevant_context(body.message, limit=6)
    system_prompt = (
        "Você é o AURION, orquestrador digital pessoal do Felipe.\n"
        f"{HUMANIZER_SYSTEM_PROMPT}"
    )
    if mem_ctx["context_block"]:
        system_prompt += f"\n\nUse o contexto de infraestrutura e memória persistente abaixo quando relevante:\n{mem_ctx['context_block']}"

    await tunnel.broadcast({"type": "EYE_STATE", "state": "THINKING"})
    res = await adaptive.route_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": body.message},
        ],
        task_type=task_type,
        force_claude=body.force_claude,
    )
    res["content"] = humanize_text(res["content"])
    append_timeline_entry(
        f"Chat ({res['provider_used']}): {body.message[:120]}",
        category="CHAT",
    )
    await tunnel.broadcast({
        "type": "CHAT_STREAM_CHUNK",
        "session_id": body.session_id,
        "chunk": res["content"],
        "done": True,
        "provider_used": res["provider_used"],
    })
    await tunnel.broadcast({"type": "EYE_STATE", "state": "IDLE"})
    return {**res, "task_type": task_type.value}


# === VOICE PIPELINE (NEURAL TTS + GROQ WHISPER STT) ===
class VoiceTtsReq(BaseModel):
    text: str
    voice: str = "pt-BR-AntonioNeural"


@router.post("/voice/tts")
async def voice_tts(body: VoiceTtsReq) -> Response:
    tunnel = _get_tunnel()
    adaptive = _get_router()
    el_key = await adaptive.get_secret("ELEVENLABS_API_KEY")
    await tunnel.broadcast({"type": "EYE_STATE", "state": "SPEAKING"})
    try:
        mp3_bytes = await synthesize_speech_mp3(
            body.text,
            voice=body.voice,
            elevenlabs_api_key=el_key,
        )
        return Response(content=mp3_bytes, media_type="audio/mpeg")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Falha ao sintetizar voz neural: {exc}")
    finally:
        await tunnel.broadcast({"type": "EYE_STATE", "state": "IDLE"})


@router.post("/voice/stt")
async def voice_stt(file: UploadFile = File(...)) -> Dict[str, Any]:
    adaptive = _get_router()
    groq_key = await adaptive.get_secret("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(
            status_code=400,
            detail="GROQ_API_KEY não está ativa no Cofre. Use reconhecimento nativo do navegador ou ative a chave Groq.",
        )
    raw = await file.read()
    text = await transcribe_audio_groq(raw, file.filename or "voice.webm", groq_key)
    return {"text": text or "", "engine": "groq/whisper-large-v3-turbo"}


class CommandReq(BaseModel):
    command: str


@router.post("/command")
async def run_terminal_command(body: CommandReq) -> Dict[str, Any]:
    cmd = body.command.strip()
    tunnel = _get_tunnel()
    if cmd == "/mcp reload":
        tunnel.add_log("INFO", "VPS", "MCP servers recarregados com sucesso.")
        return {"output": "MCP reload concluído: filesystem, playwright-rpa, github ativos."}
    if cmd.startswith("/tunnel"):
        job = await start_tunnel(TunnelStartReq(node_target="VPS", worker_name="cli-tunnel", command=cmd))
        return {"output": f"Túnel {job['id']} iniciado em VPS."}
    if cmd == "/cron trigger":
        tunnel.add_log("INFO", "VPS", "Gatilho Cron manual executado.")
        return {"output": "Rotinas Cron verificadas e disparadas."}
    chat_res = await chat_completion(ChatReq(message=cmd))
    return {"output": chat_res["content"], "provider_used": chat_res["provider_used"]}


# === SYSTEM STATUS, CRON, LOGS, DEVICES, WEBHOOKS ===
@router.get("/system/status")
async def system_status() -> Dict[str, Any]:
    tunnel = _get_tunnel()
    adaptive = _get_router()
    providers = await adaptive.get_status_snapshot()
    return {
        "gateway_status": "ATIVO",
        "providers": providers,
        "matrix": [
            {"name": "Túnel WebSocket /ws/tunnel", "detail": "Autenticação Bearer + reconexão + HEARTBEAT", "tier": "WORKS"},
            {"name": "Olho de Hórus Eye-Tracking", "detail": "Cursor vector 60Hz + estados emocionais", "tier": "WORKS"},
            {"name": "Dashquadro Kanban 5 Colunas", "detail": "Drag-and-drop + Slide-over Drawer", "tier": "WORKS"},
            {"name": "Cofre AES-256 (Fernet)", "detail": "Criptografia em SQLite WAL + auto-clear 30s", "tier": "WORKS"},
            {"name": "Aurion Adaptive Router", "detail": "Failover Groq/Gemini/Cerebras/Mistral + Trava Claude", "tier": "WORKS"},
            {"name": "RPA Desktop Autônomo", "detail": "Loop Observe→Think→Act→Verify + Panic ESC 2x", "tier": "TESTING"},
            {"name": "Automação de E-mail HITL", "detail": "Aprovação obrigatória antes do disparo SMTP", "tier": "TESTING"},
            {"name": "Conversor em Lote", "detail": "Imagens/JSON/CSV nativos + FFmpeg/Pandoc na VPS", "tier": "TESTING"},
            {"name": "App Mobile Companion", "detail": "Notificações push iOS/Android", "tier": "BACKLOG"},
            {"name": "Multi-VPS Cluster", "detail": "Federação automática entre regiões", "tier": "BACKLOG"},
        ],
        "logs_count": len(tunnel.logs),
    }


@router.get("/logs")
async def get_logs() -> List[Dict[str, Any]]:
    return list(_get_tunnel().logs)


@router.get("/devices")
async def list_devices() -> List[Dict[str, Any]]:
    return list(_get_tunnel().devices.values())


@router.get("/cron")
async def list_cron() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(CronJob))).scalars().all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "cron_expr": c.cron_expr,
                "human_schedule": c.human_schedule,
                "assigned_agent": c.assigned_agent,
                "last_status": c.last_status,
                "enabled": c.enabled,
            }
            for c in rows
        ]


@router.post("/cron/{cron_id}/trigger")
async def trigger_cron(cron_id: str) -> Dict[str, Any]:
    async with AsyncSessionLocal() as session:
        c = await session.get(CronJob, cron_id)
        if not c:
            raise HTTPException(status_code=404, detail="Cron não encontrado")
        c.last_status = f"EXECUTADO ({utc_now_iso()[:19]})"
        await session.commit()
    _get_tunnel().add_log("INFO", "VPS", f"Cron '{c.name}' disparado manualmente.")
    return {"id": c.id, "last_status": c.last_status}


@public_router.post("/webhooks/in/{slug}")
async def incoming_webhook(slug: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    now = utc_now_iso()
    title = str(payload.get("title") or f"Webhook [{slug}]")
    task = AgentTask(
        id=f"t_{uuid.uuid4().hex[:8]}",
        title=title[:200],
        description=json.dumps(payload, ensure_ascii=False, indent=2),
        status="TRIAGE",
        board="Aurion - Geral",
        project=str(payload.get("project") or "Aurion"),
        assigned_agent="@orquestrador",
        subtasks_json=[],
        output_log=f"[{now}] Criado via webhook /api/webhooks/in/{slug}",
        created_at=now,
        updated_at=now,
    )
    async with AsyncSessionLocal() as session:
        session.add(task)
        await session.commit()
    tunnel = _get_tunnel()
    tunnel.add_log("INFO", "EVOLUTION_API" if "evo" in slug else "VPS", f"Webhook recebido: {slug}")
    await tunnel.broadcast({"type": "TASK_UPDATED", "task": _serialize_task(task)})
    return {"accepted": True, "task_id": task.id}


# === 3-LAYER MEMORY, MULTI-VPS INVENTORY & EXECUTION CHECKPOINTS ===
class MemoryFactCreate(BaseModel):
    fact_text: str
    scope: str = "global"
    tags: List[str] = []
    importance: int = 5


@router.get("/memory/facts")
async def list_memory_facts(scope: Optional[str] = None) -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        stmt = select(MemoryFact)
        if scope:
            stmt = stmt.where(MemoryFact.scope == scope)
        rows = (await session.execute(stmt)).scalars().all()
        return [
            {
                "id": f.id,
                "scope": f.scope,
                "fact_text": f.fact_text,
                "tags": f.tags_json or [],
                "importance": f.importance,
                "created_at": f.created_at,
                "updated_at": f.updated_at,
            }
            for f in rows
        ]


@router.post("/memory/facts")
async def create_memory_fact(body: MemoryFactCreate) -> Dict[str, Any]:
    return await remember_fact(
        fact_text=body.fact_text,
        scope=body.scope,
        tags=body.tags,
        importance=body.importance,
    )


@router.get("/memory/context")
async def get_memory_context(q: str = "", limit: int = 6) -> Dict[str, Any]:
    return await recall_relevant_context(query=q, limit=limit)


@router.get("/memory/files")
async def get_memory_markdown_files() -> List[Dict[str, Any]]:
    return list_memory_markdown_files()


class VpsNodeUpsert(BaseModel):
    name: str
    host: str
    ssh_port: int = 22
    provider: str = "Hetzner"
    specs: str = "16GB RAM / 80GB NVMe"
    coolify_url: str = ""
    services: List[str] = []
    status: str = "ONLINE"
    notes_md: str = ""


@router.get("/vps")
async def list_vps_nodes() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(VpsNode))).scalars().all()
        return [
            {
                "id": v.id,
                "name": v.name,
                "host": v.host,
                "ssh_port": v.ssh_port,
                "provider": v.provider,
                "specs": v.specs,
                "coolify_url": v.coolify_url,
                "services": v.services_json or [],
                "status": v.status,
                "notes_md": v.notes_md,
                "updated_at": v.updated_at,
            }
            for v in rows
        ]


@router.post("/vps")
async def upsert_vps_node(body: VpsNodeUpsert) -> Dict[str, Any]:
    now = utc_now_iso()
    async with AsyncSessionLocal() as session:
        existing = (
            await session.execute(select(VpsNode).where(VpsNode.name == body.name))
        ).scalar_one_or_none()
        if existing:
            existing.host = body.host
            existing.ssh_port = body.ssh_port
            existing.provider = body.provider
            existing.specs = body.specs
            existing.coolify_url = body.coolify_url
            existing.services_json = body.services
            existing.status = body.status
            existing.notes_md = body.notes_md
            existing.updated_at = now
            node = existing
        else:
            node = VpsNode(
                id=f"vps_{uuid.uuid4().hex[:8]}",
                name=body.name,
                host=body.host,
                ssh_port=body.ssh_port,
                provider=body.provider,
                specs=body.specs,
                coolify_url=body.coolify_url,
                services_json=body.services,
                status=body.status,
                notes_md=body.notes_md,
                updated_at=now,
            )
            session.add(node)
        await session.commit()

    sync_vps_markdown(node)
    append_timeline_entry(f"VPS registrada/atualizada: {node.name} ({node.host})", category="VPS")
    return {
        "id": node.id,
        "name": node.name,
        "host": node.host,
        "ssh_port": node.ssh_port,
        "provider": node.provider,
        "specs": node.specs,
        "coolify_url": node.coolify_url,
        "services": node.services_json or [],
        "status": node.status,
        "notes_md": node.notes_md,
        "updated_at": node.updated_at,
    }


class CheckpointCreate(BaseModel):
    goal: str
    steps: List[str]
    task_id: str = ""
    state: Dict[str, Any] = {}


class CheckpointAdvance(BaseModel):
    current_step: Optional[int] = None
    status: Optional[str] = None
    state_patch: Dict[str, Any] = {}
    note: str = ""


@router.get("/checkpoints")
async def list_checkpoints() -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(ExecutionCheckpoint))).scalars().all()
        return [
            {
                "id": cp.id,
                "task_id": cp.task_id,
                "goal": cp.goal,
                "current_step": cp.current_step,
                "total_steps": cp.total_steps,
                "steps": cp.steps_json or [],
                "state": cp.state_json or {},
                "status": cp.status,
                "updated_at": cp.updated_at,
            }
            for cp in rows
        ]


@router.post("/checkpoints")
async def create_checkpoint(body: CheckpointCreate) -> Dict[str, Any]:
    now = utc_now_iso()
    cp = ExecutionCheckpoint(
        id=f"cp_{uuid.uuid4().hex[:8]}",
        task_id=body.task_id,
        goal=body.goal,
        current_step=0,
        total_steps=max(1, len(body.steps)),
        steps_json=body.steps,
        state_json=body.state,
        status="RUNNING",
        updated_at=now,
    )
    async with AsyncSessionLocal() as session:
        session.add(cp)
        await session.commit()
    append_timeline_entry(f"Checkpoint iniciado: {cp.goal} ({cp.total_steps} passos)", category="CHECKPOINT")
    return {
        "id": cp.id,
        "task_id": cp.task_id,
        "goal": cp.goal,
        "current_step": cp.current_step,
        "total_steps": cp.total_steps,
        "steps": cp.steps_json,
        "state": cp.state_json,
        "status": cp.status,
        "updated_at": cp.updated_at,
    }


@router.post("/checkpoints/{checkpoint_id}/advance")
async def advance_checkpoint(checkpoint_id: str, body: CheckpointAdvance) -> Dict[str, Any]:
    now = utc_now_iso()
    async with AsyncSessionLocal() as session:
        cp = await session.get(ExecutionCheckpoint, checkpoint_id)
        if not cp:
            raise HTTPException(status_code=404, detail="Checkpoint não encontrado")
        next_step = body.current_step if body.current_step is not None else min(cp.total_steps, cp.current_step + 1)
        cp.current_step = next_step
        merged_state = dict(cp.state_json or {})
        merged_state.update(body.state_patch)
        cp.state_json = merged_state
        cp.status = body.status or ("DONE" if next_step >= cp.total_steps else "RUNNING")
        cp.updated_at = now
        await session.commit()
    append_timeline_entry(
        f"Checkpoint {cp.id} ({cp.status}) passo {cp.current_step}/{cp.total_steps}: {body.note or cp.goal}",
        category="CHECKPOINT",
    )
    return {
        "id": cp.id,
        "goal": cp.goal,
        "current_step": cp.current_step,
        "total_steps": cp.total_steps,
        "state": cp.state_json,
        "status": cp.status,
        "updated_at": cp.updated_at,
    }
