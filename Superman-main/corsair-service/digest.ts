import { broadcast, RealtimeUpdate, EmailItem, CalendarEvent } from "./ws";

let pendingDigestEmails: EmailItem[] = [];
let pendingDigestEvents: CalendarEvent[] = [];

export function queueDigestItem(item: RealtimeUpdate) {
  if (item.type === "email") {
    pendingDigestEmails.push(item.data);
  } else if (item.type === "calendar_event") {
    pendingDigestEvents.push(item.data);
  }
}

// Flush pending digest queue every 60 seconds (tunable for demo)
const DIGEST_INTERVAL_MS = 60 * 1000;

setInterval(() => {
  if (pendingDigestEmails.length === 0 && pendingDigestEvents.length === 0) {
    return;
  }

  const emailsToFlush = [...pendingDigestEmails];
  const eventsToFlush = [...pendingDigestEvents];
  pendingDigestEmails = [];
  pendingDigestEvents = [];

  try {
    broadcast({
      type: "digest",
      data: {
        emails: emailsToFlush,
        events: eventsToFlush,
      },
    });
    console.log(`📦 Batched digest broadcasted: ${emailsToFlush.length} emails, ${eventsToFlush.length} events.`);
  } catch (err) {
    console.error("Failed to broadcast periodic digest:", err);
  }
}, DIGEST_INTERVAL_MS);
