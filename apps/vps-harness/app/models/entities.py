from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="TRIAGE", index=True)
    board: Mapped[str] = mapped_column(String(80), default="Aurion - Geral")
    project: Mapped[str] = mapped_column(String(80), default="Aurion")
    assigned_agent: Mapped[str] = mapped_column(String(64), default="@orquestrador")
    subtasks_json: Mapped[list] = mapped_column(JSON, default=list)
    output_log: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[str] = mapped_column(String(40), server_default=func.datetime("now"))
    updated_at: Mapped[str] = mapped_column(String(40), server_default=func.datetime("now"))


class TunnelJob(Base):
    __tablename__ = "tunnel_jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    node_target: Mapped[str] = mapped_column(String(32), default="VPS")
    worker_name: Mapped[str] = mapped_column(String(120), nullable=False)
    command: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="RUNNING", index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    logs_stream_json: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[str] = mapped_column(String(40), server_default=func.datetime("now"))


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    icon: Mapped[str] = mapped_column(String(32), default="flame")
    target_count: Mapped[int] = mapped_column(Integer, default=8)
    current_count: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=1)
    reminder_time: Mapped[str] = mapped_column(String(16), default="09:00")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, default="")
    tags_json: Mapped[list] = mapped_column(JSON, default=list)
    indexed_in_memory: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[str] = mapped_column(String(40), server_default=func.datetime("now"))


class ConnectorSecret(Base):
    __tablename__ = "connector_secrets"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(32), default="API_TOKEN", index=True)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    allowed_agents_json: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class EmailDraft(Base):
    __tablename__ = "email_drafts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    recipient: Mapped[str] = mapped_column(String(180), nullable=False)
    subject: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING_APPROVAL", index=True)
    created_at: Mapped[str] = mapped_column(String(40), server_default=func.datetime("now"))


class CronJob(Base):
    __tablename__ = "cron_jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    cron_expr: Mapped[str] = mapped_column(String(64), nullable=False)
    human_schedule: Mapped[str] = mapped_column(String(160), nullable=False)
    assigned_agent: Mapped[str] = mapped_column(String(64), default="@orquestrador")
    last_status: Mapped[str] = mapped_column(String(32), default="OK")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class ProviderMetric(Base):
    __tablename__ = "provider_metrics"

    provider_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    reliability_score: Mapped[float] = mapped_column(Float, default=100.0)
    avg_latency_ms: Mapped[float] = mapped_column(Float, default=350.0)
    total_calls: Mapped[int] = mapped_column(Integer, default=0)
    failed_calls: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
