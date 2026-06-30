import { GoogleGenAI } from "@google/genai";
import { generateContentWithRetry } from "./gemini";

export async function askAIAssistant(query: string, language: string = "English", localTime?: string, localTimeStr?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Please add it in your Secrets/Settings panel.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const referenceTime = localTime ? new Date(localTime) : new Date();
  const localContext = localTimeStr || referenceTime.toString();

  const systemInstruction = `You are "Pulse Capture Assistant", an elite personal AI companion and high-performance search engine.
The user is speaking or typing in ${language}. 
The reference UTC time is ${referenceTime.toISOString()}. The user's local time context is ${localContext}.
Your core roles:
1. Search engine: Provide accurate, extremely structured, clear information on any query. Summarize search results with clean bullet points.
2. Draft email/letters: If asked to write emails or messages, write beautiful, highly professional drafts using proper formatting and placeholder fields, tailored to the requested tone.
3. Assistant tasks: Answer questions, write code, calculate stats, explain terms, or translate text.

Response Guidelines:
- If the query is in a regional Indian language (like Hindi, Tamil, Bengali, etc.), you must understand it perfectly and respond beautifully in that same language (or in bilingual English/Indian language if appropriate, but respect the user's selected language).
- Keep formatting extremely clean using markdown. Use rich highlights, bullet points, and code blocks as appropriate.
- Maintain a helpful, elite, supportive, and precise tone. Never speak with robotic or empty fluff.`;

  const prompt = `User Query: "${query}"

Please answer the user's query perfectly according to their instructions. If they asked to draft an email, draft it beautifully with complete and professional formatting. If they asked to search, find information, or explain something, act as an advanced, high-performance search engine and knowledge companion.`;

  const response = await generateContentWithRetry(ai, {
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction,
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Received empty response from the AI Assistant.");
  }

  return responseText.trim();
}
