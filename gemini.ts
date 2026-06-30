import { GoogleGenAI } from "@google/genai";

interface GenerateParams {
  model: string;
  contents: any;
  config?: any;
}

/**
 * Executes a generateContent call with automatic retries on transient errors (like 503/429)
 * and falls back to a lighter model (gemini-3.1-flash-lite) if the primary model is unavailable.
 */
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenerateParams
): Promise<any> {
  const requestedModel = params.model;
  // Map gemini-3.5-flash to highly available and recommended gemini-3.1-flash-lite to prevent 503/429 errors,
  // since gemini-3.5-flash has a strict 20 requests per day limit on the free tier.
  const primaryModel = requestedModel === "gemini-3.5-flash" ? "gemini-3.1-flash-lite" : requestedModel;
  const modelsToTry = [primaryModel];

  // Robust fallback chain: gemini-3.1-flash-lite, gemini-flash-latest, gemini-3.5-flash
  const fallbacks = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
  for (const fallback of fallbacks) {
    if (!modelsToTry.includes(fallback)) {
      modelsToTry.push(fallback);
    }
  }
  if (requestedModel !== primaryModel && !modelsToTry.includes(requestedModel)) {
    // Add original model as last resort
    modelsToTry.push(requestedModel);
  }

  const maxRetries = 3;
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini API] Querying model "${model}" (Attempt ${attempt}/${maxRetries})...`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errorMessage = String(err.message || err.status || err);
        let errorDetails = "";
        try {
          errorDetails = typeof err === "object" ? JSON.stringify(err) : String(err);
        } catch {
          errorDetails = String(err);
        }

        console.error(`[Gemini API] Error on model "${model}" (Attempt ${attempt}):`, errorMessage);

        // Identify transient/retriable errors
        const isTransient =
          errorMessage.includes("503") ||
          errorMessage.includes("UNAVAILABLE") ||
          errorMessage.includes("429") ||
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          errorMessage.includes("demand") ||
          errorMessage.includes("overloaded") ||
          errorMessage.includes("temporary") ||
          errorMessage.includes("Unavailable") ||
          errorDetails.includes("503") ||
          errorDetails.includes("UNAVAILABLE") ||
          errorDetails.includes("429") ||
          errorDetails.includes("RESOURCE_EXHAUSTED") ||
          errorDetails.includes("demand") ||
          errorDetails.includes("overloaded") ||
          errorDetails.includes("temporary") ||
          errorDetails.includes("Unavailable");

        if (!isTransient) {
          // If it's a fundamental error (e.g. auth, invalid params, invalid schema),
          // do not keep retrying or fall back as it will fail the same way.
          throw err;
        }

        const isQuotaError = 
          errorMessage.includes("429") || 
          errorMessage.includes("RESOURCE_EXHAUSTED") || 
          errorMessage.includes("quota") ||
          errorDetails.includes("429") || 
          errorDetails.includes("RESOURCE_EXHAUSTED") || 
          errorDetails.includes("quota");

        if (isQuotaError) {
          console.warn(`[Gemini API] Quota exhausted or rate limited for model "${model}". Skipping remaining retries and falling back immediately...`);
          break; // break out of the attempts loop to try the next model
        }

        if (attempt < maxRetries) {
          const delay = attempt * 1000; // 1000ms, 2000ms
          console.log(`[Gemini API] Transient error detected. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.warn(`[Gemini API] Model "${model}" failed all attempts. Trying next fallback model if available...`);
  }

  throw lastError || new Error("All model attempts and fallbacks failed.");
}
