import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { queryKeys } from '../../lib/api/query-keys';
import type { LeafMessage } from '../../lib/api/contracts';
import { env } from '../../config/env';

interface UseWebSocketOptions {
  userId?: string;
  chatId?: string;
  enabled?: boolean;
  onMessage?: (message: any) => void;
}

export function useWebSocket({
  userId,
  chatId,
  enabled = true,
  onMessage,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (!enabled || !userId) {
      console.log('[WebSocket] Skipped: disabled or no userId');
      return;
    }

    intentionalCloseRef.current = false;

    const wsEndpoint = `${env.wsBaseUrl}/ws/${userId}`;

    console.log(`[WebSocket] Connecting to ${wsEndpoint}`);

    try {
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws; // seta imediatamente para evitar race condition

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        // Clear any pending reconnect attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Heartbeat: ping a cada 30s p/ manter a conexão viva (proxies/idle).
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', data);

          // Atualiza cache apenas para mensagens novas do chat atual
          if (data.type === 'new_message' && data.chat_id) {
            // Invalida histórico do chat afetado
            queryClient.invalidateQueries({
              queryKey: queryKeys.messages.byChatId(data.chat_id),
            });
            // Invalida lista de conversas (last_message atualiza)
            queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
          }

          // Presença: atualiza online/last_seen do usuário no cache
          if (data.type === 'presence' && data.user_id) {
            queryClient.setQueryData(
              ['users', 'id', data.user_id],
              (old: unknown) =>
                old && typeof old === 'object'
                  ? { ...(old as object), online: data.online, last_seen: data.last_seen ?? (old as { last_seen?: string }).last_seen }
                  : old,
            );
          }

          // Read receipts: o destinatário leu → atualiza meus ticks para ✓✓ lida
          if (data.type === 'messages_read' && data.chat_id && userId) {
            const queryKey = queryKeys.messages.byChatId(data.chat_id);
            queryClient.setQueryData<InfiniteData<LeafMessage[]>>(queryKey, (old) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page) =>
                  page.map((m) =>
                    m.sender_id === userId
                      ? { ...m, read: true, status: 'read' as const }
                      : m,
                  ),
                ),
              };
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
          }

          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        wsRef.current = null;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);

        // Não reconectar em fechamento intencional (unmount, logout, beforeunload).
        if (intentionalCloseRef.current) return;

        // Attempt to reconnect after 5 seconds
        if (enabled && userId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting to reconnect...');
            connect();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
    }
  }, [enabled, userId, chatId, queryClient, onMessage]);

  useEffect(() => {
    if (enabled && userId) {
      connect();
    }

    // beforeunload: fecha a conexão limpa → backend marca offline na hora.
    const handleUnload = () => {
      intentionalCloseRef.current = true;
      wsRef.current?.close();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      intentionalCloseRef.current = true;
      window.removeEventListener('beforeunload', handleUnload);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [enabled, userId, connect]);

  const send = useCallback(
    (message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Sending:', message);
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('[WebSocket] Connection not ready, cannot send');
      }
    },
    []
  );

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    send,
    ws: wsRef.current,
  };
}
