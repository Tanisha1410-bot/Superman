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

const clients = new Set<WebSocket>();

export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/updates" });

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);
    console.log(`🔌 WebSocket client connected. Active clients: ${clients.size}`);

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`❌ WebSocket client disconnected. Active clients: ${clients.size}`);
    });

    ws.on("error", (err) => {
      clients.delete(ws);
      console.error("⚠️ WebSocket client error:", err);
      console.log(`❌ WebSocket client removed on error. Active clients: ${clients.size}`);
    });
  });

  return wss;
}

export function broadcast(update: RealtimeUpdate): void {
  const message = JSON.stringify(update);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error("Failed to send message to client:", err);
      }
    }
  }
}
