import { GoogleGenAI } from "@google/genai";
import { generateContentWithRetry } from "./gemini";

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Please set it in the Secrets panel.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Call Gemini using the recommended generateContentWithRetry wrapper
  const response = await generateContentWithRetry(ai, {
    model: "gemini-3.5-flash",
    contents: [
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      },
      "Transcribe this audio completely and accurately. Return ONLY the plain text transcript, with no labels or commentary."
    ]
  });

  const text = response.text;
  if (!text || text.trim() === "") {
    throw new Error("Transcript came back empty.");
  }

  return text.trim();
}
