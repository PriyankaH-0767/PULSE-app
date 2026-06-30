import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { generateContentWithRetry } from "./gemini";
import { db } from "./db";
import { AgentRun, ActionLogItem, ScheduleBlock, UrgentAlert, HabitNudge } from "../src/types";

// Setup tools declarations according to @google/genai
const getCurrentTimeTool: FunctionDeclaration = {
  name: "getCurrentTime",
  description: "Returns the current date and time in ISO format and a friendly string. Essential to find current context and calculate deadlines.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const getPendingTasksTool: FunctionDeclaration = {
  name: "getPendingTasks",
  description: "Returns all tasks that are currently pending. Includes fields like title, priority, deadline, estimatedMinutes, subtasks, and source.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const getHabitStatusTool: FunctionDeclaration = {
  name: "getHabitStatus",
  description: "Returns all habits with their current streak counts and whether they have been logged today.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const setTaskPriorityTool: FunctionDeclaration = {
  name: "setTaskPriority",
  description: "Updates the priority of a specific task in the database based on urgency or deadline proximity.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: {
        type: Type.STRING,
        description: "The unique ID of the task."
      },
      newPriority: {
        type: Type.STRING,
        description: "The new priority level. Must be 'High', 'Medium', or 'Low'."
      },
      reason: {
        type: Type.STRING,
        description: "The reason for re-prioritizing the task."
      }
    },
    required: ["taskId", "newPriority", "reason"]
  }
};

const addScheduleBlockTool: FunctionDeclaration = {
  name: "addScheduleBlock",
  description: "Adds a chronological block of time to today's schedule. The schedule is empty at the start of a run, so call this multiple times to build a complete daily plan.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      timeSlot: {
        type: Type.STRING,
        description: "The time slot description, e.g. '9:00 AM - 10:30 AM', '2:00 PM - 3:00 PM'."
      },
      taskId: {
        type: Type.STRING,
        description: "The optional ID of the task linked to this schedule block. Can be null."
      },
      label: {
        type: Type.STRING,
        description: "Main activity title (e.g. 'Work on Slides', 'Lunch Break', 'Focus Block: Project Alpha')."
      },
      note: {
        type: Type.STRING,
        description: "A short, helpful reminder or context note for this schedule block."
      }
    },
    required: ["timeSlot", "label", "note"]
  }
};

const createUrgentAlertTool: FunctionDeclaration = {
  name: "createUrgentAlert",
  description: "Raises a high-visibility, red-accented notification for a task in jeopardy of missing its deadline or requiring urgent attention.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: {
        type: Type.STRING,
        description: "The unique ID of the task that requires an alert."
      },
      message: {
        type: Type.STRING,
        description: "Specific urgent warning warning explanation."
      }
    },
    required: ["taskId", "message"]
  }
};

const suggestHabitNudgeTool: FunctionDeclaration = {
  name: "suggestHabitNudge",
  description: "Logs an encouraging nudge for a habit that has not yet been logged today, helping the user maintain a streak.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      habitName: {
        type: Type.STRING,
        description: "The exact name of the habit."
      },
      message: {
        type: Type.STRING,
        description: "Personalized motivational prompt tailored to their current streak status."
      }
    },
    required: ["habitName", "message"]
  }
};

const tools = [
  {
    functionDeclarations: [
      getCurrentTimeTool,
      getPendingTasksTool,
      getHabitStatusTool,
      setTaskPriorityTool,
      addScheduleBlockTool,
      createUrgentAlertTool,
      suggestHabitNudgeTool
    ]
  }
];

const SYSTEM_INSTRUCTION = `You are an autonomous productivity assistant named "The Last-Minute Life Saver Agent" with direct tools to read and modify the user's tasks, schedule, and habits. Given the instruction 'review my day and take useful action,' you must follow this exact sequential strategy:
1. Call getCurrentTime to establish the current date, day, and hour.
2. Call getPendingTasks and getHabitStatus to retrieve the user's current situation.
3. Decide which tasks are mis-prioritized (e.g., has a High priority but deadline is far away, or is Low priority but deadline is in 2 hours!) and fix them by calling setTaskPriority based on deadline urgency.
4. Build a clean, same-day schedule by calling addScheduleBlock once per block in chronological order (e.g., morning blocks, lunch block, afternoon blocks, evening blocks). You should build a full day of 4 to 8 schedule blocks covering essential tasks and breaks to rescue their schedule.
5. Raise createUrgentAlert for any genuinely at-risk tasks (e.g. High priority and deadline is extremely close, or overdue), explaining exactly why it is critical.
6. Call suggestHabitNudge for general routines/habits not yet logged today, especially those with active streaks to maintain consistency.

Call tools repeatedly — do not stop after one call. Execute tools sequentially or in parallel batches where appropriate.
When you are fully finished with all actions, respond with a short 4-6 sentence summary of what you did and why, explaining how you rescued their day and protected their deadlines.
Be highly confident, professional, and clear. Do not use conversational filler or emojis in your final summary. Let the actions speak for themselves.`;

export async function runPulseAgent(): Promise<AgentRun> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Please add it via the Settings secrets panel.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const actionLog: ActionLogItem[] = [];

  // Clear previous schedules, alerts and nudges before running the agent to avoid old/duplicate plans
  db.clearSchedule();
  db.clearUrgentAlerts();
  db.clearHabitNudges();

  // Create conversation history array
  const contents: any[] = [
    {
      role: "user",
      parts: [{ text: "review my day and take useful action" }]
    }
  ];

  let iterations = 0;
  const maxIterations = 15;
  let summary = "";

  while (iterations < maxIterations) {
    iterations++;
    console.log(`[Pulse Agent] Iteration ${iterations}...`);

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: tools,
        temperature: 0.2 // Lower temp for highly reliable tool execution
      }
    });

    // Add model candidate content to history to maintain conversational/action state
    const candidateContent = response.candidates?.[0]?.content;
    if (candidateContent) {
      contents.push(candidateContent);
    }

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      // Model did not return any more function calls. It's finished.
      summary = response.text || "The Last-Minute Life Saver Agent has successfully evaluated your day and generated a deadline-safe schedule.";
      break;
    }

    // Process all function calls returned in this turn
    const responseParts: any[] = [];

    for (const call of functionCalls) {
      const callName = call.name;
      const callArgs = call.args as Record<string, any>;
      const callId = call.id;

      console.log(`[Pulse Agent] Executing Tool: ${callName} with args:`, callArgs);

      let result: any;
      let resultSummary = "";

      try {
        switch (callName) {
          case "getCurrentTime": {
            const now = new Date();
            // Since we are in the backend, let's also pass the local current time provided in ADDITIONAL_METADATA if any
            // For general context, we can write a nice message:
            result = {
              iso: now.toISOString(),
              localTimeString: now.toLocaleTimeString(),
              localDateString: now.toLocaleDateString(),
              note: "The current date is " + now.toDateString() + " and time is " + now.toLocaleTimeString()
            };
            resultSummary = `Retrieved system clock: ${now.toLocaleTimeString()}`;
            break;
          }
          case "getPendingTasks": {
            const pendingTasks = db.getState().tasks.filter(t => t.status === "pending");
            result = { tasks: pendingTasks };
            resultSummary = `Retrieved ${pendingTasks.length} pending tasks`;
            break;
          }
          case "getHabitStatus": {
            const habits = db.getState().habits;
            result = { habits: habits };
            resultSummary = `Retrieved ${habits.length} habits with streak statuses`;
            break;
          }
          case "setTaskPriority": {
            const { taskId, newPriority, reason } = callArgs;
            if (newPriority !== "High" && newPriority !== "Medium" && newPriority !== "Low") {
              throw new Error("Invalid priority level. Must be 'High', 'Medium', or 'Low'.");
            }
            const updated = db.updateTask(taskId, { priority: newPriority as any });
            if (updated) {
              result = { success: true, task: updated };
              resultSummary = `Updated priority of task "${updated.title}" to ${newPriority}. Reason: ${reason}`;
            } else {
              result = { success: false, error: `Task with id ${taskId} was not found.` };
              resultSummary = `Attempted to prioritize task (${taskId}) but task was not found`;
            }
            break;
          }
          case "addScheduleBlock": {
            const { timeSlot, taskId, label, note } = callArgs;
            const block = db.addScheduleBlock({
              timeSlot,
              taskId: taskId || null,
              label,
              note
            });
            result = { success: true, block };
            resultSummary = `Created schedule block "${label}" at ${timeSlot}`;
            break;
          }
          case "createUrgentAlert": {
            const { taskId, message } = callArgs;
            const task = db.getState().tasks.find(t => t.id === taskId);
            const title = task ? task.title : "Unknown Task";
            const alert = db.addUrgentAlert({
              taskId,
              taskTitle: title,
              message
            });
            result = { success: true, alert };
            resultSummary = `Raised red alert for "${title}": ${message}`;
            break;
          }
          case "suggestHabitNudge": {
            const { habitName, message } = callArgs;
            const nudge = db.addHabitNudge({
              habitName,
              message
            });
            result = { success: true, nudge };
            resultSummary = `Logged active nudge for "${habitName}": ${message}`;
            break;
          }
          default:
            throw new Error(`Unknown tool name: ${callName}`);
        }
      } catch (err: any) {
        console.error(`[Pulse Agent] Error executing tool ${callName}:`, err);
        result = { error: err.message || "Execution failed" };
        resultSummary = `Failed to run tool ${callName}: ${err.message}`;
      }

      // Add to action log
      actionLog.push({
        tool: callName,
        args: callArgs,
        resultSummary
      });

      // Append function response parts
      responseParts.push({
        functionResponse: {
          name: callName,
          response: result,
          id: callId
        }
      });
    }

    // Push the responses as the next turn
    contents.push({
      role: "user",
      parts: responseParts
    });
  }

  // Finalize AgentRun state
  const runResult: AgentRun = {
    id: "run_" + Date.now().toString(),
    timestamp: new Date().toISOString(),
    summary: summary || "The Last-Minute Life Saver Agent completed reviewing your day and secured your deadlines.",
    actionLog,
    scheduleBlocks: db.getState().scheduleBlocks,
    urgentAlerts: db.getState().urgentAlerts,
    habitNudges: db.getState().habitNudges
  };

  db.addAgentRun(runResult);
  return runResult;
}
