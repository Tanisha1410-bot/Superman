import type { CalendarEvent } from "../types";

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const time = `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${end.toLocaleTimeString(
    [],
    { hour: "numeric", minute: "2-digit" }
  )}`;
  return { day, time };
}

interface CalendarProps {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

export function Calendar({ events, loading, error }: CalendarProps) {
  if (loading) {
    return <div className="p-4 text-sm text-mist-600 font-mono">Loading calendar…</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-mist-400">{error}</div>;
  }

  if (events.length === 0) {
    return (
      <div className="p-4 text-sm text-mist-600">Nothing on the calendar right now.</div>
    );
  }

  return (
    <ul className="space-y-2 p-3">
      {events.map((event) => {
        const { day, time } = formatRange(event.start_time, event.end_time);
        return (
          <li
            key={event.id}
            className="rounded-lg border border-ink-600 bg-ink-800 p-3 transition-colors hover:border-ink-500"
          >
            <p className="font-body text-sm font-medium text-mist-50">
              {event.title || "(untitled event)"}
            </p>
            <p className="mt-0.5 font-mono text-xs text-mist-400">
              {day} · {time}
            </p>
            {event.attendees && event.attendees.length > 0 && (
              <p className="mt-1 truncate text-xs text-mist-600">
                {event.attendees.join(", ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
