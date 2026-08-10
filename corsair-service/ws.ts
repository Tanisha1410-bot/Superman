import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

export type Priority = "high" | "medium" | "low";

export interface EmailItem {
  id: string;
  user_id: string | null;
  gmail_message_id: string;
  thread_id: string | null;
  sender: string;
  recipients: string[] | null;
  subject: string | null;
  body: string | null;
  received_at: string;
  priority: Priority;
  category: string | null;
  triage_reason: string | null;
  status: string;
  indexed: boolean;
}

export interface CalendarEvent {
  id: string;
  user_id: string | null;
  google_event_id: string;
  title: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  attendees: string[] | null;
  status: string | null;
  indexed: boolean;
}

export type RealtimeUpdate =
  | { type: "email"; data: EmailItem }
  | { type: "calendar_event"; data: CalendarEvent }
  | { type: "digest"; data: { emails: EmailItem[]; events: CalendarEvent[] } };

const clients = new Map<string, Set<WebSocket>>();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift()!.trim()] = decodeURIComponent(parts.join('='));
  });
  return list;
}

export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/updates" });

  wss.on("connection", (ws: WebSocket, req) => {
    const cookies = parseCookies(req.headers.cookie);
    const userId = cookies['chrono_session'];

    if (!userId) {
      ws.close(1008, "Session required");
      return;
    }

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    const userClients = clients.get(userId)!;
    userClients.add(ws);

    console.log(`🔌 WebSocket client connected for user ${userId}. Active clients: ${userClients.size}`);

    ws.on("close", () => {
      userClients.delete(ws);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
      console.log(`❌ WebSocket client disconnected for user ${userId}. Active clients: ${userClients.size}`);
    });

    ws.on("error", (err) => {
      userClients.delete(ws);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
      console.error(`⚠️ WebSocket client error for user ${userId}:`, err);
    });
  });

  return wss;
}

export function broadcast(userId: string, update: RealtimeUpdate): void {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const message = JSON.stringify(update);
  for (const client of userClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error("Failed to send message to client:", err);
      }
    }
  }
}
