import re

# Baseado nos princípios do projeto blader/humanizer (GitHub) adaptados para PT-BR falado e escrito
HUMANIZER_SYSTEM_PROMPT = (
    "Estilo de comunicação (Humanizer PT-BR):\n"
    "- Fale como um parceiro técnico humano, direto, natural e inteligente — nunca como um robô corporativo.\n"
    "- NUNCA comece com clichês de IA como 'Certamente!', 'Com certeza!', 'Ótima pergunta!', "
    "'Claro, ficarei feliz em ajudar!', 'Como uma inteligência artificial...' ou 'Espero que isso ajude'.\n"
    "- Evite palavras infladas e artificiais ('mergulhar fundo', 'crucial', 'paisagem tecnológica', "
    "'testamento', 'revolucionar', 'alavancar', 'sinergia', 'em suma', 'além disso').\n"
    "- Evite excesso de travessões (—) e listas burocráticas quando uma frase direta resolve melhor.\n"
    "- Use frases com ritmo natural (misture frases curtas e médias), como alguém falando de verdade no dia a dia."
)

_ROBOTIC_OPENERS = [
    r"^(certamente|com certeza|claro|perfeito|excelente pergunta|ótima pergunta|boa pergunta)[!,.:;\s-]+",
    r"^(olá!?\s*)?(ficarei feliz em ajudar|posso ajudar com isso|aqui está o que você pediu)[!,.:;\s-]+",
    r"^como uma (inteligência artificial|ia|modelo de linguagem)[^.!?\n]*[.!?]\s*",
]

_ROBOTIC_CLOSERS = [
    r"\s*(espero que isso ajude|se precisar de mais alguma coisa,?\s*estou à disposição|qualquer dúvida,?\s*é só chamar)[!.]*\s*$",
]

_CLICHE_REPLACEMENTS = [
    (r"\bmergulhar fundo\b", "ir direto ao ponto"),
    (r"\bem suma\b", "no fim das contas"),
    (r"\balém disso,\s*", "Também "),
    (r"\bvale ressaltar que\b", "repare que"),
    (r"\bé crucial\b", "é essencial"),
    (r"\bsem dúvida alguma\b", "com certeza"),
]


def humanize_text(text: str) -> str:
    """Removes robotic AI writing patterns while preserving technical accuracy and code blocks."""
    if not text or not text.strip():
        return text

    # Preserve fenced code blocks untouched
    code_blocks: list[str] = []

    def _stash_code(match: re.Match[str]) -> str:
        code_blocks.append(match.group(0))
        return f"__AURION_CODE_BLOCK_{len(code_blocks) - 1}__"

    working = re.sub(r"```[\s\S]*?```", _stash_code, text.strip())

    for pattern in _ROBOTIC_OPENERS:
        working = re.sub(pattern, "", working, flags=re.IGNORECASE).strip()

    for pattern in _ROBOTIC_CLOSERS:
        working = re.sub(pattern, "", working, flags=re.IGNORECASE).strip()

    for pattern, repl in _CLICHE_REPLACEMENTS:
        working = re.sub(pattern, repl, working, flags=re.IGNORECASE)

    # Replace excessive em-dashes with cleaner natural punctuation
    if working.count("—") > 2:
        working = working.replace(" — ", ", ").replace("—", ", ")

    # Capitalize first letter if opener stripping left lowercase
    if working and working[0].islower():
        working = working[0].upper() + working[1:]

    for idx, block in enumerate(code_blocks):
        working = working.replace(f"__AURION_CODE_BLOCK_{idx}__", block)

    return working.strip() or text.strip()


def humanize_for_speech(text: str) -> str:
    """Prepares clean, natural PT-BR prose for neural TTS (ElevenLabs / Edge TTS)."""
    cleaned = humanize_text(text)
    cleaned = re.sub(r"\[Aurion Harness[^\]]*\]\s*", "", cleaned)
    cleaned = re.sub(r"```[\s\S]*?```", " código enviado na tela. ", cleaned)
    cleaned = re.sub(r"https?://\S+", "o link na tela", cleaned)
    cleaned = re.sub(r"^\s*[-*•]\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"[`*_#>|~]", "", cleaned)
    cleaned = re.sub(r"\n+", ". ", cleaned)
    cleaned = re.sub(r"\.\s*\.", ".", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:1200] if cleaned else "Pronto."
