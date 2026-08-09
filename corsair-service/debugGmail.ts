import "dotenv/config";
import { db } from "./corsair";
import { decryptDEK, decryptConfig } from "corsair/core";

async function main() {
    const tenantId = process.argv[2] || "default";

    const result = await db.query(
        `SELECT a.tenant_id, a.dek, a.config, a.updated_at, a.created_at
         FROM corsair_accounts a
         JOIN corsair_integrations i ON i.id = a.integration_id
         WHERE i.name = 'gmail' AND a.tenant_id = $1`,
        [tenantId]
    );

    if (result.rows.length === 0) {
        console.log(`No corsair_accounts row found for gmail / tenant_id='${tenantId}'.`);
        return;
    }

    for (const row of result.rows) {
        console.log(`\n--- gmail account row (tenant_id='${row.tenant_id}') ---`);
        console.log("created_at:", row.created_at);
        console.log("updated_at:", row.updated_at);

        try {
            const dek = await decryptDEK(row.dek, process.env.CORSAIR_KEK!);
            const config = decryptConfig(row.config, dek);

            console.log("config keys present:", Object.keys(config));
            console.log(
                "refresh_token present:",
                !!config.refresh_token,
                config.refresh_token ? `(length ${config.refresh_token.length})` : ""
            );
            console.log(
                "access_token present:",
                !!config.access_token,
                config.access_token ? `(length ${config.access_token.length})` : ""
            );
            if (config.expires_at) {
                const exp = new Date(Number(config.expires_at));
                console.log("access_token expires_at:", exp.toISOString(), exp < new Date() ? "(EXPIRED)" : "(not expired)");
            }
        } catch (err: any) {
            console.log("Failed to decrypt config:", err.message);
        }
    }
}

main()
    .catch((err) => {
        console.error("Script failed:", err);
        process.exit(1);
    })
    .finally(() => process.exit(0));