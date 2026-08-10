import { useCallback, useEffect, useState } from "react";
import { archiveEmail, fetchCalendarEvents, fetchEmails, replyEmail, fetchAuthStatus, API_URL } from "./api/client";
import { useWebSocket } from "./hooks/useWebSocket";
import { useHotkeys } from "./hooks/useHotkeys";
import { Inbox } from "./views/Inbox";
import { Calendar } from "./views/Calendar";
import { AgentBar } from "./views/AgentBar";
import { Search } from "./views/Search";
import { ShortcutsModal } from "./views/ShortcutsModal";
import { Kbd } from "./components/Kbd";
import { Landing } from "./views/Landing";
import { HelpCircle } from "lucide-react";
import type { CalendarEvent, EmailItem } from "./types";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [replyingEmailId, setReplyingEmailId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySending, setReplySending] = useState(false);

  const handleUndo = useCallback(() => {
    // Global undo handler
  }, []);

  useEffect(() => {
    fetchAuthStatus().then((status) => {
      if (status.connected && status.userId) {
        setUserId(status.userId);
        setShowLanding(false);
      } else {
        setEmailsLoading(false);
        setEventsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (showLanding) return;

    // /api/emails returns { emails, hasMore, nextCursor, counts }
    fetchEmails()
      .then((res) => setEmails(res.emails))
      .catch((err) => setEmailsError(String(err)))
      .finally(() => setEmailsLoading(false));

    fetchCalendarEvents()
      .then(setEvents)
      .catch((err) => setEventsError(String(err)))
      .finally(() => setEventsLoading(false));
  }, [showLanding]);

  // Realtime push via Corsair webhooks -> ws.ts broadcast -> here.
  const wsState = useWebSocket(
    useCallback((update) => {
      if (update.type === "email") {
        setEmails((prev) => [update.data, ...prev.filter((e) => e.id !== update.data.id)]);
      } else if (update.type === "calendar_event") {
        setEvents((prev) => [update.data, ...prev.filter((e) => e.id !== update.data.id)]);
      } else if (update.type === "digest") {
        if (update.data.emails && update.data.emails.length > 0) {
          setEmails((prev) => {
            const incomingIds = new Set(update.data.emails.map((e) => e.id));
            return [...update.data.emails, ...prev.filter((e) => !incomingIds.has(e.id))];
          });
        }
        if (update.data.events && update.data.events.length > 0) {
          setEvents((prev) => {
            const incomingIds = new Set(update.data.events.map((e) => e.id));
            return [...update.data.events, ...prev.filter((e) => !incomingIds.has(e.id))];
          });
        }
      }
    }, [])
  );

  const handleArchiveSelected = useCallback(async () => {
    if (!selectedEmailId || agentOpen || searchOpen || shortcutsOpen || replyingEmailId) return;
    const targetId = selectedEmailId;
    setEmails((prev) => prev.filter((e) => e.id !== targetId));
    setSelectedEmailId(null);
    try {
      await archiveEmail(targetId);
    } catch (err) {
      console.error("Failed to archive email:", err);
    }
  }, [selectedEmailId, agentOpen, searchOpen, shortcutsOpen, replyingEmailId]);

  const handleOpenReply = useCallback(() => {
    if (!selectedEmailId || agentOpen || searchOpen || shortcutsOpen) return;
    setReplyingEmailId(selectedEmailId);
    setReplyBody("");
  }, [selectedEmailId, agentOpen, searchOpen, shortcutsOpen]);

  const handleSendReply = useCallback(async () => {
    if (!replyingEmailId || !replyBody.trim() || replySending) return;
    setReplySending(true);
    try {
      await replyEmail(replyingEmailId, replyBody.trim());
      setReplyingEmailId(null);
      setReplyBody("");
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setReplySending(false);
    }
  }, [replyingEmailId, replyBody, replySending]);

  useHotkeys([
    { key: "k", meta: true, handler: () => setAgentOpen(true) },
    { key: "/", handler: () => setSearchOpen(true) },
    { key: "?", handler: () => setShortcutsOpen((prev) => !prev) },
    { key: "z", meta: true, handler: handleUndo },
    { key: "e", handler: handleArchiveSelected },
    { key: "r", handler: handleOpenReply },
    {
      key: "Escape",
      allowInFormFields: true,
      handler: () => {
        if (replyingEmailId) {
          setReplyingEmailId(null);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        } else if (searchOpen) {
          setSearchOpen(false);
        } else if (agentOpen) {
          setAgentOpen(false);
        }
      },
    },
  ]);

  if (showLanding) {
    return <Landing onConnect={() => window.location.href = `${API_URL}/api/auth/connect`} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold text-mist-50">Chrono</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              wsState === "open" ? "bg-moss-400" : "bg-amber-400"
            }`}
            title={wsState === "open" ? "Realtime connected" : "Realtime connecting..."}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShortcutsOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5
                       text-sm text-mist-400 transition-colors hover:border-ink-500 hover:text-mist-50"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="h-4 w-4" />
            Shortcuts
            <Kbd keys={["?"]} />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5
                       text-sm text-mist-400 transition-colors hover:border-ink-500 hover:text-mist-50"
          >
            Search
            <Kbd keys={["/"]} />
          </button>
          <button
            onClick={() => setAgentOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5
                       text-sm text-mist-400 transition-colors hover:border-ink-500 hover:text-mist-50"
          >
            Ask the agent
            <Kbd keys={["⌘", "K"]} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto border-r border-ink-700">
          <Inbox
            emails={emails}
            loading={emailsLoading}
            error={emailsError}
            selectedId={selectedEmailId}
            onSelect={setSelectedEmailId}
            replyingId={replyingEmailId}
            replyBody={replyBody}
            onReplyBodyChange={setReplyBody}
            onSendReply={handleSendReply}
            onCancelReply={() => setReplyingEmailId(null)}
            replySending={replySending}
          />
        </main>
        <aside className="w-80 shrink-0 overflow-y-auto">
          <Calendar events={events} loading={eventsLoading} error={eventsError} />
        </aside>
      </div>

      <Search open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <AgentBar
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        userId={userId || ""}
      />
    </div>
  );
}

