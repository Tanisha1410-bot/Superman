import "dotenv/config";
<<<<<<< HEAD
import http from "http";
=======
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961

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
<<<<<<< HEAD
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

=======
import { toExpressHandler } from 'corsair';
import { corsair, db } from './corsair';
import agentChatRouter from './agentChat';

const app = express();
app.use(express.json());
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

<<<<<<< HEAD
// Extend Express Request interface to support req.userId
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        list[parts.shift()!.trim()] = decodeURIComponent(parts.join('='));
    });
    return list;
}

// Session middleware to resolve or create a chrono_session user ID
app.use((req: any, res: any, next: any) => {
    if (req.path === '/api/webhook' || req.path.startsWith('/api/corsair')) {
        return next();
    }
    const cookies = parseCookies(req.headers.cookie);
    let userId = cookies['chrono_session'];

    const handleNewSession = async () => {
        userId = crypto.randomUUID();
        try {
            await db.query(
                `INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`,
                [userId]
            );
        } catch (err) {
            console.error('Failed to insert user:', err);
        }
        res.cookie('chrono_session', userId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
        req.userId = userId;
        next();
    };

    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        handleNewSession();
    } else {
        (async () => {
            try {
                await db.query(
                    `INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`,
                    [userId]
                );
            } catch (err) {
                console.error('Failed to ensure user exists:', err);
            }
            req.userId = userId;
            next();
        })();
    }
});

// GET /api/auth/connect — creates a connect link and redirects to it
app.get('/api/auth/connect', async (req, res) => {
    try {
        const tenantId = req.userId;
        if (!tenantId) {
            return res.status(400).json({ error: 'Session not initialized' });
        }
        const { connectUrl } = await corsair.manage.connect.createLink({
            tenantId,
        });

        // 🔍 DIAGNOSTIC: Log the full connectUrl and extract the redirect_uri
        console.log('\n========== /api/auth/connect DIAGNOSTIC ==========');
        console.log('connectUrl (Corsair hub URL):', connectUrl);
        try {
            const parsed = new URL(connectUrl);
            const dToken = parsed.searchParams.get('d');
            if (dToken) {
                const base64Part = dToken.includes('.') ? dToken.split('.')[0] : dToken;
                const decoded = JSON.parse(Buffer.from(base64Part, 'base64url').toString('utf-8'));
                console.log('Decoded token payload:', JSON.stringify(decoded, null, 2));
                if (decoded.oauthUrl) {
                    const oauthParsed = new URL(decoded.oauthUrl);
                    console.log('→ redirect_uri sent to Google:', oauthParsed.searchParams.get('redirect_uri'));
                }
                if (decoded.deliveryUrl) {
                    console.log('→ Corsair delivery URL (where tokens land):', decoded.deliveryUrl);
                }
            }
        } catch (parseErr) {
            console.log('(Could not decode token — Corsair hub mode uses server-side delivery, no embedded redirect_uri in URL)');
        }
        console.log('====================================================\n');

        res.redirect(connectUrl);
    } catch (err: any) {
        console.error('Failed to create connect link:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/connect/:tenantId — creates a gmail connect link for a specific tenant and redirects
app.get('/api/connect/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { connectUrl } = await corsair.manage.connect.createLink({
            plugin: 'gmail',
            tenantId,
        });
        res.redirect(connectUrl);
    } catch (err: any) {
        console.error('Failed to create connect link for gmail:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/connect-calendar/:tenantId — creates a googlecalendar connect link for a specific tenant and redirects
app.get('/api/connect-calendar/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { connectUrl } = await corsair.manage.connect.createLink({
            plugin: 'googlecalendar',
            tenantId,
        });
        res.redirect(connectUrl);
    } catch (err: any) {
        console.error('Failed to create connect link for googlecalendar:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/status — checks current user's connection status
app.get('/api/auth/status', async (req, res) => {
    try {
        const tenantId = req.userId;
        if (!tenantId) {
            return res.json({ connected: false });
        }
        const statusMap = await corsair.manage.connectionStatus.get({ tenantId });
        const gmailConnected = statusMap['gmail'] === 'connected';
        const calendarConnected = statusMap['googlecalendar'] === 'connected';
        res.json({
            userId: tenantId,
            connected: gmailConnected && calendarConnected,
            gmailConnected,
            calendarConnected
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

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
        } catch (jsonErr: any) {
            console.error('⚠️ Webhook payload JSON parse error:', jsonErr.message);
            return res.status(400).json({ error: 'Invalid JSON payload' });
        }

        const eventId = payload?.id || payload?.messageId || Date.now().toString();
        const tenantId = payload?.tenantId;

        const existing = await db.query(
            `SELECT id FROM webhook_events WHERE payload->>'id' = $1`,
            [eventId]
        );
        if (existing.rows.length > 0) {
            return res.json({ status: 'duplicate, skipped' });
        }

        const insertedEventRes = await db.query(
            `INSERT INTO webhook_events (source, payload, processed) VALUES ($1, $2, FALSE) RETURNING id`,
            [payload?.type || 'unknown', JSON.stringify(payload)]
        );
        const webhookEventDbId = insertedEventRes.rows[0]?.id;

        let handled = false;

        if (payload?.type === 'gmail.message.received') {
            handled = true;
            const msg = payload.data;
            let category = msg?.labelIds ? mapLabelIdsToCategory(msg.labelIds) : 'INBOX';

            // If labelIds not in payload, fetch message details via Gmail API if available
            if (!msg?.labelIds && msg?.id && (corsair as any)?.gmail?.api) {
                try {
                    const full = await (corsair as any).gmail.api.messages.get({ id: msg.id, format: "full" });
                    category = mapLabelIdsToCategory(full?.labelIds);
                } catch (fetchErr) {
                    console.error("Failed to fetch full message details for category:", fetchErr);
                }
            }

            if (msg?.id && tenantId) {
                const result = await db.query(
                    `INSERT INTO emails 
              (user_id, gmail_message_id, thread_id, sender, subject, body, received_at, category)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
             ON CONFLICT (gmail_message_id) DO UPDATE
             SET category = EXCLUDED.category
             RETURNING *`,
                    [tenantId, msg.id, msg.threadId, msg.from, msg.subject, msg.body || '', category]
                );

                if (result.rows.length > 0) {
                    const insertedEmail = result.rows[0];
                    try {
                        broadcast(tenantId, { type: "email", data: insertedEmail });
                    } catch (broadcastErr) {
                        console.error("Failed to broadcast initial email update:", broadcastErr);
                    }

                    // Asynchronously triage the email, update DB, and broadcast updated row
                    (async () => {
                        try {
                            const triage = await triageEmail(insertedEmail.subject || '', insertedEmail.body || '');
                            const updateResult = await db.query(
                                `UPDATE emails 
                                 SET priority = $1, category = COALESCE($2, category), triage_reason = $3 
                                 WHERE id = $4 
                                 RETURNING *`,
                                [triage.priority, triage.category || category, triage.reason, insertedEmail.id]
                            );
                            if (updateResult.rows.length > 0) {
                                const updatedEmail = updateResult.rows[0];
                                if (updatedEmail.priority === 'high') {
                                    broadcast(tenantId, { type: "email", data: updatedEmail });
                                } else {
                                    queueDigestItem(tenantId, { type: "email", data: updatedEmail });
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
        }

        if (payload?.type === 'googlecalendar.event.created') {
            handled = true;
            const event = payload.data;
            if (event?.id && tenantId) {
                const result = await db.query(
                    `INSERT INTO calendar_events 
              (user_id, google_event_id, title, description, start_time, end_time)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (google_event_id) DO NOTHING
             RETURNING *`,
                    [tenantId, event.id, event.summary, event.description || '',
                    event.start?.dateTime, event.end?.dateTime]
                );

                if (result.rows.length > 0) {
                    const insertedEvent = result.rows[0];
                    try {
                        broadcast(tenantId, { type: "calendar_event", data: insertedEvent });
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
        }

        if (handled && webhookEventDbId) {
            await db.query(`UPDATE webhook_events SET processed = TRUE WHERE id = $1`, [webhookEventDbId]);
        } else if (!handled) {
            console.warn(`⚠️ Webhook event ${webhookEventDbId} unhandled (unknown type: ${payload?.type}). Leaving processed = FALSE for manual review.`);
        }

        res.json({ status: 'ok', handled });
    } catch (err: any) {
        console.error('❌ Webhook error:', err);
        res.status(500).json({ error: err.message });
    }
});

// JSON body parser middleware for all other routes below
app.use(express.json());

=======
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961
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

<<<<<<< HEAD
// ─── CONTACTS ─────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
    try {
        const contactsRaw = process.env.KNOWN_CONTACTS || '';
        const contacts = contactsRaw
            .split(',')
            .map((pair) => pair.trim())
            .filter(Boolean)
            .map((pair) => {
                const [name, email] = pair.split(':').map((s) => s.trim());
                return { name, email };
            });
        res.json({ contacts });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── EMAILS ───────────────────────────────────────────────
app.get('/api/emails', async (req, res) => {
    try {
        const { category, before, limit } = req.query;
        const pageSize = Math.min(Number(limit) || 50, 100);
        const tenantId = req.userId;

        let query = `SELECT * FROM emails WHERE user_id = $1`;
        const params: any[] = [tenantId];

        if (category && typeof category === 'string' && category !== 'ALL') {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        if (before && typeof before === 'string') {
            params.push(new Date(before));
            query += ` AND received_at < $${params.length}`;
        }

        params.push(pageSize);
        query += ` ORDER BY 
            CASE 
                WHEN priority = 'high' THEN 1
                WHEN priority = 'medium' THEN 2
                WHEN priority = 'low' THEN 3
                ELSE 4
            END ASC,
            received_at DESC 
            LIMIT $${params.length}`;

        const result = await db.query(query, params);

        // Fetch unread / total count per category
        const countsRes = await db.query(
            `SELECT category, COUNT(*) as count FROM emails WHERE user_id = $1 GROUP BY category`,
            [tenantId]
        );
        const counts: Record<string, number> = {};
        for (const row of countsRes.rows) {
            if (row.category) counts[row.category] = Number(row.count);
        }

        res.json({
            emails: result.rows,
            hasMore: result.rows.length === pageSize,
            nextCursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].received_at : null,
            counts,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── EMAIL ACTIONS ─────────────────────────────────────────
app.post('/api/emails/:id/archive', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `UPDATE emails SET status = 'archived' WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Email not found' });
        }
        const updatedRow = result.rows[0];
        try {
            broadcast(req.userId!, { type: 'email', data: updatedRow });
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

        const emailRes = await db.query(`SELECT * FROM emails WHERE id = $1 AND user_id = $2`, [id, req.userId]);
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
            tenantId: req.userId
        });

        res.json({ status: 'sent', recipient: originalEmail.sender, subject });
=======
// ─── EMAILS ───────────────────────────────────────────────
app.get('/api/emails', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM emails ORDER BY received_at DESC LIMIT 50`
        );
        res.json(result.rows);
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CALENDAR ─────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
    try {
        const result = await db.query(
<<<<<<< HEAD
            `SELECT * FROM calendar_events WHERE user_id = $1 ORDER BY start_time ASC LIMIT 20`,
            [req.userId]
=======
            `SELECT * FROM calendar_events ORDER BY start_time ASC LIMIT 20`
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

<<<<<<< HEAD
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
                    `SELECT * FROM emails WHERE id = ANY($1::uuid[]) AND user_id = $2`,
                    [emailIds, req.userId]
                );
                vectorEmails = emailsRes.rows;
            }

            if (eventIds.length > 0) {
                const eventsRes = await db.query(
                    `SELECT * FROM calendar_events WHERE id = ANY($1::uuid[]) AND user_id = $2`,
                    [eventIds, req.userId]
                );
                vectorEvents = eventsRes.rows;
            }
        }

        // 2. Parallel ILIKE fallback search
        const [textEmailsRes, textEventsRes] = await Promise.all([
            db.query(
                `SELECT * FROM emails 
                 WHERE user_id = $2 AND (subject ILIKE '%' || $1 || '%' OR body ILIKE '%' || $1 || '%')
                 LIMIT 20`,
                [trimmedQ, req.userId]
            ),
            db.query(
                `SELECT * FROM calendar_events 
                 WHERE user_id = $2 AND (title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
                 LIMIT 20`,
                [trimmedQ, req.userId]
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
=======
// ─── WEBHOOK ──────────────────────────────────────────────
app.post('/api/webhook', async (req, res) => {
    try {
        const payload = req.body;
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
            await db.query(
                `INSERT INTO emails 
          (gmail_message_id, thread_id, sender, subject, body, received_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (gmail_message_id) DO NOTHING`,
                [msg.id, msg.threadId, msg.from, msg.subject, msg.body || '']
            );
        }

        if (payload?.type === 'googlecalendar.event.created') {
            const event = payload.data;
            await db.query(
                `INSERT INTO calendar_events 
          (google_event_id, title, description, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (google_event_id) DO NOTHING`,
                [event.id, event.summary, event.description || '',
                event.start?.dateTime, event.end?.dateTime]
            );
        }

        res.json({ status: 'ok' });
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AGENT CHAT ───────────────────────────────────────────
app.use('/api/agent', agentChatRouter);

<<<<<<< HEAD
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── EMAIL SUMMARIZE ──────────────────────────────────────
app.post('/api/emails/:id/summarize', async (req, res) => {
  try {
    const { id } = req.params;
    const emailRes = await db.query(
      `SELECT body, subject, sender FROM emails WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (emailRes.rows.length === 0) {
      return res.status(404).json({ error: "Email not found" });
    }

    const { body, subject, sender } = emailRes.rows[0];

    if (!body || !body.trim()) {
      return res.status(400).json({ error: "Email has no body" });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `You are an email summarizer. Return ONLY a JSON object with 
          exactly these 3 fields, no markdown, no explanation:
          {
            decided: string (what was decided or stated — one sentence),
            open: string (what is still unclear or pending — one sentence, 
                   or 'Nothing open' if nothing),
            owner: string (who needs to act next and what — one sentence, 
                   or 'No action needed' if nothing)
          }`,
        },
        {
          role: "user",
          content: `Subject: ${subject || ""}\nFrom: ${sender || ""}\n\nEmail:\n${body.slice(0, 3000)}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "";
    let summary: { decided: string; open: string; owner: string };

    try {
      summary = JSON.parse(content);
    } catch {
      // Fallback in case of markdown formatting or extra text around JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON response from Groq");
      }
    }

    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

=======
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961
// ─── CORSAIR — SABSE LAST ─────────────────────────────────
app.use('/api/corsair', toExpressHandler(corsair, { basePath: '/api/corsair' }));

const PORT = process.env.PORT || 3000;
<<<<<<< HEAD
httpServer.listen(PORT, () => {
=======
app.listen(PORT, () => {
>>>>>>> 299f1769e56c4a9c417f208c01eb737f915e0961
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});