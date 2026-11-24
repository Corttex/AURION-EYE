from datetime import datetime, timezone
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import VaultService
from app.models.entities import (
    AgentTask,
    Base,
    ConnectorSecret,
    CronJob,
    EmailDraft,
    Habit,
    Note,
    TunnelJob,
)

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False, future=True)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_wal(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.close()


AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db_and_seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    vault = VaultService()
    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(AgentTask).limit(1))).scalar_one_or_none()
        if existing is not None:
            return

        now = utc_now_iso()
        session.add_all([
            AgentTask(
                id="t_933e5433",
                title="Integrar webhook WhatsApp Evolution API no funil de triagem",
                description="Receber mensagens entrantes da Evolution API, classificar intenção via Groq LPU e criar card automático.",
                status="TRIAGE",
                board="Aurion - Geral",
                project="Aurion",
                assigned_agent="@orquestrador",
                subtasks_json=[
                    {"id": "st1", "title": "Validar HMAC webhook", "done": True},
                    {"id": "st2", "title": "Mapear parser de áudio Whisper", "done": False},
                    {"id": "st3", "title": "Publicar resposta Human-in-the-Loop", "done": False},
                ],
                output_log="[2026-11-24 14:02] Webhook registrado em /webhooks/in/evolution-wa",
                created_at=now,
                updated_at=now,
            ),
            AgentTask(
                id="t_418a9021",
                title="Auditar latência do túnel WireGuard VPS ↔ Desktop Eye",
                description="Medir RTT do WebSocket /ws/tunnel em 60Hz e garantir reconexão exponencial.",
                status="TODO",
                board="Aurion - Geral",
                project="Aurion",
                assigned_agent="@dev",
                subtasks_json=[
                    {"id": "st1", "title": "Benchmark ping/pong WS", "done": True},
                    {"id": "st2", "title": "Configurar heartbeat 15s", "done": False},
                ],
                output_log="",
                created_at=now,
                updated_at=now,
            ),
            AgentTask(
                id="t_772c1104",
                title="Resumo matinal diário de e-mails e pendências críticas",
                description="Execução agendada às 08:00 gerando rascunhos com trava Human-in-the-Loop.",
                status="SCHEDULED",
                board="Aurion - Geral",
                project="MedCore",
                assigned_agent="@copywriter",
                subtasks_json=[
                    {"id": "st1", "title": "Ler caixa IMAP", "done": True},
                    {"id": "st2", "title": "Gerar rascunhos PENDING_APPROVAL", "done": True},
                ],
                created_at=now,
                updated_at=now,
            ),
            AgentTask(
                id="t_504f8819",
                title="Deploy pipeline conversor em lote FFmpeg + Pandoc na VPS",
                description="Suporte a drag-and-drop direto no Olho de Hórus com saída em Downloads/Aurion.",
                status="READY",
                board="Aurion - Geral",
                project="P2W",
                assigned_agent="@arquiteto",
                subtasks_json=[
                    {"id": "st1", "title": "Endpoint multipart /api/converter/process", "done": True},
                ],
                created_at=now,
                updated_at=now,
            ),
            AgentTask(
                id="t_119b6620",
                title="Loop visual Observe→Think→Act→Verify para extração CRM",
                description="Operação autônoma via Gemini Flash Vision + Chrome Bridge sem mover mouse físico.",
                status="IN_PROGRESS",
                board="Aurion - Geral",
                project="Sinal Sign",
                assigned_agent="@rpa_worker",
                subtasks_json=[
                    {"id": "st1", "title": "Conectar Chrome Bridge DOM", "done": True},
                    {"id": "st2", "title": "Validar kill-switch ESC 2x", "done": True},
                    {"id": "st3", "title": "Extrair tabela leads", "done": False},
                ],
                output_log="[Step 1] DOM conectado\n[Step 2] Aguardando próxima captura",
                created_at=now,
                updated_at=now,
            ),
        ])

        session.add_all([
            TunnelJob(
                id="job_vps_01",
                node_target="VPS",
                worker_name="adaptive-router-healthcheck",
                command="router --probe-free-tier",
                status="COMPLETED",
                progress=100,
                logs_stream_json=[
                    "[14:00:01] Verificando nós Groq, Gemini Flash, Cerebras, Mistral...",
                    "[14:00:02] Trava Claude API: BLOQUEADA (0/15 chamadas diárias)",
                ],
                created_at=now,
            ),
        ])

        session.add_all([
            Habit(id="hab_water", name="Hidratação (Copos)", icon="droplets", target_count=8, current_count=5, streak_days=12, reminder_time="10:00"),
            Habit(id="hab_focus", name="Blocos de Foco 25min", icon="timer", target_count=4, current_count=2, streak_days=9, reminder_time="09:00"),
            Habit(id="hab_workout", name="Treino Diário", icon="flame", target_count=1, current_count=0, streak_days=6, reminder_time="18:30"),
        ])

        session.add_all([
            Note(
                id="note_arch_01",
                title="Arquitetura Híbrida Aurion",
                content_md="# Aurion Hybrid Brain\n- Cérebro na VPS rodando 24/7\n- Olho de Hórus leve no Windows/macOS\n- Trava Human-in-the-Loop obrigatória para e-mails e pagamentos.",
                tags_json=["arquitetura", "vps", "seguranca"],
                indexed_in_memory=True,
                updated_at=now,
            ),
        ])

        session.add_all([
            ConnectorSecret(
                id="sec_mcp_fs",
                name="filesystem",
                category="MCP",
                encrypted_value=vault.encrypt("stdio://npx -y @modelcontextprotocol/server-filesystem /workspace"),
                metadata_json={"transport": "stdio", "tools": ["read_file", "write_file", "list_directory"], "status": "healthy"},
                allowed_agents_json=["@orquestrador", "@dev"],
                is_active=True,
            ),
            ConnectorSecret(
                id="sec_mcp_rpa",
                name="playwright-rpa",
                category="MCP",
                encrypted_value=vault.encrypt("sse://http://localhost:8090/mcp/rpa"),
                metadata_json={"transport": "sse", "tools": ["dom_click", "dom_fill", "dom_extract"], "status": "healthy"},
                allowed_agents_json=["@rpa_worker", "@dev"],
                is_active=True,
            ),
            ConnectorSecret(
                id="sec_mcp_gh",
                name="github",
                category="MCP",
                encrypted_value=vault.encrypt("stdio://npx -y @modelcontextprotocol/server-github"),
                metadata_json={"transport": "stdio", "tools": ["create_issue", "get_pull_request", "search_code"], "status": "healthy"},
                allowed_agents_json=["@dev", "@arquiteto"],
                is_active=True,
            ),
            ConnectorSecret(
                id="sec_groq",
                name="GROQ_API_KEY",
                category="API_TOKEN",
                encrypted_value=vault.encrypt("gsk_demo_configure_no_cofre_vps"),
                metadata_json={"provider": "Groq LPU", "tier": "free"},
                allowed_agents_json=["@orquestrador"],
                is_active=False,
            ),
            ConnectorSecret(
                id="sec_gemini",
                name="GEMINI_API_KEY",
                category="API_TOKEN",
                encrypted_value=vault.encrypt("AIza_demo_configure_no_cofre_vps"),
                metadata_json={"provider": "Google AI Studio", "tier": "free"},
                allowed_agents_json=["@orquestrador", "@rpa_worker"],
                is_active=False,
            ),
            ConnectorSecret(
                id="sec_evolution",
                name="EVOLUTION_API_TOKEN",
                category="CHANNEL",
                encrypted_value=vault.encrypt("evo_aurion_whatsapp_channel_key"),
                metadata_json={"instance": "aurion-main-wa", "connected": True},
                allowed_agents_json=["@orquestrador", "@copywriter"],
                is_active=True,
            ),
        ])

        session.add_all([
            EmailDraft(
                id="mail_hitl_01",
                recipient="diretoria@medcore.com.br",
                subject="Relatório Semanal de Automações — Aurion Harness",
                body="Olá equipe,\n\nSegue o resumo consolidado das automações executadas nesta semana pelo ecossistema AURION sem interrupções.\n\nAtenciosamente,\nFelipe / AURION",
                status="PENDING_APPROVAL",
                created_at=now,
            ),
        ])

        session.add_all([
            CronJob(
                id="cron_morning",
                name="Briefing Matinal & Triagem IMAP",
                cron_expr="0 8 * * *",
                human_schedule="Todo dia às 08:00",
                assigned_agent="@orquestrador",
                last_status="OK",
                enabled=True,
            ),
            CronJob(
                id="cron_habits",
                name="Lembrete Proativo de Hidratação",
                cron_expr="0 10-18/2 * * *",
                human_schedule="A cada 2h (10h–18h)",
                assigned_agent="@orquestrador",
                last_status="OK",
                enabled=True,
            ),
        ])

        await session.commit()
