export type Priority = "High" | "Medium" | "Low";
export type TaskSource = "manual" | "text" | "voice" | "agent";
export type TaskStatus = "pending" | "done";
export type EnergyProfile = "morning" | "night" | "steady";

export interface SubTask {
  step: string;
  estimatedMinutes: number;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO datetime string or "no deadline"
  priority: Priority;
  estimatedMinutes: number;
  status: TaskStatus;
  alarmTime?: string; // ISO datetime string or undefined
  alarmTriggered?: boolean;
  subtasks: SubTask[];
  source: TaskSource | string;
  journeyData?: any;
  transportationMode?: string;
  plannedAt?: string;
}

export interface Habit {
  id: string;
  name: string;
  currentStreak: number;
  lastLoggedDate: string | null; // "YYYY-MM-DD" or null
}

export interface ScheduleBlock {
  id: string;
  timeSlot: string; // e.g. "9:00 AM - 10:30 AM"
  taskId: string | null;
  label: string;
  note: string;
}

export interface ActionLogItem {
  tool: string;
  args: any;
  resultSummary: string;
}

export interface UrgentAlert {
  id: string;
  taskId: string;
  taskTitle: string;
  message: string;
}

export interface HabitNudge {
  id: string;
  habitName: string;
  message: string;
}

export interface AgentRun {
  id: string;
  timestamp: string;
  summary: string;
  actionLog: ActionLogItem[];
  scheduleBlocks: ScheduleBlock[];
  urgentAlerts: UrgentAlert[];
  habitNudges: HabitNudge[];
}

export interface DatabaseState {
  tasks: Task[];
  habits: Habit[];
  scheduleBlocks: ScheduleBlock[];
  urgentAlerts: UrgentAlert[];
  habitNudges: HabitNudge[];
  agentRuns: AgentRun[];
  energyProfile: EnergyProfile;
}
