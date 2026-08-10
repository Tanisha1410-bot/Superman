import type { AgentMessage, CalendarEvent, EmailItem } from "../types";

// Your Express server (corsair-service/server.ts) listens on PORT || 3000.
// Set VITE_API_URL in frontend/.env to override.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export const WS_URL = API_URL.replace(/^http/, "ws");

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.json() as Promise<T>;
}

// GET /api/emails — server.ts returns a plain array (`res.json(result.rows)`),
// no pagination cursor yet, ordered by received_at DESC, capped at 50.
export function fetchEmails() {
  return request<EmailItem[]>("/api/emails");
}

// GET /api/events — plain array, ordered by start_time ASC, capped at 20.
export function fetchCalendarEvents() {
  return request<CalendarEvent[]>("/api/events");
}

// GET /api/health — useful for a connection-status check on load.
export function fetchHealth() {
  return request<{ status: string; db: string; message: string }>("/api/health");
}

// POST /api/agent/chat — Groq tool-calling agent with per-user conversation memory.
export function sendAgentMessage(prompt: string, userId: string) {
  return request<{ reply: AgentMessage; pending_actions?: { actionId: string; tool: string; args: any }[] }>("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ prompt, user_id: userId }),
  });
}

export function cancelAgentAction(actionId: string) {
  return request<{ status: string; tool: string }>(`/api/agent/cancel/${actionId}`, {
    method: "POST",
  });
}

// POST /api/emails/:id/archive — sets status='archived' on email
export function archiveEmail(id: string) {
  return request<EmailItem>(`/api/emails/${id}/archive`, {
    method: "POST",
  });
}

// POST /api/emails/:id/reply — sends reply via Gmail API
export function replyEmail(id: string, body: string) {
  return request<{ status: string; recipient: string; subject: string }>(`/api/emails/${id}/reply`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// GET /api/search — returns vector + text search results for emails and events.
export function searchGlobal(query: string) {
  const qs = `?q=${encodeURIComponent(query)}`;
  return request<{ emails: EmailItem[]; events: CalendarEvent[] }>(`/api/search${qs}`);
}

export function search(query: string) {
  return searchGlobal(query);
}

// Realtime: ws.ts mounts a WebSocket server at /ws/updates and broadcasts
// email/calendar_event/digest updates. See hooks/useWebSocket.ts.

