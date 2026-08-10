import "dotenv/config";
import { db } from "./corsair";
import { corsair } from "./corsair";

function getHeader(headers: { name?: string; value?: string }[] | undefined, name: string): string {
    return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

export function mapLabelIdsToCategory(labelIds: string[] | undefined | null): string {
    if (!labelIds || labelIds.length === 0) return "INBOX";
    if (labelIds.includes("SPAM")) return "SPAM";
    if (labelIds.includes("TRASH")) return "TRASH";
    if (labelIds.includes("DRAFT")) return "DRAFT";
    if (labelIds.includes("SENT")) return "SENT";
    if (labelIds.includes("CATEGORY_PROMOTIONS")) return "CATEGORY_PROMOTIONS";
    if (labelIds.includes("CATEGORY_SOCIAL")) return "CATEGORY_SOCIAL";
    if (labelIds.includes("CATEGORY_UPDATES")) return "CATEGORY_UPDATES";
    if (labelIds.includes("CATEGORY_FORUMS")) return "CATEGORY_FORUMS";
    if (labelIds.includes("INBOX")) return "INBOX";
    return "INBOX";
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
        const category = mapLabelIdsToCategory(full?.labelIds);

        await db.query(
            `INSERT INTO emails (gmail_message_id, thread_id, sender, subject, body, received_at, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (gmail_message_id) DO UPDATE
             SET sender = EXCLUDED.sender, subject = EXCLUDED.subject, body = EXCLUDED.body, received_at = EXCLUDED.received_at, category = EXCLUDED.category`,
            [full?.id, full?.threadId, sender, subject, body, receivedAt, category]
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