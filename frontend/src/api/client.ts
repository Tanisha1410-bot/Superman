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

export interface FetchEmailsResponse {
  emails: EmailItem[];
  hasMore: boolean;
  nextCursor: string | null;
  counts: Record<string, number>;
}

// GET /api/emails — server.ts supports category filter, cursor pagination, and counts.
export async function fetchEmails(category?: string, before?: string, limit = 50): Promise<FetchEmailsResponse> {
  const params = new URLSearchParams();
  if (category && category !== "ALL") params.append("category", category);
  if (before) params.append("before", before);
  if (limit) params.append("limit", String(limit));

  const qs = params.toString();
  const path = `/api/emails${qs ? `?${qs}` : ""}`;
  
  const raw = await request<FetchEmailsResponse | EmailItem[]>(path);
  if (Array.isArray(raw)) {
    return {
      emails: raw,
      hasMore: false,
      nextCursor: null,
      counts: {},
    };
  }
  return raw;
}

// GET /api/events — plain array, ordered by start_time ASC, capped at 20.
export function fetchCalendarEvents() {
  return request<CalendarEvent[]>("/api/events");
}

// GET /api/health — useful for a connection-status check on load.
export function fetchHealth() {
  return request<{ status: string; db: string; message: string }>("/api/health");
}

export interface AuthStatusResponse {
  connected: boolean;
  userId?: string;
  gmailConnected?: boolean;
  calendarConnected?: boolean;
}

export function fetchAuthStatus() {
  return request<AuthStatusResponse>("/api/auth/status");
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

export function confirmAgentAction(actionId: string) {
  return request<{ status: string; result: any; tool: string }>(`/api/agent/confirm/${actionId}`, {
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

export async function summarizeEmail(id: string): Promise<{ 
  summary: { decided: string; open: string; owner: string } 
}> {
  return request(`/api/emails/${id}/summarize`, { method: "POST" });
}

// GET /api/contacts — returns known contacts from KNOWN_CONTACTS env var
export interface Contact {
  name: string;
  email: string;
}

export function fetchContacts() {
  return request<{ contacts: Contact[] }>("/api/contacts");
}

// Realtime: ws.ts mounts a WebSocket server at /ws/updates and broadcasts
// email/calendar_event/digest updates. See hooks/useWebSocket.ts.

