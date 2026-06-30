import { GoogleGenAI, Type } from "@google/genai";
import { generateContentWithRetry } from "./gemini";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function recommendTransport(distanceKm: number, durationSec: number, minutesUntilDeadline?: number) {
  const distance = distanceKm.toFixed(1);
  const durationMin = Math.round(durationSec / 60);
  
  let timeContext = "";
  if (minutesUntilDeadline !== undefined && minutesUntilDeadline !== null) {
      timeContext = `The user has ${minutesUntilDeadline} minutes until their deadline. `;
  }

  const prompt = `You are a practical travel advisor for trips within India. Given the distance in kilometers and estimated driving duration, recommend realistic transport options for this specific trip. 
YOU MUST CHOOSE FROM: walk, bicycle, bus, auto-rickshaw, bike/two-wheeler, car/cab, metro, local train, or intercity train/flight.
Recommend 3-5 options ranked by suitability. 
For EACH option, you MUST provide an estimated duration in a precise 'Xh Ym Zs' format (e.g., '0h 45m 0s' or '1h 5m 30s').
${timeContext}
- Distance: ${distance} km
- Base driving duration: ${durationMin} minutes`;

  try {
    const response = await generateContentWithRetry(ai, {
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              option: { type: Type.STRING },
              duration: { type: Type.STRING, description: "Format: Xh Ym Zs" },
              reason: { type: Type.STRING },
              suitability: { type: Type.STRING, enum: ["Best", "Good", "Possible"] }
            },
            required: ["option", "duration", "reason", "suitability"]
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from AI.");
    }
    
    return JSON.parse(response.text);
  } catch (err) {
    console.error("Gemini Recommendation Error:", err);
    // Fallback logic for when AI fails or quota is hit
    const dist = parseFloat(distance);
    if (dist < 2) {
      return [
        { option: "Walk", duration: `0h ${Math.round(dist * 15)}m 0s`, reason: "Healthy and direct for very short distances.", suitability: "Best" },
        { option: "Bicycle", duration: `0h ${Math.round(dist * 6)}m 0s`, reason: "Fastest short-range green option.", suitability: "Good" },
        { option: "Auto-rickshaw", duration: "0h 8m 0s", reason: "Quick and easy for short hops.", suitability: "Possible" }
      ];
    } else if (dist < 15) {
      return [
        { option: "Car/Cab", duration: `0h ${durationMin}m 0s`, reason: "Comfortable and direct route.", suitability: "Best" },
        { option: "Bike/Two-wheeler", duration: `0h ${Math.round(durationMin * 0.8)}m 0s`, reason: "Fastest way to beat city traffic.", suitability: "Best" },
        { option: "Bus", duration: `0h ${Math.round(durationMin * 1.5)}m 0s`, reason: "Economical public transport option.", suitability: "Good" },
        { option: "Auto-rickshaw", duration: `0h ${Math.round(durationMin * 1.2)}m 0s`, reason: "Convenient point-to-point city travel.", suitability: "Possible" }
      ];
    } else {
      return [
        { option: "Car/Cab", duration: `0h ${durationMin}m 0s`, reason: "Most flexible for longer distances.", suitability: "Best" },
        { option: "Bus", duration: `1h ${Math.round(dist * 0.2)}m 0s`, reason: "Reliable intercity public transport.", suitability: "Good" },
        { option: "Train/Metro", duration: "Variable", reason: "Avoids highway traffic for longer commutes.", suitability: "Possible" }
      ];
    }
  }
}
