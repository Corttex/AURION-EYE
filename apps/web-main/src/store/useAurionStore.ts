import { create } from 'zustand';
import type {
  AdaptiveProviderStatus,
  AgentTask,
  ConnectorSecretView,
  CronRoutine,
  EmailDraft,
  EyeState,
  GatewayStatus,
  Note,
  PairedDevice,
  SystemStatusItem,
  TunnelJob,
  WebMainRouteId,
} from '@aurion/shared-protocol';
import { AurionAuthError, vpsFetch } from '@/lib/aurionApi';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

interface AurionStore {
  activeRoute: WebMainRouteId;
  activeProfile: string;
  selectedNodeId: string;
  gatewayStatus: GatewayStatus;
  eyeState: EyeState;
  activeSessions: number;
  activeTunnelsCount: number;
  authRequired: boolean;
  tasks: AgentTask[];
  tunnels: TunnelJob[];
  logs: LogEntry[];
  cronJobs: CronRoutine[];
  secrets: ConnectorSecretView[];
  emails: EmailDraft[];
  notes: Note[];
  devices: PairedDevice[];
  providers: AdaptiveProviderStatus[];
  statusMatrix: SystemStatusItem[];
  setActiveRoute: (route: WebMainRouteId) => void;
  setActiveProfile: (profile: string) => void;
  setSelectedNodeId: (nodeId: string) => void;
  setAuthRequired: (required: boolean) => void;
  applyGatewayState: (payload: {
    eye_state: EyeState;
    active_tunnels_count: number;
    gateway_status: GatewayStatus;
    active_sessions: number;
  }) => void;
  refreshAll: () => Promise<void>;
}

export const useAurionStore = create<AurionStore>((set) => ({
  activeRoute: 'dashquadro',
  activeProfile: 'admin_root',
  selectedNodeId: 'vps_main',
  gatewayStatus: 'ATIVO',
  eyeState: 'IDLE',
  activeSessions: 1,
  activeTunnelsCount: 0,
  authRequired: false,
  tasks: [],
  tunnels: [],
  logs: [],
  cronJobs: [],
  secrets: [],
  emails: [],
  notes: [],
  devices: [],
  providers: [],
  statusMatrix: [],
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setActiveProfile: (activeProfile) => set({ activeProfile }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setAuthRequired: (authRequired) => set({ authRequired }),
  applyGatewayState: (p) =>
    set({
      eyeState: p.eye_state,
      activeTunnelsCount: p.active_tunnels_count,
      gatewayStatus: p.gateway_status,
      activeSessions: p.active_sessions,
    }),
  refreshAll: async () => {
    try {
      const [tasks, tunnels, logs, cronJobs, secrets, emails, notes, devices, sys] = await Promise.all([
        vpsFetch<AgentTask[]>('/api/tasks'),
        vpsFetch<TunnelJob[]>('/api/tunnels'),
        vpsFetch<LogEntry[]>('/api/logs'),
        vpsFetch<CronRoutine[]>('/api/cron'),
        vpsFetch<ConnectorSecretView[]>('/api/vault'),
        vpsFetch<EmailDraft[]>('/api/emails'),
        vpsFetch<Note[]>('/api/notes'),
        vpsFetch<PairedDevice[]>('/api/devices'),
        vpsFetch<{ providers: AdaptiveProviderStatus[]; matrix: SystemStatusItem[] }>('/api/system/status'),
      ]);
      set({
        authRequired: false,
        tasks,
        tunnels,
        logs,
        cronJobs,
        secrets,
        emails,
        notes,
        devices,
        providers: sys.providers,
        statusMatrix: sys.matrix,
      });
    } catch (err) {
      if (err instanceof AurionAuthError) {
        set({ authRequired: true });
      }
    }
  },
}));
