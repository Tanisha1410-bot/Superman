# Corsair Superhuman Clone — Frontend

React + TypeScript + Vite + Tailwind. Lives alongside `corsair-service/`
at the project root and talks to it over HTTP.

## Setup

```bash
cd frontend
npm install
cp .env.example .env      # points at corsair-service on :3000 by default
npm run dev                # http://localhost:5173
```

Run the backend in a separate terminal:

```bash
cd corsair-service
npm install
npm run dev                 # http://localhost:3000 (tsx server.ts)
```

## Matched to your actual backend

This was adjusted to `corsair-service/server.ts` and
`corsair-service/backend/schema.sql` as they exist right now, not the
original playbook draft. Specifically:

| Playbook draft | Actually in your repo |
|---|---|
| `GET /emails` | `GET /api/emails` |
| `GET /calendar/events` | `GET /api/events` |
| Paginated `{ items, next_cursor }` | Plain array, capped at 50/20 rows |
| `from_name` / `from_email` / `snippet` fields | `sender` (raw `"Name <email>"` string) / `body` — see `parseSender()` and `snippetFrom()` in the frontend |
| `is_read` boolean | Doesn't exist in `emails` table — dropped from the UI |
| `priority: urgent/normal/low` | `priority` is free-text, defaults `'medium'` — typed as `high/medium/low` |

## What's NOT wired up yet (backend work still needed)

- **`POST /api/agent/chat`** — doesn't exist in `server.ts`. The Agent
  Command Bar (Cmd+K) is built and will call it, but you'll get a 404
  until you add the route and connect it to Groq + the Corsair MCP
  client (playbook §8, Hours 8–14).
- **Realtime push** — `POST /api/webhook` writes incoming Gmail/Calendar
  events to Postgres but nothing broadcasts them to connected clients.
  `useWebSocket.ts` will keep retrying quietly in the background; add a
  `ws` server in `corsair-service` and broadcast on webhook insert to
  make the "zero-polling" claim real.
- **`GET /api/search`** — not implemented; needed once your embedding
  worker exists (Hours 18–22).

## Structure

```
frontend/
├── src/
│   ├── api/client.ts      # typed fetch wrappers, matches server.ts exactly
│   ├── types.ts            # mirrors backend/schema.sql column-for-column
│   ├── hooks/               # useWebSocket, useHotkeys
│   ├── components/          # Kbd (shortcut keycaps), PriorityDot
│   └── views/                # Inbox, Calendar, AgentBar
└── package.json
```

## Next steps

1. `npm install && npm run dev` in both `frontend/` and `corsair-service/`.
2. Confirm the inbox renders real rows from your Postgres `emails` table.
3. Build `POST /api/agent/chat` on the backend — the frontend is already
   waiting for it.
4. Add a WebSocket broadcast on webhook insert for true realtime.
