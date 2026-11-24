import asyncio
import json
from typing import Any, Dict

from app.router.adaptive_router import AurionAdaptiveRouter, TaskType

GUI_SYSTEM_PROMPT = """
Você é o módulo de visão e controle motor do AURION.
Analise a imagem da tela atual do usuário e retorne ESTRITAMENTE um JSON válido com a próxima ação atômica para cumprir o objetivo.
Use coordenadas normalizadas de 0 a 1000 (onde x=0,y=0 é o topo esquerdo e x=1000,y=1000 é o canto inferior direito).

Formato obrigatório:
{
  "status": "CONTINUE" | "DONE" | "NEED_CONFIRMATION",
  "action": "CLICK" | "DOUBLE_CLICK" | "RIGHT_CLICK" | "TYPE" | "HOTKEY" | "SCROLL" | "WAIT",
  "x": 500,
  "y": 500,
  "text": "texto opcional para digitar ou teclas separadas por + ex: ctrl+s",
  "reason": "descrição curta do que está fazendo",
  "is_destructive": false
}

Regra de segurança: Se a ação envolver enviar e-mail/mensagem, confirmar pagamento, deletar arquivos ou alterar configurações críticas, defina "status": "NEED_CONFIRMATION" e "is_destructive": true.
"""


class AutonomousGuiWorker:
    def __init__(self, router: AurionAdaptiveRouter, tunnel_manager: Any):
        self.router = router
        self.tunnel = tunnel_manager

    async def execute_goal(self, session_id: str, goal: str, max_steps: int = 15) -> None:
        await self.tunnel.send_event(session_id, {
            "type": "EYE_STATE",
            "state": "EXECUTING_TUNNEL",
            "banner": "Aurion no controle • ESC 2x para parar",
        })

        history = []
        try:
            for step in range(1, max_steps + 1):
                if await self.tunnel.is_aborted(session_id):
                    break

                screen_payload = await self.tunnel.request_desktop_action(
                    session_id, {"cmd": "CAPTURE_SCREEN"}
                )
                if screen_payload.get("aborted") or not screen_payload.get("image_base64"):
                    break

                image_b64 = screen_payload["image_base64"]
                messages = [
                    {"role": "system", "content": GUI_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    f"Objetivo: {goal}\nPasso atual: {step}/{max_steps}\n"
                                    f"Histórico recente: {json.dumps(history[-3:], ensure_ascii=False)}"
                                ),
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                            },
                        ],
                    },
                ]

                response = await self.router.route_completion(
                    messages=messages,
                    task_type=TaskType.VISION_GUI,
                    json_mode=True,
                )
                decision: Dict[str, Any] = json.loads(response["content"])
                history.append({"step": step, "decision": decision})

                if decision.get("status") == "DONE":
                    await self.tunnel.send_event(session_id, {
                        "type": "PILL_FEEDBACK",
                        "label": "Tarefa Concluída",
                        "detail": decision.get("reason", goal),
                        "variant": "success",
                    })
                    break

                if decision.get("status") == "NEED_CONFIRMATION" or decision.get("is_destructive"):
                    approved = await self.tunnel.request_user_approval(session_id, {
                        "title": "Confirmação Necessária",
                        "reason": decision.get("reason", ""),
                        "action": decision.get("action", ""),
                    })
                    if not approved:
                        break

                act_res = await self.tunnel.request_desktop_action(session_id, {
                    "cmd": "EXECUTE_INPUT",
                    "action": decision["action"],
                    "norm_x": decision.get("x", 500),
                    "norm_y": decision.get("y", 500),
                    "text": decision.get("text", ""),
                })
                if act_res.get("aborted"):
                    break

                await asyncio.sleep(0.55)
        finally:
            await self.tunnel.send_event(session_id, {
                "type": "EYE_STATE",
                "state": "IDLE",
                "banner": None,
            })
