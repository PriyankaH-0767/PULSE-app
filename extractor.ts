import { GoogleGenAI, Type } from "@google/genai";
import { generateContentWithRetry } from "./gemini";
import { db } from "./db";
import { Task, Priority } from "../src/types";

export async function extractTasksWithAI(textInput: string, localTime?: string, localTimeStr?: string): Promise<Task[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Please set it in the Secrets panel.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const referenceTime = localTime ? new Date(localTime) : new Date();
  const localContext = localTimeStr || referenceTime.toString();

  const response = await generateContentWithRetry(ai, {
    model: "gemini-3.5-flash",
    contents: `Extract tasks from this text: "${textInput}"`,
    config: {
      systemInstruction: `You are an expert personal productivity assistant. Your task is to extract actionable tasks from a messy user-provided paragraph.
The user might have background noise, filler words ("um", "uh"), or stuttering. Ignore these "disturbances" and focus on the core actions.
The reference UTC time is ${referenceTime.toISOString()}. The user's local time context is ${localContext}.
Use this to calculate relative deadlines like "by tomorrow evening", "in 2 hours", "next Friday".

For each extracted task, determine:
1. title: Clear, concise action-oriented name of the task.
2. deadline: Precise ISO 8601 datetime string representing when the task is due. If no deadline is specified or implied, use the string "no deadline".
3. alarmTime: An ISO 8601 datetime string for a reminder/alarm. If the user explicitly mentions a time to be reminded or an alarm time (e.g., "remind me at 5pm", "set an alarm for 6"), use that. 
   IMPORTANT: If the user says "set an alarm for [time]", prioritize this [time] for alarmTime. Do NOT confuse it with the deadline if they are different.
4. priority: Determine if the priority is "High", "Medium", or "Low" based on the urgency and wording.
5. estimatedMinutes: An integer estimating how long the task will take in minutes. If not specified, infer a realistic estimate.

IMPORTANT: When the user says "at 5pm" or similar, calculate the ISO 8601 string in UTC, relative to the reference time and user's local offset provided in the context.
Output a strictly formatted JSON array containing only these tasks.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "List of extracted tasks",
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            deadline: { type: Type.STRING },
            alarmTime: { type: Type.STRING },
            priority: { type: Type.STRING },
            estimatedMinutes: { type: Type.INTEGER }
          },
          required: ["title", "deadline", "priority", "estimatedMinutes"]
        }
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response received from Gemini.");
  }

  // Defensive parsing
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  let extractedRawList: any[];
  try {
    extractedRawList = JSON.parse(jsonStr);
  } catch (err: any) {
    console.error("Failed to parse Gemini JSON output:", jsonStr, err);
    throw new Error("The AI response could not be parsed as a valid task list.");
  }

  const addedTasks: Task[] = [];
  for (const raw of extractedRawList) {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) continue;

    let deadline = "no deadline";
    if (typeof raw.deadline === "string" && raw.deadline.trim() !== "" && raw.deadline.toLowerCase() !== "no deadline") {
      try {
        const d = new Date(raw.deadline);
        if (!isNaN(d.getTime())) deadline = d.toISOString();
      } catch {}
    }

    let alarmTime: string | undefined = undefined;
    if (typeof raw.alarmTime === "string" && raw.alarmTime.trim() !== "" && raw.alarmTime.toLowerCase() !== "none") {
      try {
        const a = new Date(raw.alarmTime);
        if (!isNaN(a.getTime())) alarmTime = a.toISOString();
      } catch {}
    }

    let priority: Priority = "Medium";
    if (raw.priority === "High" || raw.priority === "Low") priority = raw.priority;

    const estimatedMinutes = typeof raw.estimatedMinutes === "number" ? Math.max(5, Math.round(raw.estimatedMinutes)) : 30;

    const newTask = db.addTask({
      title,
      deadline,
      alarmTime,
      priority,
      estimatedMinutes,
      status: "pending",
      subtasks: [],
      source: "text"
    });
    addedTasks.push(newTask);
  }

  return addedTasks;
}

export async function extractTasksFromAudio(audioBase64: string, mimeType: string, localTime?: string, localTimeStr?: string): Promise<Task[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const referenceTime = localTime ? new Date(localTime) : new Date();
  const localContext = localTimeStr || referenceTime.toString();

  const response = await generateContentWithRetry(ai, {
    model: "gemini-3.5-flash",
    contents: [
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      },
      "Extract tasks from this spoken voice audio recording."
    ],
    config: {
      systemInstruction: `You are an expert personal productivity assistant. Your task is to transcribe the user's spoken voice audio, understand the things they need to do, and extract actionable tasks.
The user might have background noise, filler words, or disturbances. Ignore these and focus on the intended tasks.
The reference UTC time is ${referenceTime.toISOString()}. The user's local time context is ${localContext}.
Use this to calculate relative deadlines and alarm times.

For each extracted task, determine:
1. title: Clear, concise action-oriented name of the task.
2. deadline: Precise ISO 8601 datetime string representing when the task is due. If no deadline is specified, use "no deadline".
3. alarmTime: An ISO 8601 datetime string for an alarm/reminder. If the user says "remind me at..." or "set an alarm for...", capture that.
   IMPORTANT: If the user says "set an alarm for [time]", prioritize this [time] for alarmTime. Do NOT confuse it with the deadline if they are different.
4. priority: "High", "Medium", or "Low".
5. estimatedMinutes: Integer duration.

IMPORTANT: When the user says "at 5pm" or similar, calculate the ISO 8601 string in UTC, relative to the reference time and user's local offset provided in the context.
Output a strictly formatted JSON array containing only these tasks.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "List of extracted tasks",
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            deadline: { type: Type.STRING },
            alarmTime: { type: Type.STRING },
            priority: { type: Type.STRING },
            estimatedMinutes: { type: Type.INTEGER }
          },
          required: ["title", "deadline", "priority", "estimatedMinutes"]
        }
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response received from Gemini.");
  }

  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  let extractedRawList: any[] = JSON.parse(jsonStr);
  const addedTasks: Task[] = [];
  for (const raw of extractedRawList) {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) continue;

    let deadline = "no deadline";
    if (typeof raw.deadline === "string" && raw.deadline.toLowerCase() !== "no deadline") {
      try {
        const d = new Date(raw.deadline);
        if (!isNaN(d.getTime())) deadline = d.toISOString();
      } catch {}
    }

    let alarmTime: string | undefined = undefined;
    if (typeof raw.alarmTime === "string" && raw.alarmTime.toLowerCase() !== "none") {
      try {
        const a = new Date(raw.alarmTime);
        if (!isNaN(a.getTime())) alarmTime = a.toISOString();
      } catch {}
    }

    let priority: Priority = "Medium";
    if (raw.priority === "High" || raw.priority === "Low") priority = raw.priority;

    const estimatedMinutes = typeof raw.estimatedMinutes === "number" ? Math.max(5, Math.round(raw.estimatedMinutes)) : 30;

    const newTask = db.addTask({
      title,
      deadline,
      alarmTime,
      priority,
      estimatedMinutes,
      status: "pending",
      subtasks: [],
      source: "voice"
    });
    addedTasks.push(newTask);
  }

  return addedTasks;
}
