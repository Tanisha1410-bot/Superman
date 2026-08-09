import "dotenv/config";
import { corsair } from "./corsair";

console.log("Top-level corsair keys:", Object.keys(corsair as any));
console.log("\ntypeof corsair.gmail:", typeof (corsair as any).gmail);

if ((corsair as any).gmail) {
    console.log("corsair.gmail keys:", Object.keys((corsair as any).gmail));

    if ((corsair as any).gmail.api) {
        console.log("corsair.gmail.api keys:", Object.keys((corsair as any).gmail.api));
    } else {
        console.log("corsair.gmail.api is undefined -- checking for other nesting...");
        console.log("Full corsair.gmail object:", (corsair as any).gmail);
    }
} else {
    console.log("corsair.gmail itself is undefined!");
}