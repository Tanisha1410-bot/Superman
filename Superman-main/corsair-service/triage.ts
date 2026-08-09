import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface TriageResult {
  priority: "high" | "medium" | "low";
  reason: string;
  category: "action_needed" | "fyi" | "meeting" | "newsletter" | "spam_like";
}

const DEFAULT_TRIAGE: TriageResult = {
  priority: "medium",
  reason: "triage failed",
  category: "fyi",
};

const SYSTEM_PROMPT = `You are an automated email classification assistant.
Output ONLY a raw JSON object matching the required schema. Do NOT include markdown code fences (\`\`\`json), explanations, or any text before or after the JSON.

JSON Schema:
{
  "priority": "high" | "medium" | "low",
  "reason": "<max 8 words>",
  "category": "action_needed" | "fyi" | "meeting" | "newsletter" | "spam_like"
}

Classification rules:
- "high": needs a reply/action within 24h, from a known/real sender, or is a meeting request/confirmation.
- "medium": informational but relevant to work.
- "low": newsletters, automated notifications, marketing.

Few-shot Examples:
1. Subject "Re: Contract review", Body "Can you sign off by EOD tomorrow?" -> {"priority":"high","reason":"deadline tomorrow","category":"action_needed"}
2. Subject "Your weekly newsletter", Body "Top 10 reads..." -> {"priority":"low","reason":"newsletter digest","category":"newsletter"}
3. Subject "Meeting invite: Design Sync", Body "Please confirm your attendance" -> {"priority":"high","reason":"meeting confirmation needed","category":"meeting"}
`;

function validateAndParseJson(raw: string): TriageResult | null {
  try {
    let text = raw.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    const parsed = JSON.parse(text);

    const validPriorities = ["high", "medium", "low"];
    const validCategories = ["action_needed", "fyi", "meeting", "newsletter", "spam_like"];

    if (
      validPriorities.includes(parsed.priority) &&
      typeof parsed.reason === "string" &&
      validCategories.includes(parsed.category)
    ) {
      return {
        priority: parsed.priority,
        reason: parsed.reason,
        category: parsed.category,
      };
    }
  } catch {
    // Fail silently to trigger retry or fallback
  }
  return null;
}

export async function triageEmail(subject: string, body: string): Promise<TriageResult> {
  const truncatedSubject = (subject || "").slice(0, 500);
  const truncatedBody = (body || "").slice(0, 2000);

  const userContent = `Subject: ${truncatedSubject}\n\nBody: ${truncatedBody}`;

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  try {
    // Attempt 1: Call Groq using small llama-3.1-8b-instant model and low max_tokens
    const response1 = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.1,
      max_tokens: 150,
    });

    const content1 = response1.choices[0]?.message?.content || "";
    const result1 = validateAndParseJson(content1);
    if (result1) return result1;

    // Retry policy: Append failure notice and retry ONCE
    const retryMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      ...messages,
      { role: "assistant", content: content1 },
      {
        role: "user",
        content:
          "Your previous response was not valid JSON matching the schema. Return ONLY the raw JSON object, nothing else.",
      },
    ];

    const response2 = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: retryMessages,
      temperature: 0.0,
      max_tokens: 150,
    });

    const content2 = response2.choices[0]?.message?.content || "";
    const result2 = validateAndParseJson(content2);
    if (result2) return result2;
  } catch (err) {
    console.error("Error in triageEmail Groq execution:", err);
  }

  return DEFAULT_TRIAGE;
}
