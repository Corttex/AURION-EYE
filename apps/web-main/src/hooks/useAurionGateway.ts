'use client';

import { useEffect, useRef } from 'react';
import type { WsServerEvent } from '@aurion/shared-protocol';
import { getEffectiveToken, getGatewayWsUrl } from '@/lib/aurionApi';
import { useAurionStore } from '@/store/useAurionStore';

export function useAurionGateway() {
  const wsRef = useRef<WebSocket | null>(null);
  const applyGatewayState = useAurionStore((s) => s.applyGatewayState);
  const refreshAll = useAurionStore((s) => s.refreshAll);
  const authRequired = useAurionStore((s) => s.authRequired);

  useEffect(() => {
    refreshAll();
    if (authRequired || !getEffectiveToken()) return;
    let closed = false;
    let retryId: number;

    const connect = () => {
      const ws = new WebSocket(getGatewayWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'REGISTER_NODE',
            node_type: 'VPS',
            name: 'Rede MAIN Web Console',
            client_version: '1.0.0',
          })
        );
      };

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data) as WsServerEvent;
          if (event.type === 'GATEWAY_STATE') {
            applyGatewayState(event.payload);
          } else if (event.type === 'TASK_UPDATED' || event.type === 'TUNNEL_LOG') {
            refreshAll();
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!closed) {
          retryId = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryId);
      wsRef.current?.close();
    };
  }, [applyGatewayState, refreshAll, authRequired]);

  const sendFocusEye = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'FOCUS_EYE_REQUEST' }));
    }
  };

  return { sendFocusEye };
}
