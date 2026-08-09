import { useEffect, useRef, useState } from "react";
import { searchGlobal } from "../api/client";
import type { CalendarEvent, EmailItem } from "../types";
import { Kbd } from "../components/Kbd";

interface SearchProps {
  open: boolean;
  onClose: () => void;
}

export function Search({ open, onClose }: SearchProps) {
  const [query, setQuery] = useState("");
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery("");
      setEmails([]);
      setEvents([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setEmails([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      searchGlobal(trimmed)
        .then((res) => {
          setEmails(res.emails || []);
          setEvents(res.events || []);
        })
        .catch((err) => {
          setError(err?.message || "Search failed");
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 pt-20"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <span className="font-mono text-mist-400">/</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emails and events (semantic + text)..."
            className="flex-1 bg-transparent font-sans text-sm text-mist-50 placeholder:text-mist-600 focus:outline-none"
          />
          {loading && <span className="text-xs text-mist-400 animate-pulse">Searching...</span>}
          <Kbd keys={["esc"]} />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {error && <p className="text-sm text-amber-400">{error}</p>}

          {!loading && query.trim() && emails.length === 0 && events.length === 0 && (
            <p className="text-sm text-mist-400">No matching emails or events found.</p>
          )}

          {emails.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-400 mb-2">
                Emails ({emails.length})
              </h3>
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="rounded-lg border border-ink-700 bg-ink-900/60 p-3 hover:border-ink-600 transition-colors"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-mist-50">{email.subject || "(No subject)"}</span>
                      <span className="text-xs text-mist-400">{email.sender}</span>
                    </div>
                    {email.body && (
                      <p className="mt-1 text-xs text-mist-300 line-clamp-2">{email.body}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-400 mb-2">
                Calendar Events ({events.length})
              </h3>
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-ink-700 bg-ink-900/60 p-3 hover:border-ink-600 transition-colors"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-mist-50">{event.title || "(No title)"}</span>
                      <span className="text-xs text-cobalt-400">
                        {new Date(event.start_time).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-1 text-xs text-mist-300 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
