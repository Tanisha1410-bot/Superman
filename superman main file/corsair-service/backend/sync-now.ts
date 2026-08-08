// backend/sync-now.ts
//
// One-off manual sync: pulls recent Gmail messages and upcoming
// Calendar events via Corsair's typed API, and inserts them into
// the emails / calendar_events tables directly.
//
// Run from corsair-service/:  npx tsx backend/sync-now.ts

import "dotenv/config";
import { corsair, db } from "../corsair";

function decodeHeader(headers: { name: string; value: string }[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function syncEmails() {
  console.log("📥 Fetching recent Gmail messages...");
  const list = await corsair.gmail.api.messages.list({ maxResults: 10 });
  const messages = list.messages ?? [];

  if (messages.length === 0) {
    console.log("   No messages found.");
    return;
  }

  for (const m of messages) {
    if (!m.id) continue;
    try {
      const full = await corsair.gmail.api.messages.get({ id: m.id });
      const headers = full.payload?.headers;

      const sender = decodeHeader(headers, "From");
      const subject = decodeHeader(headers, "Subject");
      const receivedAt = full.internalDate
        ? new Date(Number(full.internalDate))
        : new Date();

      await db.query(
        `INSERT INTO emails (gmail_message_id, thread_id, sender, subject, body, received_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (gmail_message_id) DO NOTHING`,
        [full.id, full.threadId, sender, subject, full.snippet ?? "", receivedAt]
      );
      console.log(`   ✅ ${subject || "(no subject)"}`);
    } catch (err: any) {
      console.log(`   ⚠️ Skipped one message: ${err.message}`);
    }
  }
}

async function syncCalendar() {
  console.log("📅 Fetching upcoming Calendar events...");
  const result = await corsair.googlecalendar.api.events.getMany({
    calendarId: "primary",
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
  });
  const events = result.items ?? [];

  if (events.length === 0) {
    console.log("   No upcoming events found.");
    return;
  }

  for (const e of events) {
    if (!e.id) continue;
    try {
      const start = e.start?.dateTime ?? e.start?.date;
      const end = e.end?.dateTime ?? e.end?.date;

      await db.query(
        `INSERT INTO calendar_events (google_event_id, title, description, start_time, end_time, attendees)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (google_event_id) DO NOTHING`,
        [
          e.id,
          e.summary ?? "",
          e.description ?? "",
          start,
          end,
          (e.attendees ?? []).map((a: any) => a.email).filter(Boolean),
        ]
      );
      console.log(`   ✅ ${e.summary || "(untitled event)"}`);
    } catch (err: any) {
      console.log(`   ⚠️ Skipped one event: ${err.message}`);
    }
  }
}

async function main() {
  await syncEmails();
  await syncCalendar();
  console.log("🎉 Sync complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Sync failed:", err.message);
  process.exit(1);
});
