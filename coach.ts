import { GoogleGenAI, Type } from "@google/genai";
import { generateContentWithRetry } from "./gemini";
import { db } from "./db";

export interface CoachingInsightResponse {
  completedCount: number;
  pendingCount: number;
  totalCount: number;
  ratio: number;
  insight: string;
  suggestedAction: string;
}

export async function generateCoachingInsight(): Promise<CoachingInsightResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Please set it in the Secrets panel.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const state = db.getState();
  const tasks = state.tasks || [];
  const completedTasks = tasks.filter(t => t.status === "done");
  const pendingTasks = tasks.filter(t => t.status === "pending");
  
  const completedCount = completedTasks.length;
  const pendingCount = pendingTasks.length;
  const totalCount = tasks.length;
  const ratio = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Let's build a descriptive, high-fidelity prompt for the Coach AI
  const prompt = `You are an elite productivity and deadline-saving coach. You analyze a user's progress and provide high-fidelity, actionable guidance.
Analyze the user's current progress:
- Total Tasks Tracked: ${totalCount}
- Completed Tasks: ${completedCount}
- Pending Tasks: ${pendingCount}
- Completed-to-Pending Ratio: ${completedCount} completed out of ${totalCount} total (${ratio.toFixed(1)}%)

Pending Task List:
${pendingTasks.length > 0 
  ? pendingTasks.map(t => `- [Priority: ${t.priority}] "${t.title}" (Estimated: ${t.estimatedMinutes} mins, Deadline: ${t.deadline})`).join("\n")
  : "No pending tasks. Outstanding work completed!"}

Completed Task List (Recently Completed):
${completedTasks.length > 0 
  ? completedTasks.map(t => `- "${t.title}"`).join("\n")
  : "No recently completed tasks."}

Current Energy Profile: "${state.energyProfile}"
Habits Stream Progress:
${state.habits.length > 0 
  ? state.habits.map(h => `- "${h.name}" (Streak: ${h.currentStreak} days)`).join("\n")
  : "No habits tracked yet."}

Please formulate:
1. A high-impact, conversational, and direct coaching insight (max 3 sentences). Refer specifically to their completed-to-pending ratio and tasks or habits in a supportive yet elite coaching manner. Avoid robotic or dry language.
2. EXACTLY ONE highly specific, practical, and concrete suggested action (max 15 words) the user can take right now (e.g. "Draft the first 2 slides of roadmap slides", or "Review your agenda for tomorrow morning"). Make it directly related to their actual pending tasks or habits.

Generate a strictly structured JSON response. Do not include markdown code fences or backticks.`;

  const response = await generateContentWithRetry(ai, {
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an elite personal performance coach. You analyze productivity data and output clear, motivating insights and exact concrete actions in a strict JSON schema. Speak with warmth, authority, and conciseness.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          insight: {
            type: Type.STRING,
            description: "A short AI-generated coaching insight (1-3 sentences) analyzing their completed-vs-pending progress."
          },
          suggestedAction: {
            type: Type.STRING,
            description: "One ultra-specific, concrete suggested action (maximum 15 words) based directly on their actual pending tasks or habits."
          }
        },
        required: ["insight", "suggestedAction"]
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response received from the Gemini coach model.");
  }

  // Defensive parsing
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      completedCount,
      pendingCount,
      totalCount,
      ratio,
      insight: parsed.insight || "Keep going! You're building solid momentum. Focus on tackling your highest priority pending task to unlock your next flow state.",
      suggestedAction: parsed.suggestedAction || "Select one high-priority task and dedicate 15 focused minutes to it right now."
    };
  } catch (err: any) {
    console.error("Failed to parse Gemini coaching JSON output:", jsonStr, err);
    // Provide a beautiful fallback state if parsing fails
    return {
      completedCount,
      pendingCount,
      totalCount,
      ratio,
      insight: `You have completed ${completedCount} out of ${totalCount} tasks. Maintaining a clean ratio of completed tasks helps reduce cognitive load. Focus on resolving pending High-priority items to maintain your stride.`,
      suggestedAction: pendingTasks.length > 0 
        ? `Dedicate 20 minutes to "${pendingTasks[0].title}" to build immediate momentum.`
        : "Add a new challenge or focus area to your directives list to start your next streak."
    };
  }
}
