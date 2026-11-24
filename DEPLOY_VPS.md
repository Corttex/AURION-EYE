# Deploy AURION em Produção — `https://eyeglobal.aurionagency.com.br`

## 1. Deploy no Coolify (Passo a Passo Exato)

Você pode subir no Coolify de **duas formas** — ambas funcionam com a porta `3011`:

### Opção 1 — Build Pack `Dockerfile` (Mais Rápida • 1 Container)
1. Em **Configuration → General**:
   - **Build Pack:** `Dockerfile`
   - **Dockerfile Location:** `/Dockerfile`
   - **Domains:** `https://eyeglobal.aurionagency.com.br`
   - **Ports Exposes:** `3011`
2. Em **Environment Variables**:
   - `AURION_TOKEN` = gere um segredo forte (`openssl rand -hex 32`)
   - `CLAUDE_DAILY_CAP` = `15`
3. Em **Storages / Persistent Volumes**:
   - Mount path: `/data` (mantém SQLite + Cofre AES-256 `.aurion_master.key` salvos entre deploys).
4. Clique em **Deploy**.

### Opção 2 — Build Pack `Docker Compose` (Multi-Container com Redis dedicado)
1. Em **Configuration → General**:
   - **Build Pack:** `Docker Compose`
   - **Docker Compose Location:** `/docker-compose.yml`
2. No serviço **`gateway`**, defina o domínio `https://eyeglobal.aurionagency.com.br:3011`.
3. Em **Environment Variables**, defina `AURION_TOKEN`.

---

## 2. Conectar seu PC ao Cérebro na Cloud
1. **Rede MAIN:** acesse `https://eyeglobal.aurionagency.com.br` e informe o `AURION_TOKEN` na tela de acesso.
2. **Aurion Eye (Olho no Desktop):** abra **Ajustes (⚙)** → clique em **`☁️ eyeglobal...`**, cole o `AURION_TOKEN` e clique em **Salvar & Reconectar Túnel**.
3. **Chrome Extension Bridge:** já tenta `wss://eyeglobal.aurionagency.com.br/ws/tunnel` automaticamente (com fallback local).
