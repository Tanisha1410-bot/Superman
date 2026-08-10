// These mirror corsair-service/backend/schema.sql exactly.
// If you change a column there, update the matching field here.

export type Priority = "high" | "medium" | "low";

export interface EmailItem {
  id: string;
  user_id: string | null;
  gmail_message_id: string;
  thread_id: string | null;
  sender: string; // raw "Name <email@x.com>" as Gmail sends it
  recipients: string[] | null;
  subject: string | null;
  body: string | null;
  received_at: string; // ISO timestamp
  priority: Priority;
  category: string | null;
  triage_reason: string | null;
  status: string; // e.g. 'pending_triage'
  indexed: boolean;
}

export interface CalendarEvent {
  id: string;
  user_id: string | null;
  google_event_id: string;
  title: string | null;
  description: string | null;
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  attendees: string[] | null;
  status: string | null;
  indexed: boolean;
}

export interface PendingActionItem {
  actionId: string;
  tool: string;
  args: any;
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  created_at: string;
  pending_actions?: PendingActionItem[];
}

export type RealtimeUpdate =
  | { type: "email"; data: EmailItem }
  | { type: "calendar_event"; data: CalendarEvent }
  | { type: "digest"; data: { emails: EmailItem[]; events: CalendarEvent[] } };

/** Splits Gmail's raw "Name <email@x.com>" sender string into parts. */
export function parseSender(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    const name = match[1].replace(/^"|"$/g, "").trim();
    return { name: name || match[2], email: match[2] };
  }
  return { name: raw, email: raw };
}
