import "dotenv/config";
import { db } from "./corsair";
import { embedText } from "./embeddings";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("Starting backfill for unindexed emails and calendar events...");

  // Select all unindexed emails
  const unindexedEmailsRes = await db.query(`SELECT id, subject, body FROM emails WHERE indexed = false OR indexed IS NULL`);
  const unindexedEmails = unindexedEmailsRes.rows;

  // Select all unindexed calendar events
  const unindexedEventsRes = await db.query(`SELECT id, title, description FROM calendar_events WHERE indexed = false OR indexed IS NULL`);
  const unindexedEvents = unindexedEventsRes.rows;

  console.log(`Found ${unindexedEmails.length} unindexed emails and ${unindexedEvents.length} unindexed calendar events.`);

  let emailSuccess = 0;
  let emailFail = 0;

  for (let i = 0; i < unindexedEmails.length; i++) {
    const email = unindexedEmails[i];
    const textToEmbed = `${email.subject || ""}\n\n${email.body || ""}`;

    try {
      const vec = await embedText(textToEmbed);
      await db.query(
        `INSERT INTO embeddings (source_type, source_id, embedding, created_at)
         VALUES ('email', $1, $2::vector, NOW())
         ON CONFLICT (source_type, source_id)
         DO UPDATE SET embedding = EXCLUDED.embedding, created_at = NOW()`,
        [email.id, JSON.stringify(vec)]
      );
      await db.query(`UPDATE emails SET indexed = true WHERE id = $1`, [email.id]);
      emailSuccess++;
      console.log(`Embedded email ${i + 1}/${unindexedEmails.length} (ID: ${email.id})`);
    } catch (err: any) {
      emailFail++;
      console.error(`Failed to embed email ID ${email.id}:`, err?.message || err);
    }

    // 200ms delay to stay well under Gemini free tier rate limits (15 RPM / 1500 RPD)
    await delay(200);
  }

  let eventSuccess = 0;
  let eventFail = 0;

  for (let i = 0; i < unindexedEvents.length; i++) {
    const event = unindexedEvents[i];
    const textToEmbed = `${event.title || ""}\n\n${event.description || ""}`;

    try {
      const vec = await embedText(textToEmbed);
      await db.query(
        `INSERT INTO embeddings (source_type, source_id, embedding, created_at)
         VALUES ('calendar_event', $1, $2::vector, NOW())
         ON CONFLICT (source_type, source_id)
         DO UPDATE SET embedding = EXCLUDED.embedding, created_at = NOW()`,
        [event.id, JSON.stringify(vec)]
      );
      await db.query(`UPDATE calendar_events SET indexed = true WHERE id = $1`, [event.id]);
      eventSuccess++;
      console.log(`Embedded event ${i + 1}/${unindexedEvents.length} (ID: ${event.id})`);
    } catch (err: any) {
      eventFail++;
      console.error(`Failed to embed event ID ${event.id}:`, err?.message || err);
    }

    await delay(200);
  }

  console.log("\n================ BACKFILL SUMMARY ================");
  console.log(`Emails:          ${emailSuccess} succeeded, ${emailFail} failed`);
  console.log(`Calendar Events: ${eventSuccess} succeeded, ${eventFail} failed`);
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("Backfill embeddings process error:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
