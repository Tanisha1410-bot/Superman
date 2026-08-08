import "dotenv/config";
import { corsair } from "../corsair";

const gcal: any = (corsair as any).googlecalendar;

console.log("Top-level keys on corsair.googlecalendar:", Object.keys(gcal ?? {}));
console.log("Keys on corsair.googlecalendar.api:", Object.keys(gcal?.api ?? {}));

if (gcal?.api?.events) {
  console.log("Keys on corsair.googlecalendar.api.events:", Object.keys(gcal.api.events));
}
if (gcal?.api?.calendarList) {
  console.log("Keys on corsair.googlecalendar.api.calendarList:", Object.keys(gcal.api.calendarList));
}

process.exit(0);
