import { parseSender, type EmailItem } from "../types";
import { PriorityDot } from "../components/PriorityDot";
import { Kbd } from "../components/Kbd";

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function snippetFrom(body: string | null, max = 90) {
  if (!body) return "";
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

interface InboxProps {
  emails: EmailItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Inbox({ emails, loading, error, selectedId, onSelect }: InboxProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-mist-600 font-mono text-sm">
        Loading inbox…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-mist-50 font-medium">Couldn't load your inbox</p>
        <p className="text-mist-400 text-sm max-w-xs">{error}</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <p className="text-mist-50 font-medium">Nothing here yet</p>
        <p className="text-mist-400 text-sm">New mail will appear once webhooks start flowing.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-700">
      {emails.map((email) => {
        const isSelected = email.id === selectedId;
        const { name } = parseSender(email.sender);
        return (
          <li key={email.id}>
            <button
              onClick={() => onSelect(email.id)}
              className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                ${isSelected ? "bg-ink-700" : "hover:bg-ink-800"}`}
            >
              <PriorityDot priority={email.priority} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-body text-sm font-semibold text-mist-50">
                    {name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-mist-600">
                    {formatTime(email.received_at)}
                  </span>
                </div>
                <p className="truncate text-sm text-mist-50">{email.subject || "(no subject)"}</p>
                <p className="truncate text-xs text-mist-600">{snippetFrom(email.body)}</p>
              </div>
              <div className="hidden shrink-0 items-center gap-1 self-center group-hover:flex">
                <Kbd keys={["E"]} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
