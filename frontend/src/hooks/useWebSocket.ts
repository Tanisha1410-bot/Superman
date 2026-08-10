import { useEffect, useRef, useState } from "react";
import { WS_URL } from "../api/client";
import type { RealtimeUpdate } from "../types";

type ConnectionState = "connecting" | "open" | "closed";

/**
 * Connects to the backend's realtime channel and hands each parsed
 * update to onUpdate. This is what replaces polling: new mail/events
 * pushed by Corsair webhooks land here the moment the backend receives
 * and rebroadcasts them.
 */
export function useWebSocket(onUpdate: (update: RealtimeUpdate) => void) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      setState("connecting");
      socket = new WebSocket(`${WS_URL}/ws/updates`);

      socket.onopen = () => setState("open");

      socket.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as RealtimeUpdate;
          onUpdateRef.current(update);
        } catch {
          // ignore malformed frames rather than crashing the socket loop
        }
      };

      socket.onclose = () => {
        setState("closed");
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return state;
}
