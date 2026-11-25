import json
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional

import httpx


class TaskType(str, Enum):
    FAST_VOICE = "FAST_VOICE"
    VISION_GUI = "VISION_GUI"
    CODING = "CODING"
    GENERAL = "GENERAL"
    CRITICAL_RESCUE = "CRITICAL_RESCUE"


@dataclass
class ProviderNode:
    id: str
    name: str
    base_url: str
    model: str
    api_key_vault_ref: str
    supported_tasks: List[TaskType]
    priority: int
    is_last_resort: bool = False
    reliability_score: float = 100.0
    avg_latency_ms: float = 420.0


DEFAULT_PROVIDERS: List[ProviderNode] = [
    ProviderNode(
        id="groq_fast",
        name="Groq LPU (Llama 3.3 70B)",
        base_url="https://api.groq.com/openai/v1/chat/completions",
        model="llama-3.3-70b-versatile",
        api_key_vault_ref="GROQ_API_KEY",
        supported_tasks=[TaskType.FAST_VOICE, TaskType.GENERAL, TaskType.CODING],
        priority=1,
    ),
    ProviderNode(
        id="gemini_flash_vision",
        name="Google AI Studio (Gemini Flash Latest)",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        model="gemini-flash-latest",
        api_key_vault_ref="GEMINI_API_KEY",
        supported_tasks=[TaskType.VISION_GUI, TaskType.GENERAL, TaskType.FAST_VOICE],
        priority=1,
    ),
    ProviderNode(
        id="cloudflare_workers_ai",
        name="Cloudflare Workers AI (Qwen 3.8 27B Free)",
        base_url="https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions",
        model="@cf/qwen/qwen3.8-27b",
        api_key_vault_ref="CLOUDFLARE_API_TOKEN",
        supported_tasks=[TaskType.VISION_GUI, TaskType.GENERAL, TaskType.CODING],
        priority=2,
    ),
    ProviderNode(
        id="sambanova_fast",
        name="SambaNova Cloud (Free LPU)",
        base_url="https://api.sambanova.ai/v1/chat/completions",
        model="Meta-Llama-3.3-70B-Instruct",
        api_key_vault_ref="SAMBANOVA_API_KEY",
        supported_tasks=[TaskType.FAST_VOICE, TaskType.GENERAL, TaskType.CODING],
        priority=1,
    ),
    ProviderNode(
        id="cerebras_volume",
        name="Cerebras Inference (Free)",
        base_url="https://api.cerebras.ai/v1/chat/completions",
        model="llama-3.3-70b",
        api_key_vault_ref="CEREBRAS_API_KEY",
        supported_tasks=[TaskType.FAST_VOICE, TaskType.GENERAL],
        priority=2,
    ),
    ProviderNode(
        id="hermes_agent",
        name="Nous Hermes 3 (Agent & Tools Free)",
        base_url="https://openrouter.ai/api/v1/chat/completions",
        model="nousresearch/hermes-3-llama-3.1-405b:free",
        api_key_vault_ref="OPENROUTER_API_KEY",
        supported_tasks=[TaskType.GENERAL, TaskType.CODING, TaskType.FAST_VOICE],
        priority=2,
    ),
    ProviderNode(
        id="mistral_codestral",
        name="Mistral Studio (Codestral)",
        base_url="https://api.mistral.ai/v1/chat/completions",
        model="codestral-latest",
        api_key_vault_ref="MISTRAL_API_KEY",
        supported_tasks=[TaskType.CODING],
        priority=1,
    ),
    ProviderNode(
        id="nvidia_nim_free",
        name="NVIDIA NIM (Llama 3.3 / DeepSeek)",
        base_url="https://integrate.api.nvidia.com/v1/chat/completions",
        model="meta/llama-3.3-70b-instruct",
        api_key_vault_ref="NVIDIA_API_KEY",
        supported_tasks=[TaskType.GENERAL, TaskType.CODING],
        priority=2,
    ),
    ProviderNode(
        id="huggingface_free",
        name="Hugging Face Inference (Qwen 2.5)",
        base_url="https://router.huggingface.co/v1/chat/completions",
        model="Qwen/Qwen2.5-72B-Instruct",
        api_key_vault_ref="HF_TOKEN",
        supported_tasks=[TaskType.GENERAL, TaskType.CODING],
        priority=3,
    ),
    ProviderNode(
        id="cohere_free",
        name="Cohere (Command R+ Free Trial)",
        base_url="https://api.cohere.ai/compatibility/v1/chat/completions",
        model="command-r-plus",
        api_key_vault_ref="COHERE_API_KEY",
        supported_tasks=[TaskType.GENERAL],
        priority=3,
    ),
    ProviderNode(
        id="runcrate_ai",
        name="RunCrate AI Gateway",
        base_url="https://api.runcrate.ai/v1/chat/completions",
        model="auto",
        api_key_vault_ref="RUNCRATE_API_KEY",
        supported_tasks=[TaskType.GENERAL, TaskType.CODING, TaskType.FAST_VOICE],
        priority=2,
    ),
    ProviderNode(
        id="openrouter_free_pool",
        name="OpenRouter Free Auto",
        base_url="https://openrouter.ai/api/v1/chat/completions",
        model="openrouter/free",
        api_key_vault_ref="OPENROUTER_API_KEY",
        supported_tasks=[TaskType.GENERAL, TaskType.CODING, TaskType.VISION_GUI, TaskType.FAST_VOICE],
        priority=3,
    ),
    ProviderNode(
        id="github_models",
        name="GitHub Models (Free GPT-4o-mini)",
        base_url="https://models.inference.ai.azure.com/chat/completions",
        model="gpt-4o-mini",
        api_key_vault_ref="GITHUB_MODELS_PAT",
        supported_tasks=[TaskType.CODING, TaskType.GENERAL],
        priority=3,
    ),
    ProviderNode(
        id="claude_last_resort",
        name="Anthropic Claude (Último Recurso)",
        base_url="https://api.anthropic.com/v1/messages",
        model="claude-sonnet-4-6",
        api_key_vault_ref="ANTHROPIC_API_KEY",
        supported_tasks=[TaskType.CRITICAL_RESCUE, TaskType.CODING, TaskType.VISION_GUI, TaskType.GENERAL],
        priority=99,
        is_last_resort=True,
    ),
]


def classify_task_intent(prompt: str, has_image: bool = False) -> TaskType:
    if has_image:
        return TaskType.VISION_GUI
    lower = prompt.lower()
    if any(k in lower for k in ("código", "python", "rust", "sql", "typescript", "bug", "refator", "script")):
        return TaskType.CODING
    if len(prompt) < 100 or any(k in lower for k in ("anote", "lembrete", "foco", "tarefa", "status", "olá", "oi")):
        return TaskType.FAST_VOICE
    return TaskType.GENERAL


class AurionAdaptiveRouter:
    def __init__(
        self,
        redis_client: Any,
        vault_getter: Callable[[str], Awaitable[Optional[str]]],
        claude_daily_cap: int = 15,
    ):
        self.redis = redis_client
        self.get_secret = vault_getter
        self.providers = [ProviderNode(**vars(p)) for p in DEFAULT_PROVIDERS]
        self.claude_daily_cap = claude_daily_cap

    async def _is_in_cooldown(self, provider_id: str) -> bool:
        return (await self.redis.exists(f"aurion:cooldown:{provider_id}")) > 0

    async def _set_cooldown(self, provider_id: str, seconds: int = 60) -> None:
        await self.redis.setex(f"aurion:cooldown:{provider_id}", seconds, "1")

    async def _can_use_claude(self, failure_count: int, force_claude: bool) -> bool:
        if not force_claude and failure_count < 2:
            return False
        today_key = f"aurion:claude_calls:{time.strftime('%Y-%m-%d')}"
        calls = int(await self.redis.get(today_key) or 0)
        return calls < self.claude_daily_cap

    async def _increment_claude_usage(self) -> None:
        today_key = f"aurion:claude_calls:{time.strftime('%Y-%m-%d')}"
        pipe = self.redis.pipeline()
        pipe.incr(today_key)
        pipe.expire(today_key, 86400)
        await pipe.execute()

    def _update_score(self, provider: ProviderNode, success: bool, latency_ms: float) -> None:
        if success:
            provider.avg_latency_ms = (provider.avg_latency_ms * 0.8) + (latency_ms * 0.2)
            provider.reliability_score = min(100.0, provider.reliability_score + 1.5)
        else:
            provider.reliability_score = max(10.0, provider.reliability_score - 12.0)

    async def get_status_snapshot(self) -> List[Dict[str, Any]]:
        snapshot = []
        for p in self.providers:
            in_cd = await self._is_in_cooldown(p.id)
            key = await self.get_secret(p.api_key_vault_ref)
            snapshot.append({
                "id": p.id,
                "name": p.name,
                "model": p.model,
                "priority": p.priority,
                "is_last_resort": p.is_last_resort,
                "reliability_score": round(p.reliability_score, 1),
                "avg_latency_ms": round(p.avg_latency_ms, 1),
                "in_cooldown": in_cd,
                "has_key": bool(key),
                "supported_tasks": [t.value for t in p.supported_tasks],
            })
        return snapshot

    async def route_completion(
        self,
        messages: List[Dict[str, Any]],
        task_type: TaskType = TaskType.GENERAL,
        json_mode: bool = False,
        force_claude: bool = False,
        temperature: float = 0.2,
        allow_local_fallback: bool = True,
    ) -> Dict[str, Any]:
        candidates = [
            p for p in self.providers
            if task_type in p.supported_tasks and not p.is_last_resort
        ]
        candidates.sort(key=lambda p: (p.priority, -p.reliability_score, p.avg_latency_ms))

        failures = 0
        last_error: Optional[str] = None
        attempted = 0

        for provider in candidates:
            if await self._is_in_cooldown(provider.id):
                continue

            api_key = await self.get_secret(provider.api_key_vault_ref)
            if not api_key:
                continue

            target_url = provider.base_url
            if "{account_id}" in target_url:
                account_id = await self.get_secret("CLOUDFLARE_ACCOUNT_ID")
                if not account_id:
                    continue
                target_url = target_url.replace("{account_id}", account_id.strip())

            attempted += 1
            start = time.perf_counter()
            try:
                result = await self._call_openai_compatible(
                    provider=provider,
                    api_key=api_key,
                    messages=messages,
                    json_mode=json_mode,
                    temperature=temperature,
                    target_url=target_url,
                )
                latency = (time.perf_counter() - start) * 1000
                self._update_score(provider, success=True, latency_ms=latency)
                return {
                    "content": result,
                    "provider_used": provider.id,
                    "model": provider.model,
                    "latency_ms": round(latency, 1),
                    "fallback_count": failures,
                }
            except httpx.HTTPStatusError as exc:
                failures += 1
                last_error = str(exc)
                self._update_score(provider, success=False, latency_ms=0)
                if exc.response.status_code in (429, 502, 503, 529):
                    await self._set_cooldown(provider.id, seconds=90)
            except Exception as exc:
                failures += 1
                last_error = str(exc)
                self._update_score(provider, success=False, latency_ms=0)
                await self._set_cooldown(provider.id, seconds=30)

        claude_node = next((p for p in self.providers if p.is_last_resort), None)
        if claude_node and await self._can_use_claude(failures, force_claude):
            claude_key = await self.get_secret(claude_node.api_key_vault_ref)
            if claude_key:
                start = time.perf_counter()
                result = await self._call_anthropic_native(
                    provider=claude_node,
                    api_key=claude_key,
                    messages=messages,
                    temperature=temperature,
                )
                await self._increment_claude_usage()
                latency = (time.perf_counter() - start) * 1000
                return {
                    "content": result,
                    "provider_used": claude_node.id,
                    "model": claude_node.model,
                    "latency_ms": round(latency, 1),
                    "fallback_count": failures,
                }

        if allow_local_fallback and attempted == 0:
            return self._local_harness_reply(messages, task_type, json_mode)

        raise RuntimeError(f"Todos os provedores falharam ou atingiram limite. Último erro: {last_error}")

    def _local_harness_reply(
        self,
        messages: List[Dict[str, Any]],
        task_type: TaskType,
        json_mode: bool,
    ) -> Dict[str, Any]:
        last_user = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
        text_prompt = last_user if isinstance(last_user, str) else json.dumps(last_user)
        if json_mode:
            content = json.dumps({
                "status": "DONE",
                "action": "WAIT",
                "x": 500,
                "y": 500,
                "text": "",
                "reason": "Modo local ativo — configure GEMINI_API_KEY ou GROQ_API_KEY no Cofre para visão em tempo real.",
                "is_destructive": False,
            })
        else:
            content = (
                f"[Aurion Harness • Modo Local ({task_type.value})] "
                f"Recebido: \"{text_prompt[:140]}\". "
                "Nenhuma chave externa ativa no Cofre ainda — ative Groq, Gemini Flash ou OpenRouter em Conectores para inferência em nuvem."
            )
        return {
            "content": content,
            "provider_used": "aurion_local_orchestrator",
            "model": "harness-deterministic-v1",
            "latency_ms": 4.2,
            "fallback_count": 0,
        }

    async def _call_openai_compatible(
        self,
        provider: ProviderNode,
        api_key: str,
        messages: List[Dict[str, Any]],
        json_mode: bool,
        temperature: float,
        target_url: Optional[str] = None,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": provider.model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(target_url or provider.base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_anthropic_native(
        self,
        provider: ProviderNode,
        api_key: str,
        messages: List[Dict[str, Any]],
        temperature: float,
    ) -> str:
        system_prompt = ""
        user_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_prompt += str(msg["content"]) + "\n"
            else:
                user_messages.append({"role": msg["role"], "content": msg["content"]})

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": provider.model,
            "max_tokens": 4096,
            "temperature": temperature,
            "system": system_prompt.strip(),
            "messages": user_messages,
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(provider.base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]
