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

// Base64url-encodes a string per Gmail API requirements (RFC 2822 raw message).
function base64UrlEncode(str: string): string {
    return Buffer.from(str, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function runTool(name: string, args: any) {
    if (name === 'send_email') {
        const mime =
            `From: ${process.env.USER_EMAIL || ''}\r\n` +
            `To: ${args.to}\r\n` +
            `Subject: ${args.subject}\r\n` +
            `Content-Type: text/plain; charset="UTF-8"\r\n` +
            `\r\n` +
            `${args.body}`;
        const raw = base64UrlEncode(mime);

        await (corsair as any).gmail.api.messages.send({ raw });

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

router.post('/chat', async (req, res) => {
    const { prompt, user_id } = req.body;
    if (!prompt || !user_id) {
        return res.status(400).json({ error: 'prompt and user_id are required' });
    }

    try {
        const now = new Date().toISOString();
        const userEmail = process.env.USER_EMAIL || 'unknown@example.com';

        // Parses KNOWN_CONTACTS="Name:email,Name2:email2" into a readable list
        // for the prompt, so the agent resolves names to real addresses instead
        // of inventing placeholders like user@example.com.
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

        const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Current datetime: ${now}\nUser's email: ${userEmail}${contacts ? `\nKnown contacts:\n${contacts}` : ''}\n\nUser request: ${prompt}`,
            },
        ];

        const first = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            tools: TOOLS,
            tool_choice: 'required',
        });

        const choice = first.choices[0].message;
        const toolCalls = choice.tool_calls;

        // No proper tool_calls from Groq -- check if it leaked a tool call as text instead
        // (known Groq/Llama quirk: writes <function=name{...}> in content instead of
        // populating the tool_calls field, sometimes without a closing tag).
        if (!toolCalls || toolCalls.length === 0) {
            const fallback = choice.content ? parseFallbackToolCall(choice.content) : null;

            if (fallback) {
                let result;
                try {
                    result = await runTool(fallback.name, fallback.args);
                } catch (err: any) {
                    result = { status: 'error', message: err.message };
                }

                await db.query(
                    `INSERT INTO agent_actions (user_id, prompt, tool_calls, result_summary) VALUES ($1, $2, $3, $4)`,
                    [user_id, prompt, JSON.stringify({ tool: fallback.name, args: fallback.args }), JSON.stringify(result)]
                );

                return res.json({
                    reply: {
                        id: crypto.randomUUID(),
                        role: 'agent',
                        content: result.status === 'error'
                            ? `Couldn't complete that: ${(result as any).message}`
                            : `Done — ${fallback.name.replace('_', ' ')} completed successfully.`,
                        created_at: new Date().toISOString(),
                    },
                    tool_calls: [{ tool: fallback.name, args: fallback.args, result }],
                });
            }

            // Genuinely just a text reply / clarifying question -- nothing to parse
            return res.json({
                reply: { id: crypto.randomUUID(), role: 'agent', content: choice.content, created_at: new Date().toISOString() },
            });
        }

        // Execute every requested tool call, log each to agent_actions.
        const results = [];
        for (const call of toolCalls) {
            const args = JSON.parse(call.function.arguments);
            let result;
            try {
                result = await runTool(call.function.name, args);
            } catch (err: any) {
                result = { status: 'error', message: err.message };
            }
            results.push({ tool: call.function.name, args, result });

            await db.query(
                `INSERT INTO agent_actions (user_id, prompt, tool_calls, result_summary) VALUES ($1, $2, $3, $4)`,
                [user_id, prompt, JSON.stringify({ tool: call.function.name, args }), JSON.stringify(result)]
            );
        }

        // Second Groq call: let the model summarize what actually happened.
        messages.push(choice);
        for (let i = 0; i < toolCalls.length; i++) {
            messages.push({
                role: 'tool',
                tool_call_id: toolCalls[i].id,
                content: JSON.stringify(results[i].result),
            });
        }
        const final = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
        });

        res.json({
            reply: {
                id: crypto.randomUUID(),
                role: 'agent',
                content: final.choices[0].message.content,
                created_at: new Date().toISOString(),
            },
            tool_calls: results,
        });
    } catch (err: any) {
        console.error('[agent/chat] error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;