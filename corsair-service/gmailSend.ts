import { corsair } from "./corsair";

export function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyTo?: string | null;
}

export async function sendEmail({ to, subject, body, threadId, inReplyTo }: SendEmailOptions) {
  let headers =
    `From: ${process.env.USER_EMAIL || ""}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n`;

  if (inReplyTo) {
    headers += `In-Reply-To: ${inReplyTo}\r\nReferences: ${inReplyTo}\r\n`;
  }

  headers += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;

  const mime = headers + body;
  const raw = base64UrlEncode(mime);

  const requestPayload: any = { raw };
  if (threadId) {
    requestPayload.threadId = threadId;
  }

  await (corsair as any).gmail.api.messages.send(requestPayload);

  return { status: "sent", to, subject };
}
