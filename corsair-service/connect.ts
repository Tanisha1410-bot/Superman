import "dotenv/config";
import { corsair } from "./corsair";

async function main() {
    const plugin = process.argv[2] || "gmail";
    const tenantId = process.argv[3] || process.env.TENANT_ID || "tiya-default";

    if (plugin === "all") {
        for (const p of ["gmail", "googlecalendar"]) {
            const { connectUrl } = await corsair.manage.connect.createLink({
                plugin: p,
                tenantId,
            });
            console.log(`\nOpen this URL in your browser to connect ${p} (tenantId: ${tenantId}):\n`);
            console.log(connectUrl);
        }
        console.log("\n");
        return;
    }

    const { connectUrl } = await corsair.manage.connect.createLink({
        plugin,
        tenantId,
    });

    console.log(`\nOpen this URL in your browser to connect ${plugin} (tenantId: ${tenantId}):\n`);
    console.log(connectUrl);
    console.log("\n");
}

main().catch((err) => {
    console.error("Failed to create connect link:", err);
    process.exit(1);
});