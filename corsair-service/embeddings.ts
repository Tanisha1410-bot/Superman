import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey });

export async function embedText(text: string): Promise<number[]> {
  const truncatedText = (text || "").slice(0, 2000);

  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: truncatedText,
    });

    const values = response.embedding?.values;
    if (!values || !Array.isArray(values) || values.length === 0) {
      throw new Error("No vector values returned from Gemini API");
    }

    if (values.length !== 768) {
      throw new Error(`Unexpected embedding dimension: ${values.length} (expected 768)`);
    }

    return values;
  } catch (err: any) {
    throw new Error(`EmbeddingError: ${err?.message || err}`);
  }
}
