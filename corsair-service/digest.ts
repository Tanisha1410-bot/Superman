import { broadcast, RealtimeUpdate, EmailItem, CalendarEvent } from "./ws";

const pendingDigests = new Map<string, { emails: EmailItem[]; events: CalendarEvent[] }>();

export function queueDigestItem(userId: string, item: RealtimeUpdate) {
  if (!pendingDigests.has(userId)) {
    pendingDigests.set(userId, { emails: [], events: [] });
  }
  const pending = pendingDigests.get(userId)!;
  if (item.type === "email") {
    pending.emails.push(item.data);
  } else if (item.type === "calendar_event") {
    pending.events.push(item.data);
  }
}

// Flush pending digest queue every 60 seconds (tunable for demo)
const DIGEST_INTERVAL_MS = 60 * 1000;

setInterval(() => {
  for (const [userId, pending] of pendingDigests.entries()) {
    if (pending.emails.length === 0 && pending.events.length === 0) {
      continue;
    }

    const emailsToFlush = [...pending.emails];
    const eventsToFlush = [...pending.events];
    
    // Clear user's queue
    pending.emails = [];
    pending.events = [];

    try {
      broadcast(userId, {
        type: "digest",
        data: {
          emails: emailsToFlush,
          events: eventsToFlush,
        },
      });
      console.log(`📦 Batched digest broadcasted for ${userId}: ${emailsToFlush.length} emails, ${eventsToFlush.length} events.`);
    } catch (err) {
      console.error(`Failed to broadcast periodic digest for ${userId}:`, err);
    }
  }
}, DIGEST_INTERVAL_MS);
