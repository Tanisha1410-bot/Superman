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

// ⚠️ NOT YET IMPLEMENTED in corsair-service/server.ts.
// The route doesn't exist on the backend yet — this will 404 until you
// add `app.post('/api/agent/chat', ...)` wired to Groq + the Corsair MCP
// client, per playbook §8/§13 (Hours 8–14). Kept here so the frontend
// is ready the moment it exists.
export function sendAgentMessage(prompt: string, userId: string) {
  return request<{ reply: AgentMessage }>("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ prompt, user_id: userId }),
  });
}

// ⚠️ NOT YET IMPLEMENTED — no /api/search route in server.ts yet.
export function search(query: string) {
  const qs = `?q=${encodeURIComponent(query)}`;
  return request<{ emails: EmailItem[]; events: CalendarEvent[] }>(`/api/search${qs}`);
}

// ⚠️ NOT YET IMPLEMENTED — server.ts has no WebSocket server mounted yet,
// only POST /api/webhook (which writes to Postgres but doesn't push to
// clients). useWebSocket.ts will retry this and simply stay "closed"
// until you add a `ws` server and broadcast on webhook insert.
