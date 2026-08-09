import "dotenv/config";
import { corsair } from "./corsair";

async function main() {
    const { connectUrl } = await corsair.manage.connect.createLink({
        plugin: "gmail",
        tenantId: "tiya-default",
    });

    console.log("\nOpen this URL in your browser to connect Gmail:\n");
    console.log(connectUrl);
    console.log("\n");
}

main().catch((err) => {
    console.error("Failed to create connect link:", err);
    process.exit(1);
});