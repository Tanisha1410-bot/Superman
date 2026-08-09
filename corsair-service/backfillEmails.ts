import "dotenv/config";
import { db } from "./corsair";
import { corsair } from "./corsair";

function getHeader(headers: { name?: string; value?: string }[] | undefined, name: string): string {
    return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

async function main() {
    const maxResults = Number(process.argv[2]) || 20;

    console.log(`Fetching latest ${maxResults} messages from the currently connected Gmail account...`);

    const list = await (corsair as any).gmail.api.messages.list({ maxResults });
    const messages = list?.messages || [];

    if (messages.length === 0) {
        console.log("No messages returned. Double check the account is connected and has mail.");
        return;
    }

    console.log(`Got ${messages.length} message IDs. Fetching full details and inserting...\n`);

    let inserted = 0;
    for (const m of messages) {
        if (!m.id) continue;

        const full = await (corsair as any).gmail.api.messages.get({ id: m.id, format: "full" });
        const headers = full?.payload?.headers;

        const sender = getHeader(headers, "From");
        const subject = getHeader(headers, "Subject");
        const dateHeader = getHeader(headers, "Date");
        const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
        const body = full?.snippet || "";

        await db.query(
            `INSERT INTO emails (gmail_message_id, thread_id, sender, subject, body, received_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (gmail_message_id) DO UPDATE
             SET sender = EXCLUDED.sender, subject = EXCLUDED.subject, body = EXCLUDED.body, received_at = EXCLUDED.received_at`,
            [full?.id, full?.threadId, sender, subject, body, receivedAt]
        );
        inserted++;
        console.log(`  saved: ${subject || "(no subject)"} — from ${sender}`);
    }

    console.log(`\nDone. ${inserted} messages upserted into the emails table.`);
}

main()
    .catch((err) => {
        console.error("Backfill failed:", err);
        process.exit(1);
    })
    .finally(() => process.exit(0));