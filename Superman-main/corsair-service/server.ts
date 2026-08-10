import "dotenv/config";
import http from "http";

process.on('unhandledRejection', (reason) => {
    console.error('\n🔴 UNHANDLED REJECTION — this is likely why the server is dying:');
    console.error(reason);
});
process.on('uncaughtException', (err) => {
    console.error('\n🔴 UNCAUGHT EXCEPTION — this is likely why the server is dying:');
    console.error(err);
});
process.on('exit', (code) => {
    console.error(`\n🔴 PROCESS EXIT with code ${code} — server is shutting down now.`);
});

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { toExpressHandler } from 'corsair';
import { corsair, db } from './corsair';
import agentChatRouter from './agentChat';
import { attachWebSocketServer, broadcast } from './ws';
import { triageEmail } from './triage';
import { embedText } from './embeddings';
import { sendEmail } from './gmailSend';
import { queueDigestItem } from './digest';

const app = express();
const httpServer = http.createServer(app);
attachWebSocketServer(httpServer);

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

// Express raw body middleware specifically for webhook signature verification
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const secret = process.env.CORSAIR_DEV_SIGNING_SECRET;
        const rawBodyBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

        if (secret) {
            const signatureHeader = (req.headers['x-corsair-signature'] || req.headers['x-signature']) as string | undefined;
            if (!signatureHeader) {
                console.warn('⚠️ Webhook signature rejection: Missing x-corsair-signature header');
                return res.status(401).json({ error: 'Missing signature header' });
            }

            const computedSignature = crypto
                .createHmac('sha256', secret.trim())
                .update(rawBodyBuf)
                .digest('hex');

            const sig = signatureHeader.replace(/^sha256=/, '').trim();
            const sigBuf = Buffer.from(sig, 'utf8');
            const expectedBuf = Buffer.from(computedSignature, 'utf8');
            const isValid = sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
            if (!isValid) {
                console.warn('⚠️ Webhook signature rejection: Signature mismatch');
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
        }

        let payload: any;
        try {
            payload = JSON.parse(rawBodyBuf.toString('utf8'));
        } catch {
            return res.status(400).json({ error: 'Invalid JSON payload' });
        }

        const eventId = payload?.id || payload?.messageId || Date.now().toString();

        const existing = await db.query(
            `SELECT id FROM webhook_events WHERE payload->>'id' = $1`,
            [eventId]
        );
        if (existing.rows.length > 0) {
            return res.json({ status: 'duplicate, skipped' });
        }

        await db.query(
            `INSERT INTO webhook_events (source, payload) VALUES ($1, $2)`,
            [payload?.type || 'unknown', JSON.stringify(payload)]
        );

        if (payload?.type === 'gmail.message.received') {
            const msg = payload.data;
            const result = await db.query(
                `INSERT INTO emails 
          (gmail_message_id, thread_id, sender, subject, body, received_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (gmail_message_id) DO NOTHING
         RETURNING *`,
                [msg.id, msg.threadId, msg.from, msg.subject, msg.body || '']
            );

            if (result.rows.length > 0) {
                const insertedEmail = result.rows[0];
                try {
                    broadcast({ type: "email", data: insertedEmail });
                } catch (broadcastErr) {
                    console.error("Failed to broadcast initial email update:", broadcastErr);
                }

                // Asynchronously triage the email, update DB, and broadcast updated row
                (async () => {
                    try {
                        const triage = await triageEmail(insertedEmail.subject || '', insertedEmail.body || '');
                        const updateResult = await db.query(
                            `UPDATE emails 
                             SET priority = $1, category = $2, triage_reason = $3 
                             WHERE id = $4 
                             RETURNING *`,
                            [triage.priority, triage.category, triage.reason, insertedEmail.id]
                        );
                        if (updateResult.rows.length > 0) {
                            const updatedEmail = updateResult.rows[0];
                            if (updatedEmail.priority === 'high') {
                                broadcast({ type: "email", data: updatedEmail });
                            } else {
                                queueDigestItem({ type: "email", data: updatedEmail });
                            }
                        }
                    } catch (triageErr) {
                        console.error("Async triage error:", triageErr);
                    }
                })();

                // Asynchronously index the email embedding
                (async () => {
                    try {
                        const textToEmbed = `${insertedEmail.subject || ''}\n\n${insertedEmail.body || ''}`;
                        const vec = await embedText(textToEmbed);
                        await db.query(
                            `INSERT INTO embeddings (source_type, source_id, embedding, created_at)
                             VALUES ('email', $1, $2::vector, NOW())
                             ON CONFLICT (source_type, source_id) 
                             DO UPDATE SET embedding = EXCLUDED.embedding, created_at = NOW()`,
                            [insertedEmail.id, JSON.stringify(vec)]
                        );
                        await db.query(`UPDATE emails SET indexed = true WHERE id = $1`, [insertedEmail.id]);
                    } catch (indexErr) {
                        console.error("Failed to index email embedding:", indexErr);
                    }
                })();
            }
        }

        if (payload?.type === 'googlecalendar.event.created') {
            const event = payload.data;
            const result = await db.query(
                `INSERT INTO calendar_events 
          (google_event_id, title, description, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (google_event_id) DO NOTHING
         RETURNING *`,
                [event.id, event.summary, event.description || '',
                event.start?.dateTime, event.end?.dateTime]
            );

            if (result.rows.length > 0) {
                const insertedEvent = result.rows[0];
                try {
                    broadcast({ type: "calendar_event", data: insertedEvent });
                } catch (broadcastErr) {
                    console.error("Failed to broadcast calendar event update:", broadcastErr);
                }

                // Asynchronously index the calendar event embedding
                (async () => {
                    try {
                        const textToEmbed = `${insertedEvent.title || ''}\n\n${insertedEvent.description || ''}`;
                        const vec = await embedText(textToEmbed);
                        await db.query(
                            `INSERT INTO embeddings (source_type, source_id, embedding, created_at)
                             VALUES ('calendar_event', $1, $2::vector, NOW())
                             ON CONFLICT (source_type, source_id) 
                             DO UPDATE SET embedding = EXCLUDED.embedding, created_at = NOW()`,
                            [insertedEvent.id, JSON.stringify(vec)]
                        );
                        await db.query(`UPDATE calendar_events SET indexed = true WHERE id = $1`, [insertedEvent.id]);
                    } catch (indexErr) {
                        console.error("Failed to index calendar event embedding:", indexErr);
                    }
                })();
            }
        }

        res.json({ status: 'ok' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// JSON body parser middleware for all other routes below
app.use(express.json());

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    try {
        const dbResult = await db.query('SELECT NOW()');
        res.json({
            status: 'ok',
            db: dbResult.rows[0].now,
            message: 'Server is running!'
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── EMAILS ───────────────────────────────────────────────
app.get('/api/emails', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM emails ORDER BY received_at DESC LIMIT 50`
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── EMAIL ACTIONS ─────────────────────────────────────────
app.post('/api/emails/:id/archive', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `UPDATE emails SET status = 'archived' WHERE id = $1 RETURNING *`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Email not found' });
        }
        const updatedRow = result.rows[0];
        try {
            broadcast({ type: 'email', data: updatedRow });
        } catch (broadcastErr) {
            console.error('Failed to broadcast email archive update:', broadcastErr);
        }
        res.json(updatedRow);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/emails/:id/reply', async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req.body;
        if (!body || !body.trim()) {
            return res.status(400).json({ error: 'Reply body is required' });
        }

        const emailRes = await db.query(`SELECT * FROM emails WHERE id = $1`, [id]);
        if (emailRes.rows.length === 0) {
            return res.status(404).json({ error: 'Email not found' });
        }
        const originalEmail = emailRes.rows[0];
        const subject = originalEmail.subject?.toLowerCase().startsWith('re:')
            ? originalEmail.subject
            : `Re: ${originalEmail.subject || ''}`;

        await sendEmail({
            to: originalEmail.sender,
            subject,
            body: body.trim(),
            threadId: originalEmail.thread_id,
            inReplyTo: originalEmail.gmail_message_id,
        });

        res.json({ status: 'sent', recipient: originalEmail.sender, subject });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CALENDAR ─────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM calendar_events ORDER BY start_time ASC LIMIT 20`
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── SEARCH ───────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
    try {
        const queryStr = req.query.q as string;
        if (!queryStr || !queryStr.trim()) {
            return res.status(400).json({ error: "Query parameter 'q' is required" });
        }

        const trimmedQ = queryStr.trim();
        let queryVector: number[] = [];
        try {
            queryVector = await embedText(trimmedQ);
        } catch (embedErr) {
            console.error("Error generating query embedding:", embedErr);
        }

        // 1. Vector similarity search (pgvector cosine distance)
        let vectorEmails: any[] = [];
        let vectorEvents: any[] = [];

        if (queryVector.length > 0) {
            const vectorMatchRes = await db.query(
                `SELECT source_type, source_id, embedding <=> $1::vector AS distance
                 FROM embeddings
                 ORDER BY distance ASC
                 LIMIT 20`,
                [JSON.stringify(queryVector)]
            );

            const emailIds = vectorMatchRes.rows
                .filter((r: any) => r.source_type === 'email')
                .map((r: any) => r.source_id);

            const eventIds = vectorMatchRes.rows
                .filter((r: any) => r.source_type === 'calendar_event')
                .map((r: any) => r.source_id);

            if (emailIds.length > 0) {
                const emailsRes = await db.query(
                    `SELECT * FROM emails WHERE id = ANY($1::uuid[])`,
                    [emailIds]
                );
                vectorEmails = emailsRes.rows;
            }

            if (eventIds.length > 0) {
                const eventsRes = await db.query(
                    `SELECT * FROM calendar_events WHERE id = ANY($1::uuid[])`,
                    [eventIds]
                );
                vectorEvents = eventsRes.rows;
            }
        }

        // 2. Parallel ILIKE fallback search
        const [textEmailsRes, textEventsRes] = await Promise.all([
            db.query(
                `SELECT * FROM emails 
                 WHERE subject ILIKE '%' || $1 || '%' OR body ILIKE '%' || $1 || '%'
                 LIMIT 20`,
                [trimmedQ]
            ),
            db.query(
                `SELECT * FROM calendar_events 
                 WHERE title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%'
                 LIMIT 20`,
                [trimmedQ]
            )
        ]);

        // Merge & deduplicate emails
        const emailMap = new Map<string, any>();
        for (const item of [...vectorEmails, ...textEmailsRes.rows]) {
            emailMap.set(item.id, item);
        }

        // Merge & deduplicate calendar events
        const eventMap = new Map<string, any>();
        for (const item of [...vectorEvents, ...textEventsRes.rows]) {
            eventMap.set(item.id, item);
        }

        res.json({
            emails: Array.from(emailMap.values()),
            events: Array.from(eventMap.values()),
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AGENT CHAT ───────────────────────────────────────────
app.use('/api/agent', agentChatRouter);

// ─── CORSAIR — SABSE LAST ─────────────────────────────────
app.use('/api/corsair', toExpressHandler(corsair, { basePath: '/api/corsair' }));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});