import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/api/query-keys';
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

  const connect = useCallback(() => {
    if (!enabled || !userId) {
      console.log('[WebSocket] Skipped: disabled or no userId');
      return;
    }

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

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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
