import io
import re
from typing import Optional

import edge_tts
import httpx


def _clean_text_for_speech(text: str) -> str:
    cleaned = re.sub(r"\[Aurion Harness[^\]]*\]\s*", "", text)
    cleaned = re.sub(r"[`*_#>]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:1200] if cleaned else "Pronto."


async def synthesize_speech_mp3(text: str, voice: str = "pt-BR-AntonioNeural") -> bytes:
    """Generates neutral PT-BR neural audio bytes using Microsoft Edge TTS."""
    spoken = _clean_text_for_speech(text)
    communicate = edge_tts.Communicate(spoken, voice=voice)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()


async def transcribe_audio_groq(
    audio_bytes: bytes,
    filename: str,
    api_key: str,
    language: str = "pt",
) -> Optional[str]:
    """Transcribes audio via Groq whisper-large-v3-turbo when GROQ_API_KEY is active in Vault."""
    files = {"file": (filename or "voice.webm", audio_bytes, "audio/webm")}
    data = {"model": "whisper-large-v3-turbo", "language": language}
    headers = {"Authorization": f"Bearer {api_key}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers=headers,
            files=files,
            data=data,
        )
        resp.raise_for_status()
        payload = resp.json()
        return payload.get("text", "").strip()
