from datetime import datetime, timezone
import os
from pathlib import Path
import re
from typing import Any, Dict, List
import uuid

from sqlalchemy import desc, select

from app.core.database import AsyncSessionLocal, utc_now_iso
from app.models.entities import ExecutionCheckpoint, MemoryFact, VpsNode


def resolve_memory_root() -> Path:
    env_dir = os.getenv("AURION_MEMORY_DIR", "").strip()
    if env_dir:
        root = Path(env_dir)
    elif Path("/data").exists() and os.access("/data", os.W_OK):
        root = Path("/data/memory")
    else:
        root = Path("./memory_vault")
    for sub in ("timeline", "vps", "projects", "runbooks"):
        (root / sub).mkdir(parents=True, exist_ok=True)
    return root


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip().lower()).strip("-")
    return cleaned or "item"


def append_timeline_entry(entry: str, category: str = "SYSTEM") -> Path:
    root = resolve_memory_root()
    now = datetime.now(timezone.utc)
    day_file = root / "timeline" / f"{now.strftime('%Y-%m-%d')}.md"
    if not day_file.exists():
        day_file.write_text(f"# AURION Timeline — {now.strftime('%Y-%m-%d')}\n\n", encoding="utf-8")
    timestamp = now.strftime("%H:%M:%S UTC")
    with day_file.open("a", encoding="utf-8") as fh:
        fh.write(f"- **[{timestamp}]** `[{category}]` {entry.strip()}\n")
    return day_file


def sync_vps_markdown(node: VpsNode) -> Path:
    root = resolve_memory_root()
    md_path = root / "vps" / f"{_slugify(node.name)}.md"
    services_md = "\n".join(f"- {svc}" for svc in (node.services_json or [])) or "- (nenhum registrado)"
    content = (
        f"# VPS: {node.name}\n\n"
        f"- **Host:** `{node.host}:{node.ssh_port}`\n"
        f"- **Provider:** {node.provider}\n"
        f"- **Specs:** {node.specs}\n"
        f"- **Status:** {node.status}\n"
        f"- **Coolify:** {node.coolify_url or 'N/A'}\n"
        f"- **Atualizado:** {node.updated_at}\n\n"
        f"## Serviços Ativos\n{services_md}\n\n"
        f"## Notas Operacionais\n{node.notes_md or '_Sem notas adicionais._'}\n"
    )
    md_path.write_text(content, encoding="utf-8")
    return md_path


def sync_scope_fact_markdown(fact: MemoryFact) -> Path:
    root = resolve_memory_root()
    folder = "projects"
    name = fact.scope
    if ":" in fact.scope:
        prefix, rest = fact.scope.split(":", 1)
        if prefix in ("vps", "projects", "runbooks"):
            folder = prefix
        elif prefix == "project":
            folder = "projects"
        name = rest
    md_path = root / folder / f"{_slugify(name)}.md"
    if not md_path.exists():
        md_path.write_text(f"# Memória: {fact.scope}\n\n", encoding="utf-8")
    tags = " ".join(f"#{t}" for t in (fact.tags_json or []))
    with md_path.open("a", encoding="utf-8") as fh:
        fh.write(f"- [{fact.updated_at[:19]}] (imp:{fact.importance}) {fact.fact_text} {tags}\n")
    return md_path


def _keyword_score(text: str, query_tokens: List[str]) -> int:
    if not query_tokens:
        return 0
    lower = text.lower()
    return sum(1 for tok in query_tokens if tok in lower)


async def remember_fact(
    fact_text: str,
    scope: str = "global",
    tags: List[str] | None = None,
    importance: int = 5,
) -> Dict[str, Any]:
    now = utc_now_iso()
    fact = MemoryFact(
        id=f"mem_{uuid.uuid4().hex[:8]}",
        scope=scope.strip() or "global",
        fact_text=fact_text.strip(),
        tags_json=tags or [],
        importance=max(1, min(10, importance)),
        created_at=now,
        updated_at=now,
    )
    async with AsyncSessionLocal() as session:
        session.add(fact)
        await session.commit()

    sync_scope_fact_markdown(fact)
    append_timeline_entry(f"Memória gravada ({fact.scope}): {fact.fact_text}", category="MEMORY")
    return {
        "id": fact.id,
        "scope": fact.scope,
        "fact_text": fact.fact_text,
        "tags": fact.tags_json,
        "importance": fact.importance,
        "updated_at": fact.updated_at,
    }


async def recall_relevant_context(query: str, limit: int = 6) -> Dict[str, Any]:
    tokens = [t for t in re.findall(r"[a-zA-ZÀ-ÿ0-9_.-]{3,}", query.lower())]

    async with AsyncSessionLocal() as session:
        facts = (
            await session.execute(select(MemoryFact).order_by(desc(MemoryFact.importance), desc(MemoryFact.updated_at)).limit(80))
        ).scalars().all()
        vps_nodes = (await session.execute(select(VpsNode))).scalars().all()
        checkpoints = (
            await session.execute(select(ExecutionCheckpoint).where(ExecutionCheckpoint.status == "RUNNING").limit(5))
        ).scalars().all()

    scored_facts = []
    for f in facts:
        score = _keyword_score(f"{f.scope} {f.fact_text} {' '.join(f.tags_json or [])}", tokens) * 10 + f.importance
        scored_facts.append((score, f))
    scored_facts.sort(key=lambda item: item[0], reverse=True)
    top_facts = [f for _, f in scored_facts[:limit]]

    lines: List[str] = []
    if vps_nodes:
        lines.append("[INFRAESTRUTURA MULTI-VPS]")
        for v in vps_nodes[:5]:
            lines.append(f"- {v.name} ({v.host}) | {v.specs} | Status: {v.status} | Serviços: {', '.join(v.services_json or [])}")
    if top_facts:
        lines.append("[MEMÓRIA PERSISTENTE RELEVANTE]")
        for f in top_facts:
            lines.append(f"- ({f.scope}) {f.fact_text}")
    if checkpoints:
        lines.append("[CHECKPOINTS EM ANDAMENTO]")
        for cp in checkpoints:
            lines.append(f"- {cp.goal} ({cp.current_step}/{cp.total_steps})")

    return {
        "context_block": "\n".join(lines),
        "facts_count": len(top_facts),
        "vps_count": len(vps_nodes),
        "active_checkpoints": len(checkpoints),
    }


def list_memory_markdown_files() -> List[Dict[str, Any]]:
    root = resolve_memory_root()
    files: List[Dict[str, Any]] = []
    for path in sorted(root.rglob("*.md")):
        rel = path.relative_to(root).as_posix()
        stat = path.stat()
        files.append({
            "path": rel,
            "size_bytes": stat.st_size,
            "preview": path.read_text(encoding="utf-8")[:500],
        })
    return files
