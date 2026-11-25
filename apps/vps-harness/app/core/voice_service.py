import io
import os
from typing import Optional

import edge_tts
import httpx

from app.core.humanizer import humanize_for_speech

DEFAULT_ELEVENLABS_VOICE_ID = "pNInz6obpgDQGcFmaJgB"  # Adam (natural multilingual)


async def _synthesize_elevenlabs_mp3(text: str, api_key: str, voice_id: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.78,
            "style": 0.35,
            "use_speaker_boost": True,
        },
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.content


async def synthesize_speech_mp3(
    text: str,
    voice: str = "pt-BR-AntonioNeural",
    elevenlabs_api_key: Optional[str] = None,
) -> bytes:
    """Generates natural PT-BR neural audio via ElevenLabs (when configured) with Edge TTS fallback."""
    spoken = humanize_for_speech(text)

    el_key = (elevenlabs_api_key or os.getenv("ELEVENLABS_API_KEY", "")).strip()
    if el_key:
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_ELEVENLABS_VOICE_ID).strip() or DEFAULT_ELEVENLABS_VOICE_ID
        try:
            return await _synthesize_elevenlabs_mp3(spoken, el_key, voice_id)
        except Exception:
            # Seamless fallback to free Microsoft Edge Neural TTS if ElevenLabs quota is reached
            pass

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
