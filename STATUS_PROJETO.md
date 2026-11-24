# 👁️ AURION EYE — Status do Projeto & Checklist

> **Repositório:** `https://github.com/Corttex/AURION-EYE.git`  
> **Domínio de Produção:** `https://eyeglobal.aurionagency.com.br`  
> **VPS Principal:** Hetzner (`46.224.103.31` — 16 GB RAM / 80 GB NVMe, Coolify)

---

## 🗺️ Topologia Final (Onde roda cada peça)

* **☁️ Na VPS Hetzner (Coolify) — 3 Serviços:**
  1. **`EYE Aurion` (Container Unificado — porta interna `3011`):** Painel Web Rede MAIN (Next.js) + Cérebro VPS Harness (FastAPI) + Adaptive Router (Hermes 3 + 10 IAs Free) + Memória em 3 Camadas + Nginx Gateway.
  2. **`PostgreSQL` (Privado):** Banco de dados persistente na rede interna do Coolify.
  3. **`Evolution API` (WhatsApp):** Template pronto do Coolify (`Api + Redis + Postgres`).
* **💻 No seu PC Windows:**
  * **Olho de Hórus (`apps/desktop-eye`):** Esfera flutuante, eye-tracking, voz e HUB radial conectado via WSS na VPS.
  * **Chrome Bridge (`apps/chrome-bridge`):** Extensão do Google Chrome para automação de abas.

---

## ✅ O que JÁ FIZEMOS (100% Pronto no Código e no GitHub)

### 1. Monorepo & Protocolo Compartilhado (`packages/shared-protocol`)
* [x] Tipagem TypeScript completa de eventos WebSocket, estados do Olho (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `ALERT`, `FOCUS`), tarefas Kanban, túneis, cofre e rascunhos.

### 2. Cérebro Central — VPS Harness (`apps/vps-harness`)
* [x] **API FastAPI + WebSocket `/ws/tunnel`** com autenticação via `AURION_TOKEN`.
* [x] **Banco Híbrido (PostgreSQL `asyncpg` + SQLite WAL):** funciona nativamente com PostgreSQL via `DATABASE_URL` ou SQLite em `/data`.
* [x] **Cofre AES-256 (Fernet):** criptografia de chaves/credenciais + leitura automática das variáveis de ambiente do Coolify.
* [x] **Aurion Adaptive Router (10 IAs Free + Nous Hermes 3 + Trava Claude):**
  * Failover automático com *cooldown* entre Groq, Google Gemini, OpenRouter (Nous Hermes 3 405B Free + `:free`), Cerebras, SambaNova, Mistral, NVIDIA NIM, GitHub Models, Hugging Face e Cohere.
  * Claude bloqueado como último recurso (só após 2 falhas consecutivas + teto diário).
* [x] **Memória em 3 Camadas para Engenharia & Multi-VPS (`app/core/memory_service.py`):**
  * **Camada 1 (Fatos & Inventário):** tabelas `VpsNode` (já com `hetzner-main` cadastrada) e `MemoryFact` com injeção automática de contexto no `/api/chat` e comando de voz `"lembre que ..."`.
  * **Camada 2 (Markdown Linear estilo Obsidian):** espelhamento automático em `/data/memory/` (`timeline/YYYY-MM-DD.md`, `vps/`, `projects/`, `runbooks/`).
  * **Camada 3 (Checkpoints):** tabela `ExecutionCheckpoint` para tarefas longas não se perderem entre trocas de IA.
* [x] **Pipeline de Voz PT-BR:** TTS neural (`edge-tts`) + STT (`Groq Whisper`).
* [x] **Human-in-the-Loop (E-mails) + Conversor de Arquivos + GUI RPA Worker.**
* [x] **Testes Automatizados:** `uv run pytest -v` passando (`3/3`).

### 3. Painel Web — Rede MAIN (`apps/web-main`)
* [x] Next.js 15 App Router (build standalone pronto para Docker).
* [x] 14 rotas operacionais, Dashquadro Kanban 5 colunas com drag-and-drop, terminal manual `>_` e detecção automática HTTPS/WSS.

### 4. Olho de Hórus Desktop (`apps/desktop-eye`) & Extensão (`apps/chrome-bridge`)
* [x] Esfera reativa estilo Glass/Hórus, eye-tracking, HUB radial orbital com 9 módulos, motor de voz/wake-word e seletor Local/Nuvem.
* [x] Código nativo Rust Tauri v2 (`src-tauri/`) pronto com RPA local e botão de pânico (`ESC 2x`).
* [x] Extensão Chrome Manifest V3 pronta em `apps/chrome-bridge/`.

### 5. Infraestrutura & Deploy (`Dockerfile`, `DEPLOY_VPS.md`, `.env.production.example`)
* [x] `Dockerfile` unificado (multi-stage Node 22 + Python 3.12 + Nginx `:3011`).
* [x] Código versionado e enviado para `https://github.com/Corttex/AURION-EYE.git` (`main`).

---

## 📋 O que FALTA VOCÊ FAZER (Passo a Passo em Ordem)

### Etapa 1 — Subir Banco e WhatsApp no Coolify (VPS Hetzner)
* [ ] **PostgreSQL:**
  * Conferir `Access: Private` (NUNCA público) e `SSL: Disabled`.
  * Clicar em **Save changes** ➔ **Start**.
  * Copiar a **Postgres URL (internal)**.
* [ ] **Evolution API:**
  * Criar DNS tipo `A` (ex: `evo.aurionagency.com.br` ➔ `46.224.103.31`).
  * Colocar o domínio na aba **Domains** do serviço `Api` no Coolify e clicar em **Deploy**.
  * Abrir `https://evo.aurionagency.com.br/manager` usando sua `AUTHENTICATION_API_KEY`, criar uma instância (ex: `aurion`) e escanear o **QR Code** do WhatsApp.

### Etapa 2 — Pegar as Chaves de IA 100% Free (sem cartão)
Pegue pelo menos as **5 principais** abaixo (renova todo dia/mês):
* [ ] **Groq (`GROQ_API_KEY`):** https://console.groq.com/keys
* [ ] **Google AI Studio (`GEMINI_API_KEY`):** https://aistudio.google.com/apikey
* [ ] **OpenRouter (`OPENROUTER_API_KEY` — libera Hermes 3 Free):** https://openrouter.ai/keys
* [ ] **Cerebras (`CEREBRAS_API_KEY`):** https://cloud.cerebras.ai
* [ ] **GitHub Models (`GITHUB_MODELS_PAT`):** https://github.com/settings/tokens
* [ ] *(Opcional)* Mistral, Cohere, Hugging Face, NVIDIA NIM, SambaNova (ver `.env.production.example`).

### Etapa 3 — Subir o `EYE Aurion` no Coolify
* [ ] Em **General ➔ Internal access**: alterar **Exposed ports** de `80` para **`3011`**.
* [ ] Em **General ➔ Build & deploy**: confirmar `Build Pack: Dockerfile` e `Dockerfile Location: /Dockerfile`.
* [ ] Em **Environment Variables ➔ Developer View**: colar `AURION_TOKEN`, suas chaves de IA e a `DATABASE_URL` do PostgreSQL *(trocando o início de `postgres://` para `postgresql+asyncpg://` e sem `?sslmode=require`)*.
* [ ] Em **Persistent Storage**: adicionar volume `aurion_data` montado em `/data`.
* [ ] Clicar em **Deploy** e testar **`https://eyeglobal.aurionagency.com.br`**.

### Etapa 4 — Ativar no seu PC Windows
* [ ] **Usar o Olho agora (modo Web leve, sem precisar de Rust):**
  ```powershell
  pnpm --filter desktop-eye dev
  ```
  Abrir `http://localhost:1420` e conectar na nuvem (`https://eyeglobal.aurionagency.com.br`).
* [ ] *(Opcional — Janela nativa `.exe` transparente sobre o Windows)*: instalar o Rust em https://rustup.rs, reabrir o terminal e rodar `cd apps/desktop-eye && pnpm tauri dev`.
* [ ] **Instalar a Extensão do Chrome:** abrir `chrome://extensions`, ativar **Modo do desenvolvedor**, clicar em **Carregar sem compactação** e selecionar a pasta `apps/chrome-bridge`.

### Etapa 5 — Próximos Upgrades (Depois de tudo verde no ar)
* [ ] **Cloudflare R2 (10 GB grátis):** cadastrar no Coolify e ligar na aba **Backups** do PostgreSQL para backup diário automático.
* [ ] **Integrar envio/webhook da Evolution API:** conectar a URL + instância da Evolution API direto no `vps-harness` para aprovar/enviar mensagens de WhatsApp pelo Olho.
* [ ] **Visualizador Obsidian Web (Opcional):** subir **SilverBullet** apontando para `/data/memory` para visualizar toda a memória Markdown do Aurion.
* [ ] **Automação Multi-VPS:** cadastrar chaves SSH e tokens Coolify de outras VPSs no Cofre AES-256 para o Aurion operar múltiplos servidores com aprovação *Human-in-the-Loop*.
