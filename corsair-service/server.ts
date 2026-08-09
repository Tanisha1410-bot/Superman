import "dotenv/config";

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
import { toExpressHandler } from 'corsair';
import { corsair, db } from './corsair';
import agentChatRouter from './agentChat';

const app = express();
app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

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
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AGENT CHAT ───────────────────────────────────────────
app.use('/api/agent', agentChatRouter);

// ─── CORSAIR — SABSE LAST ─────────────────────────────────
app.use('/api/corsair', toExpressHandler(corsair, { basePath: '/api/corsair' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});