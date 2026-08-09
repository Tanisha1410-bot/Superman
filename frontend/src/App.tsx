import { useCallback, useEffect, useState } from "react";
import { fetchCalendarEvents, fetchEmails } from "./api/client";
import { useWebSocket } from "./hooks/useWebSocket";
import { useHotkeys } from "./hooks/useHotkeys";
import { Inbox } from "./views/Inbox";
import { Calendar } from "./views/Calendar";
import { AgentBar } from "./views/AgentBar";
import { Kbd } from "./components/Kbd";
import type { CalendarEvent, EmailItem } from "./types";

// Swap for your real auth/session value once Corsair OAuth is wired in.
// Swap for your real auth/session value once Corsair OAuth is wired in.
const USER_ID = "11111111-1111-1111-1111-111111111111";

export default function App() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);

  useEffect(() => {
    // /api/emails and /api/events return plain arrays (see server.ts)
    fetchEmails()
      .then(setEmails)
      .catch((err) => setEmailsError(String(err)))
      .finally(() => setEmailsLoading(false));

    fetchCalendarEvents()
      .then(setEvents)
      .catch((err) => setEventsError(String(err)))
      .finally(() => setEventsLoading(false));
  }, []);

  // Realtime push — not live yet. server.ts has POST /api/webhook writing to
  // Postgres but no WebSocket server broadcasting from it. This hook will
  // keep retrying harmlessly in the background until that exists; add a
  // `ws` server in corsair-service and broadcast on webhook insert to light
  // this up.
  const wsState = useWebSocket(
    useCallback((update) => {
      if (update.type === "email") {
        setEmails((prev) => [update.data, ...prev.filter((e) => e.id !== update.data.id)]);
      } else if (update.type === "calendar_event") {
        setEvents((prev) => [update.data, ...prev.filter((e) => e.id !== update.data.id)]);
      }
    }, [])
  );

  useHotkeys([
    { key: "k", meta: true, handler: () => setAgentOpen(true) },
    { key: "Escape", allowInFormFields: true, handler: () => setAgentOpen(false) },
  ]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold text-mist-50">Corsair</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${wsState === "open" ? "bg-moss-400" : "bg-amber-400"
              }`}
            title={wsState === "open" ? "Realtime connected" : "Realtime not wired up yet"}
          />
        </div>
        <button
          onClick={() => setAgentOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5
                     text-sm text-mist-400 transition-colors hover:border-ink-500 hover:text-mist-50"
        >
          Ask the agent
          <Kbd keys={["⌘", "K"]} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto border-r border-ink-700">
          <Inbox
            emails={emails}
            loading={emailsLoading}
            error={emailsError}
            selectedId={selectedEmailId}
            onSelect={setSelectedEmailId}
          />
        </main>
        <aside className="w-80 shrink-0 overflow-y-auto">
          <Calendar events={events} loading={eventsLoading} error={eventsError} />
        </aside>
      </div>

      <AgentBar open={agentOpen} onClose={() => setAgentOpen(false)} userId={USER_ID} />
    </div>
  );
}
