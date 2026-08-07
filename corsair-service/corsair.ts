import "dotenv/config";

import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { Pool } from "pg";

export const db = new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/corsair",
    ssl: process.env.DATABASE_URL?.includes("render.com") || process.env.DATABASE_URL?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : false,
});

db.on("error", (err) => {
    console.error("❌ Unexpected database error on idle client:", err);
});

export const corsair = createCorsair({
    kek: process.env.CORSAIR_KEK!,
    database: db,
    hub: {
        projectApiKey: process.env.CORSAIR_DEV_API_KEY!,
        signingSecret: process.env.CORSAIR_DEV_SIGNING_SECRET!,
    },
    plugins: [gmail(), googlecalendar()],
});
