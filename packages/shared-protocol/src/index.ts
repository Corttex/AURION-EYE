export const AURION_THEME = {
  obsidianBase: '#090A0F',
  obsidianElevated: '#11131A',
  obsidianSidebar: '#0C0D12',
  subtleBorder: '#1E2230',
  gold: '#D4AF37',
  neonLime: '#B8FF2C',
  electricPurple: '#8B5CF6',
  triageBlue: '#3B82F6',
  scheduledIndigo: '#6366F1',
  mutedGray: '#6B7280',
} as const;

export type EyeState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'EXECUTING_TUNNEL'
  | 'ALERT'
  | 'FOCUS';

export type GatewayStatus = 'ATIVO' | 'DEGRADADO' | 'OFFLINE';

export type NodeTarget = 'VPS' | 'DESKTOP_PC' | 'CHROME_BRIDGE';

export type TaskStatus =
  | 'TRIAGE'
  | 'TODO'
  | 'SCHEDULED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'DONE';

export type TunnelStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'ABORTED';

export type ConnectorCategory =
  | 'MCP'
  | 'API_TOKEN'
  | 'GITHUB_KEY'
  | 'WEBHOOK'
  | 'CHANNEL';

export type EmailDraftStatus = 'PENDING_APPROVAL' | 'SENT' | 'DISCARDED';

export type EyeModuleId =
  | 'chat'
  | 'tasks'
  | 'tunnels'
  | 'habits'
  | 'notes'
  | 'converter'
  | 'connectors'
  | 'emails'
  | 'settings';

export type WebMainRouteId =
  | 'dashquadro'
  | 'chat'
  | 'logs'
  | 'cron'
  | 'habilidades'
  | 'plugins'
  | 'mcp'
  | 'canais'
  | 'webhooks'
  | 'emparelhamento'
  | 'cofre'
  | 'anotacoes'
  | 'perfis'
  | 'configuracoes';

export interface GatewayStatePayload {
  eye_state: EyeState;
  active_tunnels_count: number;
  gateway_status: GatewayStatus;
  active_sessions: number;
  pending_emails_count?: number;
  banner?: string | null;
  focus_remaining_sec?: number | null;
}

export interface SubtaskItem {
  id: string;
  title: string;
  done: boolean;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  board: string;
  project: string;
  assigned_agent: string;
  subtasks: SubtaskItem[];
  output_log?: string;
  created_at: string;
  updated_at: string;
}

export interface TunnelJob {
  id: string;
  node_target: NodeTarget;
  worker_name: string;
  command: string;
  status: TunnelStatus;
  progress: number;
  logs_stream: string[];
  created_at: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  target_count: number;
  current_count: number;
  streak_days: number;
  reminder_time: string;
}

export interface Note {
  id: string;
  title: string;
  content_md: string;
  tags: string[];
  indexed_in_memory: boolean;
  updated_at: string;
}

export interface ConnectorSecretView {
  id: string;
  name: string;
  category: ConnectorCategory;
  masked_value: string;
  metadata_json: Record<string, unknown>;
  is_active: boolean;
  allowed_agents: string[];
}

export interface EmailDraft {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailDraftStatus;
  created_at: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  node_type: NodeTarget;
  tunnel_ip: string;
  client_version: string;
  latency_ms: number;
  online: boolean;
  permissions: {
    microphone: boolean;
    screen_capture: boolean;
    local_rpa: boolean;
    chrome_bridge: boolean;
  };
  last_seen: string;
}

export interface CronRoutine {
  id: string;
  name: string;
  cron_expr: string;
  human_schedule: string;
  assigned_agent: string;
  last_status: string;
  enabled: boolean;
}

export interface AdaptiveProviderStatus {
  id: string;
  name: string;
  model: string;
  priority: number;
  is_last_resort: boolean;
  reliability_score: number;
  avg_latency_ms: number;
  in_cooldown: boolean;
  has_key: boolean;
  supported_tasks: string[];
}

export interface SystemStatusItem {
  name: string;
  detail: string;
  tier: 'WORKS' | 'TESTING' | 'BACKLOG';
}

export interface PillFeedbackPayload {
  label: string;
  detail?: string;
  variant?: 'success' | 'info' | 'warning' | 'error';
}

export interface ApprovalRequestPayload {
  request_id: string;
  title: string;
  reason: string;
  action: string;
}

export type WsServerEvent =
  | { type: 'GATEWAY_STATE'; payload: GatewayStatePayload }
  | { type: 'EYE_STATE'; state: EyeState; banner?: string | null }
  | { type: 'CHAT_STREAM_CHUNK'; session_id: string; chunk: string; done?: boolean; provider_used?: string }
  | { type: 'PILL_FEEDBACK'; label: string; detail?: string; variant?: 'success' | 'info' | 'warning' | 'error' }
  | { type: 'TASK_UPDATED'; task?: AgentTask }
  | { type: 'TUNNEL_LOG'; job_id: string; line: string; progress?: number; status?: TunnelStatus }
  | { type: 'APPROVAL_REQUEST'; payload: ApprovalRequestPayload }
  | { type: 'CAPTURE_SCREEN'; request_id: string }
  | { type: 'EXECUTE_INPUT'; request_id: string; action: string; norm_x: number; norm_y: number; text?: string }
  | { type: 'CHROME_DOM_ACTION'; request_id: string; action: string; selector?: string; value?: string; url?: string }
  | { type: 'FOCUS_EYE'; source?: string }
  | { type: 'VOICE_TTS_TEXT'; text: string };

export type WsClientCommand =
  | { type: 'PING' }
  | { type: 'REGISTER_NODE'; node_type: NodeTarget; name: string; client_version: string; permissions?: PairedDevice['permissions'] }
  | { type: 'EYE_STATE_SET'; state: EyeState }
  | { type: 'KILL_JOB'; job_id: string }
  | { type: 'RPA_PANIC'; reason: string }
  | { type: 'APPROVAL_RESPONSE'; request_id: string; approved: boolean }
  | { type: 'DESKTOP_ACTION_RESULT'; request_id: string; payload: Record<string, unknown> }
  | { type: 'FOCUS_EYE_REQUEST' };
