'use client';

import React from 'react';
import { ShellLayout } from '@/components/ShellLayout';
import { DashquadroView } from '@/components/views/DashquadroView';
import {
  ChannelsAndEmailsView,
  ChatSessionsView,
  CronView,
  LogsView,
  McpAndVaultView,
  NotesAndConverterView,
  PairingView,
  SettingsAndMatrixView,
  SimpleCatalogView,
} from '@/components/views/OperationalViews';
import { useAurionGateway } from '@/hooks/useAurionGateway';
import { useAurionStore } from '@/store/useAurionStore';

export default function RedeMainPage() {
  const { sendFocusEye } = useAurionGateway();
  const activeRoute = useAurionStore((s) => s.activeRoute);

  return (
    <ShellLayout onBackToEye={sendFocusEye}>
      {activeRoute === 'dashquadro' && <DashquadroView />}
      {activeRoute === 'chat' && <ChatSessionsView />}
      {activeRoute === 'logs' && <LogsView />}
      {activeRoute === 'cron' && <CronView />}
      {activeRoute === 'mcp' && <McpAndVaultView mode="mcp" />}
      {activeRoute === 'cofre' && <McpAndVaultView mode="cofre" />}
      {activeRoute === 'canais' && <ChannelsAndEmailsView />}
      {activeRoute === 'emparelhamento' && <PairingView />}
      {activeRoute === 'anotacoes' && <NotesAndConverterView />}
      {activeRoute === 'configuracoes' && <SettingsAndMatrixView />}
      {activeRoute === 'habilidades' && (
        <SimpleCatalogView
          title="Habilidades Markdown (Skills)"
          items={[
            { name: 'rpa-visual-loop.md', desc: 'Diretrizes Observe→Think→Act→Verify em coordenadas 0..1000.', tag: 'ATIVA' },
            { name: 'email-hitl-guard.md', desc: 'Exige confirmação humana antes de qualquer disparo SMTP.', tag: 'OBRIGATÓRIA' },
            { name: 'adaptive-router-policy.md', desc: 'Mantém Claude bloqueado até 2 falhas consecutivas em APIs free.', tag: 'ATIVA' },
          ]}
        />
      )}
      {activeRoute === 'plugins' && (
        <SimpleCatalogView
          title="Plugins Internos do Harness"
          items={[
            { name: 'Conversor FFmpeg / Pandoc / Pillow', desc: 'Converte imagens, JSON/CSV, documentos e áudio na VPS.', tag: 'ONLINE' },
            { name: 'Autonomous GUI Worker', desc: 'Operação autônoma de interface via Gemini Flash Vision.', tag: 'EM TESTES' },
            { name: 'Chrome Extension Bridge', desc: 'Automação direta no DOM do navegador sem mover o cursor.', tag: 'ONLINE' },
          ]}
        />
      )}
      {activeRoute === 'webhooks' && (
        <SimpleCatalogView
          title="Endpoints de Webhook"
          items={[
            { name: '/api/webhooks/in/evolution-wa', desc: 'Recebe mensagens WhatsApp e cria cards na coluna Triagem.', tag: 'POST' },
            { name: '/api/webhooks/in/github-events', desc: 'Captura PRs e Issues para revisão automática de agentes.', tag: 'POST' },
          ]}
        />
      )}
      {activeRoute === 'perfis' && (
        <SimpleCatalogView
          title="Perfis e Personas de Sub-Agentes"
          items={[
            { name: '@orquestrador', desc: 'Coordena filas, triagem e roteamento semântico.', tag: 'ROOT' },
            { name: '@arquiteto', desc: 'Projeta schemas, fluxos e integrações de infraestrutura.', tag: 'VPS' },
            { name: '@dev', desc: 'Executa código, testes e automações via Mistral Codestral.', tag: 'CODING' },
            { name: '@rpa_worker', desc: 'Opera navegador e desktop sob trava de pânico ESC 2x.', tag: 'LOCAL' },
            { name: '@copywriter', desc: 'Redige rascunhos de e-mails e mensagens para aprovação HITL.', tag: 'HITL' },
          ]}
        />
      )}
    </ShellLayout>
  );
}
