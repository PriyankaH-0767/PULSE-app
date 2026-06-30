import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { db } from "./server/db";
import { runPulseAgent } from "./server/agent";
import { extractTasksWithAI, extractTasksFromAudio } from "./server/extractor";
import { generateCoachingInsight } from "./server/coach";
import { transcribeAudio } from "./server/transcribe";
import { askAIAssistant } from "./server/assistant";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON body parsing with increased size limit for audio payloads
app.use(express.json({ limit: "20mb" }));

// API routes mounted FIRST
app.get("/api/db", (req, res) => {
  try {
    res.json({ success: true, data: db.getState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/db/reset", (req, res) => {
  try {
    const state = db.reset();
    res.json({ success: true, data: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/schedule", (req, res) => {
  try {
    const { blocks } = req.body;
    if (!Array.isArray(blocks)) {
      return res.status(400).json({ success: false, error: "Schedule blocks must be an array." });
    }
    db.clearSchedule();
    for (const b of blocks) {
      db.addScheduleBlock({
        timeSlot: b.timeSlot,
        taskId: b.taskId || null,
        label: b.label,
        note: b.note || ""
      });
    }
    res.json({ success: true, data: db.getState().scheduleBlocks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/tasks", (req, res) => {
  try {
    const { title, deadline, alarmTime, priority, estimatedMinutes, source } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: "Task title is required." });
    }
    const task = db.addTask({
      title,
      deadline: deadline || "no deadline",
      alarmTime,
      priority: priority || "Medium",
      estimatedMinutes: Number(estimatedMinutes) || 30,
      status: "pending",
      subtasks: [],
      source: source || "manual"
    });
    res.json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch("/api/tasks/:id", (req, res) => {
  try {
    const { id } = req.params;
    const updated = db.updateTask(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/tasks/:id", (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteTask(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }
    res.json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/habits", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Habit name is required." });
    }
    const habit = db.addHabit({ name });
    res.json({ success: true, data: habit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/habits/:id/log", (req, res) => {
  try {
    const { id } = req.params;
    const updated = db.logHabit(id);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Habit not found." });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/habits/:id", (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteHabit(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Habit not found." });
    }
    res.json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/tasks/extract", async (req, res) => {
  try {
    const { text, localTime, localTimeStr } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ success: false, error: "Messy task text is required." });
    }
    const addedTasks = await extractTasksWithAI(text, localTime, localTimeStr);
    res.json({ success: true, data: addedTasks });
  } catch (err: any) {
    console.error("Task extraction route failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to extract tasks." });
  }
});

app.post("/api/assistant/query", async (req, res) => {
  try {
    const { query, language, localTime, localTimeStr } = req.body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({ success: false, error: "Query is required." });
    }
    const result = await askAIAssistant(query, language || "English", localTime, localTimeStr);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("AI Assistant query failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to process query." });
  }
});

app.post("/api/tasks/extract-audio", async (req, res) => {
  try {
    const { audio, mimeType, localTime, localTimeStr } = req.body;
    if (!audio || typeof audio !== "string") {
      return res.status(400).json({ success: false, error: "Audio data in base64 format is required." });
    }
    if (!mimeType || typeof mimeType !== "string") {
      return res.status(400).json({ success: false, error: "Audio mimeType is required." });
    }
    const addedTasks = await extractTasksFromAudio(audio, mimeType, localTime, localTimeStr);
    res.json({ success: true, data: addedTasks });
  } catch (err: any) {
    console.error("Audio task extraction route failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to extract tasks from audio." });
  }
});

app.post("/api/tasks/transcribe-audio", async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio || typeof audio !== "string") {
      return res.status(400).json({ success: false, error: "Audio data in base64 format is required." });
    }
    if (!mimeType || typeof mimeType !== "string") {
      return res.status(400).json({ success: false, error: "Audio mimeType is required." });
    }
    const transcript = await transcribeAudio(audio, mimeType);
    res.json({ success: true, data: transcript });
  } catch (err: any) {
    console.error("Audio transcription route failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to transcribe audio." });
  }
});

app.patch("/api/db/energy-profile", (req, res) => {
  try {
    const { energyProfile } = req.body;
    if (energyProfile !== "morning" && energyProfile !== "night" && energyProfile !== "steady") {
      return res.status(400).json({ success: false, error: "Invalid energyProfile. Must be morning, night, or steady." });
    }
    const updatedState = db.updateEnergyProfile(energyProfile);
    res.json({ success: true, data: updatedState });
  } catch (err: any) {
    console.error("Failed to update energy profile:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to update energy profile." });
  }
});

app.post("/api/agent/run", async (req, res) => {
  try {
    const runResult = await runPulseAgent();
    res.json({ success: true, data: runResult });
  } catch (err: any) {
    console.error("Pulse Agent route failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to run Pulse Agent." });
  }
});

app.get("/api/coach/insight", async (req, res) => {
  try {
    const insightData = await generateCoachingInsight();
    res.json({ success: true, data: insightData });
  } catch (err: any) {
    console.error("Coaching Insight route failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to generate coaching insight." });
  }
});

import { recommendTransport } from "./server/journey";

app.post("/api/journey/route", async (req, res) => {
  try {
    const { origin, destination } = req.body;
    if (!origin || !destination) {
      return res.status(400).json({ success: false, error: "Origin and destination required" });
    }
    
    // OSRM Public API
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(url);
    if (!osrmRes.ok) {
       return res.status(osrmRes.status).json({ success: false, error: "Routing service unavailable" });
    }
    const data = await osrmRes.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
       return res.status(400).json({ success: false, error: "No route found" });
    }
    
    res.json({ success: true, data: data.routes[0] });
  } catch (err: any) {
    console.error("OSRM route failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to calculate route." });
  }
});

app.post("/api/journey/recommend", async (req, res) => {
  try {
    const { distanceKm, durationSec, minutesUntilDeadline } = req.body;
    if (distanceKm === undefined || durationSec === undefined) {
      return res.status(400).json({ success: false, error: "Distance and duration required" });
    }
    const options = await recommendTransport(distanceKm, durationSec, minutesUntilDeadline);
    res.json({ success: true, data: options });
  } catch (err: any) {
    console.error("Transport recommendation failed:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to recommend transport." });
  }
});

// Setup Vite and static assets serving
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Server] Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Server] Serving static production files from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Pulse Full-Stack App running on http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("[Server] Critical failure during start:", err);
});
