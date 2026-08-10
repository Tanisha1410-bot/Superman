import "dotenv/config";
import express from 'express';
import Groq from 'groq-sdk';
import { corsair, db } from './corsair';
import { parseFallbackToolCall } from './utils/parseFallbackToolCall';

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are the AI copilot inside a Superhuman-style email/calendar
client, with full access to the user's Gmail and Google Calendar via Corsair tools.

Your job: turn natural-language requests into precise, safe tool calls (send_email,
create_event).

Rules:
- Always resolve ambiguous recipients/times against context before acting (e.g.
  "next Thursday 9 AM" -> resolve to an exact ISO datetime). Today's date and the
  user's timezone are provided in the user message context.
- The user's own email address is provided in the context as "User's email". When
  the user says "myself", "me", or "my email", use that exact address as the
  recipient -- never invent a placeholder like user@example.com.
- If the user refers to someone by first name (e.g. "email Aditi"), check the
  "Known contacts" list in the context and use that exact email address. If the
  name isn't in the known contacts list, ask the user for their email address
  instead of guessing one.
- If a single prompt implies multiple actions, call multiple tools in the same turn
  and summarize all results together.
- Never call a tool without all required fields resolved -- ask a clarifying
  question in plain text instead of guessing.
- Default to concise, professional tone for drafted emails unless told otherwise.
- After every action, respond with a short confirmation: what was done, to whom,
  and when -- no filler.
- Always invoke tools using the proper tool-calling mechanism. Never write function
  calls as plain text in your response.`;

const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'send_email',
            description: 'Send an email via Gmail on the user\'s behalf.',
            parameters: {
                type: 'object',
                properties: {
                    to: { type: 'string', description: 'Recipient email address' },
                    subject: { type: 'string' },
                    body: { type: 'string' },
                },
                required: ['to', 'subject', 'body'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_event',
            description: 'Create a Google Calendar event.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    startTime: { type: 'string', description: 'ISO 8601 datetime' },
                    endTime: { type: 'string', description: 'ISO 8601 datetime' },
                    attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
                },
                required: ['title', 'startTime', 'endTime'],
            },
        },
    },
];

import { sendEmail } from "./gmailSend";

async function runTool(name: string, args: any) {
    if (name === 'send_email') {
        await sendEmail({
            to: args.to,
            subject: args.subject,
            body: args.body,
        });

        return { status: 'sent', to: args.to, subject: args.subject };
    }

    if (name === 'create_event') {
        await (corsair as any).googlecalendar.api.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: args.title,
                start: { dateTime: args.startTime },
                end: { dateTime: args.endTime },
                attendees: (args.attendees || []).map((email: string) => ({ email })),
            },
        });

        return { status: 'created', title: args.title, startTime: args.startTime };
    }

    throw new Error(`Unknown tool: ${name}`);
}

// In-memory rolling conversation store per user_id (hackathon scope, resets on server restart)
const conversationHistory = new Map<string, Groq.Chat.Completions.ChatCompletionMessageParam[]>();

interface PendingAction {
  tool: string;
  args: any;
  userId: string;
  prompt: string;
}
const pendingActions = new Map<string, PendingAction>();

router.post('/confirm/:actionId', async (req, res) => {
    const { actionId } = req.params;
    const pending = pendingActions.get(actionId);
    if (!pending) {
        return res.status(404).json({ error: 'No pending action found (it may have already been confirmed or cancelled).' });
    }

    pendingActions.delete(actionId);
    let result;
    try {
        result = await runTool(pending.tool, pending.args);
    } catch (err: any) {
        result = { status: 'error', message: err.message };
    }

    try {
        await db.query(
            `INSERT INTO agent_actions (user_id, prompt, tool_calls, result_summary) VALUES ($1, $2, $3, $4)`,
            [pending.userId, pending.prompt, JSON.stringify({ tool: pending.tool, args: pending.args }), JSON.stringify(result)]
        );
    } catch (dbErr) {
        console.error('Failed to log agent action to DB:', dbErr);
    }

    res.json({ status: 'confirmed', result, tool: pending.tool });
});

router.post('/cancel/:actionId', (req, res) => {
    const { actionId } = req.params;
    const pending = pendingActions.get(actionId);
    if (!pending) {
        return res.status(404).json({ error: 'No pending action found (it may have already been confirmed or cancelled).' });
    }
    pendingActions.delete(actionId);
    res.json({ status: 'cancelled', tool: pending.tool });
});

function schedulePendingAction(name: string, args: any, user_id: string, prompt: string) {
    const actionId = crypto.randomUUID();
    pendingActions.set(actionId, { tool: name, args, userId: user_id, prompt });
    return actionId;
}

function formatPendingActionSummary(name: string, args: any): string {
    if (name === 'send_email') {
        return `Ready to send email to ${args.to} — please confirm below to send.`;
    }
    if (name === 'create_event') {
        return `Ready to create event "${args.title}" — please confirm below to add to calendar.`;
    }
    return `Ready to perform ${name.replace('_', ' ')} — please confirm below.`;
}

router.post('/chat', async (req, res) => {
    const { prompt, user_id } = req.body;
    if (!prompt || !user_id) {
        return res.status(400).json({ error: 'prompt and user_id are required' });
    }

    try {
        const now = new Date().toISOString();
        const userEmail = process.env.USER_EMAIL || 'unknown@example.com';

        // Parses KNOWN_CONTACTS="Name:email,Name2:email2" into a readable list
        const contactsRaw = process.env.KNOWN_CONTACTS || '';
        const contacts = contactsRaw
            .split(',')
            .map((pair) => pair.trim())
            .filter(Boolean)
            .map((pair) => {
                const [name, email] = pair.split(':').map((s) => s.trim());
                return `${name} = ${email}`;
            })
            .join('\n');

        const userHistory = conversationHistory.get(user_id) || [];

        const newUserMsg: Groq.Chat.Completions.ChatCompletionMessageParam = {
            role: 'user',
            content: `Current datetime: ${now}\nUser's email: ${userEmail}${contacts ? `\nKnown contacts:\n${contacts}` : ''}\n\nUser request: ${prompt}`,
        };

        const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...userHistory,
            newUserMsg,
        ];

        const first = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            tools: TOOLS,
            tool_choice: 'required',
        });

        const choice = first.choices[0].message;
        const toolCalls = choice.tool_calls;

        // Helper to update user's history with the user request & final reply turn
        const updateHistory = (finalReplyContent: string) => {
            const updated = [
                ...userHistory,
                { role: 'user' as const, content: prompt },
                { role: 'assistant' as const, content: finalReplyContent },
            ];
            // Keep last 6 messages (3 turns)
            conversationHistory.set(user_id, updated.slice(-6));
        };

        // No proper tool_calls from Groq -- check if it leaked a tool call as text instead
        if (!toolCalls || toolCalls.length === 0) {
            const fallback = choice.content ? parseFallbackToolCall(choice.content) : null;

            if (fallback) {
                const actionId = schedulePendingAction(fallback.name, fallback.args, user_id, prompt);
                const finalReply = formatPendingActionSummary(fallback.name, fallback.args);

                updateHistory(finalReply);

                return res.json({
                    reply: {
                        id: crypto.randomUUID(),
                        role: 'agent',
                        content: finalReply,
                        created_at: new Date().toISOString(),
                    },
                    pending_actions: [{ actionId, tool: fallback.name, args: fallback.args }],
                });
            }

            // Genuinely just a text reply / clarifying question
            const replyText = choice.content || '';
            updateHistory(replyText);

            return res.json({
                reply: { id: crypto.randomUUID(), role: 'agent', content: replyText, created_at: new Date().toISOString() },
            });
        }

        // Schedule every requested tool call with undo window
        const pendingList = [];
        const summaryLines = [];
        for (const call of toolCalls) {
            const args = JSON.parse(call.function.arguments);
            const actionId = schedulePendingAction(call.function.name, args, user_id, prompt);
            pendingList.push({ actionId, tool: call.function.name, args });
            summaryLines.push(formatPendingActionSummary(call.function.name, args));
        }

        const finalContent = summaryLines.join('\n');
        updateHistory(finalContent);

        res.json({
            reply: {
                id: crypto.randomUUID(),
                role: 'agent',
                content: finalContent,
                created_at: new Date().toISOString(),
            },
            pending_actions: pendingList,
        });
    } catch (err: any) {
        console.error('[agent/chat] error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;