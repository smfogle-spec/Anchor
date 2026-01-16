import { useEffect, useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface ScheduleUpdate {
  type: "schedule_changed" | "exception_added" | "approval_updated";
  data: any;
  timestamp: number;
}

interface UseScheduleWebSocketOptions {
  enabled?: boolean;
  onUpdate?: (update: ScheduleUpdate) => void;
}

export function useScheduleWebSocket(options: UseScheduleWebSocketOptions = {}) {
  const { enabled = true, onUpdate } = options;
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<ScheduleUpdate | null>(null);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/schedule`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.debug("[WS] Connected to schedule updates");
      };

      ws.onmessage = (event) => {
        try {
          const update: ScheduleUpdate = JSON.parse(event.data);
          setLastUpdate(update);
          
          if (update.type === "schedule_changed") {
            queryClient.invalidateQueries({ queryKey: ["/api/schedule/latest"] });
          } else if (update.type === "exception_added") {
            queryClient.invalidateQueries({ queryKey: ["/api/daily-run"] });
          } else if (update.type === "approval_updated") {
            queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
          }
          
          onUpdate?.(update);
        } catch (e) {
          console.warn("[WS] Failed to parse message:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.debug("[WS] Disconnected, attempting reconnect...");
        
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.warn("[WS] Connection error:", error);
      };
    } catch (e) {
      console.warn("[WS] Failed to create connection:", e);
    }
  }, [enabled, queryClient, onUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastUpdate,
    reconnect: connect,
    disconnect,
  };
}
