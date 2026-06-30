import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Calendar, Flame, Compass, LayoutDashboard, Brain, AlertTriangle, MapPin } from "lucide-react";
import { Task, Habit, AgentRun, DatabaseState } from "./types";
import { fetchFullState, resetStateOnServer, updateTaskAPI, deleteTaskAPI, addTaskAPI } from "./utils/api";
import TaskGrid from "./components/TaskGrid";
import AddTaskModal from "./components/AddTaskModal";
import PulseAgentView from "./components/PulseAgentView";
import AdaptivePlanner from "./components/AdaptivePlanner";
import ContextCoach from "./components/ContextCoach";
import TaskTimer from "./components/TaskTimer";
import OptionalWellness from "./components/OptionalWellness";
import CaptureStreamAssistant from "./components/CaptureStreamAssistant";
import JourneyPlanner from "./components/JourneyPlanner";
import MapsDashboard from "./components/MapsDashboard";

import { TimerProvider, useTimer } from "./contexts/TimerContext";
import AnalogClock from "./components/AnalogClock";
import TimerWidget from "./components/TimerWidget";
import MomentumDial from "./components/MomentumDial";
import { Bell, FastForward, BellOff, Plus, CheckCircle2, X } from "lucide-react";

export default function App() {
  return (
    <TimerProvider>
      <AppContent />
    </TimerProvider>
  );
}

function AppContent() {
  const { isFinished, taskName, resetTimer, snoozeTimer } = useTimer();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [latestRun, setLatestRun] = useState<AgentRun | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "planner" | "coach" | "journey" | "map">("dashboard");
  const [dbState, setDbState] = useState<DatabaseState | null>(null);
  const [snoozedTaskId, setSnoozedTaskId] = useState<string | null>(null);
  const [journeyTask, setJourneyTask] = useState<Task | null>(null);
  const [viewedJourney, setViewedJourney] = useState<Task | null>(null);
  const [taskFilterTab, setTaskFilterTab] = useState<"all" | "pending" | "high" | "done">("all");
  const [committedAction, setCommittedAction] = useState<string | null>(null);

  const handleCommitAction = (action: string) => {
    setCommittedAction(action);
  };

  const handlePlanJourney = (task: Task) => {
    setJourneyTask(task);
    setActiveTab("journey");
  };

  const handleViewJourney = (task: Task) => {
    setViewedJourney(task);
    setActiveTab("map");
  };

  const getPriority = (deadlineIso: string): "High" | "Medium" | "Low" => {
    const deadline = new Date(deadlineIso);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return "High"; // Today or past
    if (diffDays <= 3) return "Medium"; // Next 3 days
    return "Low"; // Later
  };

  const handleAttachJourney = async (journeyData: any) => {
    try {
      if (journeyTask && journeyData.actionType === 'attach') {
        const updatedTask: Task = {
          ...journeyTask,
          source: `Journey: ${journeyData.distanceKm}km, via ${journeyData.selectedMode}`,
          journeyData,
          transportationMode: journeyData.selectedMode,
          alarmTime: journeyData.alarmTime || journeyTask.alarmTime,
          alarmTriggered: false,
          plannedAt: new Date().toISOString()
        };
        await updateTaskAPI(updatedTask.id, { 
          source: updatedTask.source, 
          journeyData: updatedTask.journeyData,
          transportationMode: updatedTask.transportationMode,
          alarmTime: updatedTask.alarmTime,
          alarmTriggered: false,
          plannedAt: updatedTask.plannedAt
        });
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      } else {
        // Create new task
        const newTask = await addTaskAPI({
          title: `Journey to ${journeyData.destination.name.split(',')[0]}`,
          deadline: journeyData.arriveBy || journeyData.departAt || new Date().toISOString(),
          priority: getPriority(journeyData.arriveBy || journeyData.departAt || new Date().toISOString()),
          estimatedMinutes: Math.ceil(journeyData.durationSec / 60),
          source: `Journey: ${journeyData.distanceKm}km, via ${journeyData.selectedMode}`,
          journeyData,
          transportationMode: journeyData.selectedMode,
          alarmTime: journeyData.alarmTime,
          plannedAt: new Date().toISOString()
        });
        setTasks(prev => [newTask, ...prev]);
      }
      
      // Navigate back to dashboard and clear journey state
      setActiveTab("dashboard");
      setJourneyTask(null);
      
      // Visual feedback
      alert("Journey successfully saved to your schedule! You can see it in your dashboard.");
    } catch (err) {
      console.error("Save journey error:", err);
      alert("Failed to save journey. Please check your connection.");
    }
  };

  // Find tasks with active alarms (now >= alarmTime and not yet triggered)
  const activeAlarmTask = tasks.find(t => 
    t.status === "pending" && 
    t.alarmTime && 
    !t.alarmTriggered && 
    new Date() >= new Date(t.alarmTime)
  );

  // Synthesizer beep warning sound for alarms
  const playAlarmSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playBeep = (delay: number, frequency: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
        
        gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration - 0.05);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };

      // Play 3 high-pitched double warning beep signals
      playBeep(0, 980, 0.15);
      playBeep(0.2, 980, 0.15);
      playBeep(0.5, 980, 0.15);
      playBeep(0.7, 980, 0.3);
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  // Periodic alarm sound playing while an active alarm is displayed
  useEffect(() => {
    if (!activeAlarmTask || snoozedTaskId === activeAlarmTask.id) return;

    // Play once immediately
    playAlarmSound();

    const soundInterval = setInterval(() => {
      playAlarmSound();
    }, 8000);

    return () => clearInterval(soundInterval);
  }, [activeAlarmTask?.id, snoozedTaskId]);

  async function handleDismissAlarm(taskId: string) {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, alarmTriggered: true } : t));
      await updateTaskAPI(taskId, { alarmTriggered: true });
    } catch (err) {
      console.error(err);
    }
  }

  // Check for live recommendations
  const [liveRecommendation, setLiveRecommendation] = useState<{ taskId: string, message: string } | null>(null);

  useEffect(() => {
    const checkJourneys = async () => {
      const now = new Date();
      // Find journey tasks planned > 1 day ago and starting soon
      const soonJourneys = tasks.filter(t => 
        t.status === "pending" && 
        t.journeyData && 
        t.plannedAt && 
        (now.getTime() - new Date(t.plannedAt).getTime() > 24 * 60 * 60 * 1000)
      );

      for (const t of soonJourneys) {
        if (t.deadline && t.deadline !== "no deadline") {
          const arrival = new Date(t.deadline);
          const durationSec = t.journeyData.durationSec || 0;
          // Est. departure based on original duration + buffer
          const departure = new Date(arrival.getTime() - (durationSec * 1000) - (15 * 60 * 1000));

          const diffMins = (departure.getTime() - now.getTime()) / (1000 * 60);
          // If within 30 mins of departure and we haven't shown a recommendation for this task yet
          if (diffMins > 0 && diffMins < 30 && liveRecommendation?.taskId !== t.id) {
            try {
              const now = new Date();
              const res = await fetch("/api/assistant/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  query: `I planned a journey to ${t.journeyData.destination.name} via ${t.transportationMode} more than 24 hours ago. It's almost departure time. Provide a live recommendation: is there a better/faster way to reach as soon as possible given current traffic conditions? Keep it short and actionable.`,
                  language: "English",
                  localTime: now.toISOString(),
                  localTimeStr: now.toLocaleString()
                })
              });
              const json = await res.json();
              if (json.success) {
                setLiveRecommendation({ taskId: t.id, message: json.data });
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
    };

    const interval = setInterval(checkJourneys, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [tasks, liveRecommendation?.taskId]);

  // Sync state on initialization
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const fullState = await fetchFullState();
        
        setDbState(fullState);
        setTasks(fullState.tasks || []);
        setHabits(fullState.habits || []);
        if (fullState.agentRuns && fullState.agentRuns.length > 0) {
          setLatestRun(fullState.agentRuns[0]);
        } else if (fullState.scheduleBlocks && fullState.scheduleBlocks.length > 0) {
          const mockRun: AgentRun = {
            id: "initial_setup",
            timestamp: new Date().toISOString(),
            summary: "Active schedules and alerts constructed on the server.",
            actionLog: [],
            scheduleBlocks: fullState.scheduleBlocks,
            urgentAlerts: fullState.urgentAlerts,
            habitNudges: fullState.habitNudges
          };
          setLatestRun(mockRun);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  function handleStateUpdate(newState: DatabaseState) {
    setDbState(newState);
    setTasks(newState.tasks || []);
    setHabits(newState.habits || []);
    if (newState.agentRuns && newState.agentRuns.length > 0) {
      setLatestRun(newState.agentRuns[0]);
    } else if (newState.scheduleBlocks && newState.scheduleBlocks.length > 0) {
      const mockRun: AgentRun = {
        id: "updated_setup",
        timestamp: new Date().toISOString(),
        summary: "Active schedules and alerts constructed on the server.",
        actionLog: [],
        scheduleBlocks: newState.scheduleBlocks,
        urgentAlerts: newState.urgentAlerts,
        habitNudges: newState.habitNudges
      };
      setLatestRun(mockRun);
    } else {
      setLatestRun(null);
    }
  }

  async function handleResetData() {
    setIsResetting(true);
    try {
      const freshState = await resetStateOnServer();
      handleStateUpdate(freshState);
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  }

  // Task events
  async function handleToggleStatus(id: string, currentStatus: "pending" | "done") {
    const nextStatus = currentStatus === "pending" ? "done" : "pending";
    try {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
      await updateTaskAPI(id, { status: nextStatus });
    } catch (err) {
      console.error(err);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: currentStatus } : t));
    }
  }

  async function handleToggleSubtask(taskId: string, subtaskIndex: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIndex] = {
      ...updatedSubtasks[subtaskIndex],
      done: !updatedSubtasks[subtaskIndex].done
    };

    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
      await updateTaskAPI(taskId, { subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: task.subtasks } : t));
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      setTasks(prev => prev.filter(t => t.id !== id));
      await deleteTaskAPI(id);
    } catch (err) {
      console.error(err);
    }
  }

  function handleTasksAdded(newTasks: Task[]) {
    setTasks(prev => [...newTasks, ...prev]);
  }

  // Agent run complete
  function handleAgentRunComplete(run: AgentRun) {
    setLatestRun(run);
    fetchFullState().then(full => {
      setTasks(full.tasks || []);
      setHabits(full.habits || []);
    });
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans antialiased overflow-x-hidden" id="pulse-app-root">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#020617]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-600/30 border border-white/10">
              <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
            </div>
            <span className="text-2xl font-black tracking-tighter text-white font-display uppercase italic leading-none">PULSE</span>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 ml-6">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "dashboard" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("planner")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "planner" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Adaptive Planner
            </button>
            <button
              onClick={() => setActiveTab("coach")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "coach" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Context Coach
            </button>
            <button
              onClick={() => setActiveTab("journey")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "journey" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Journey
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "map" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Map
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8">
          <button
            onClick={handleResetData}
            disabled={isResetting}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 font-mono"
            title="Reset to defaults"
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`} />
            Reset Data
          </button>

          <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300" title="priyankah.4767@gmail.com">
            P
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:px-8 space-y-6">
        {/* 🚀 LIVE JOURNEY RECOMMENDATION */}
        {liveRecommendation && (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                   <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-1">
                   <div className="flex items-center justify-between">
                     <h4 className="text-sm font-bold text-white flex items-center gap-2">
                       Live Journey Update
                       <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                     </h4>
                     <button onClick={() => setLiveRecommendation(null)} className="text-slate-500 hover:text-white transition-colors">
                       <X className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="text-xs text-slate-300 leading-relaxed">
                     {liveRecommendation.message}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* 🚨 TOP SCHEDULED ALARM BANNER */}
        {activeAlarmTask && (activeTab === "dashboard" || activeTab === "coach") && snoozedTaskId !== activeAlarmTask.id && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-500 bg-gradient-to-r from-indigo-950/80 via-blue-950/75 to-slate-950 p-5 shadow-2xl shadow-indigo-500/20 animate-pulse-subtle">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 rounded-full bg-indigo-500/20 blur-2xl"></div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shrink-0">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      SCHEDULED ALARM ACTIVE
                    </span>
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    Alarm: "{activeAlarmTask.title}"
                  </h4>
                  <p className="text-xs text-slate-300">
                    This task was scheduled with an alarm for <span className="font-semibold text-indigo-300 font-mono">{activeAlarmTask.alarmTime ? new Date(activeAlarmTask.alarmTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}</span>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    // Play alarm sound
                    playAlarmSound();
                    
                    // Scroll to task card if on dashboard
                    if (activeTab === "dashboard") {
                      const el = document.getElementById(`task-card-${activeAlarmTask.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-2", "ring-indigo-500", "ring-offset-2", "ring-offset-slate-950");
                        setTimeout(() => {
                          el.classList.remove("ring-2", "ring-indigo-500", "ring-offset-2", "ring-offset-slate-950");
                        }, 4000);
                      }
                    } else {
                      alert(`Scheduled Alarm: "${activeAlarmTask.title}"`);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-lg transition-all shadow-lg shadow-indigo-600/30 cursor-pointer animate-pulse"
                >
                  View ⏰
                </button>
                
                <button
                  onClick={() => handleDismissAlarm(activeAlarmTask.id)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs rounded-lg transition-all cursor-pointer"
                >
                  Dismiss Alarm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Tab Selector */}
        <div className="flex md:hidden items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 w-full">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "dashboard" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("planner")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "planner" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Planner
          </button>
          <button
            onClick={() => setActiveTab("coach")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "coach" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            Coach
          </button>
          <button
            onClick={() => setActiveTab("journey")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "journey" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Journey
          </button>
        </div>

        {isLoading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-xs text-slate-500 font-mono">Initializing Command Center State...</p>
          </div>
        ) : activeTab === "journey" ? (
          <JourneyPlanner 
            initialDeadline={journeyTask?.deadline !== "no deadline" ? journeyTask?.deadline : undefined}
            initialOrigin={journeyTask?.journeyData?.origin}
            initialDestination={journeyTask?.journeyData?.destination}
            onAttachToTask={handleAttachJourney}
          />
        ) : activeTab === "map" ? (
          <MapsDashboard 
            initialOrigin={viewedJourney?.journeyData?.origin?.name} 
            initialDestination={viewedJourney?.journeyData?.destination?.name}
          />
        ) : activeTab === "planner" ? (
          <AdaptivePlanner
            state={dbState || {
              tasks: tasks,
              habits: habits,
              scheduleBlocks: [],
              urgentAlerts: [],
              habitNudges: [],
              agentRuns: [],
              energyProfile: "steady"
            }}
            onStateUpdate={handleStateUpdate}
            latestRunBlocks={latestRun ? latestRun.scheduleBlocks : []}
          />
        ) : activeTab === "coach" ? (
          <ContextCoach 
            tasks={tasks} 
            latestRun={latestRun} 
            onRunComplete={handleAgentRunComplete} 
            onTasksAdded={handleTasksAdded} 
            onCommitAction={handleCommitAction}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Metrics & Tasks (col-span 8) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium text-white font-display">Focus Directives</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">Optimized agenda autonomously by the Life Saver</p>
                </div>
                <div className="shrink-0 flex items-center gap-4">
                  <MomentumDial 
                    completedCount={tasks.filter(t => t.status === "done").length}
                    totalCount={tasks.length}
                  />
                  <AnalogClock />
                </div>
              </div>

              {/* Committed Action Card */}
              {committedAction && (
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-3xl p-5 shadow-xl shadow-emerald-500/5 animate-slide-up">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" />
                      Active Commitment
                    </span>
                    <button 
                      onClick={() => setCommittedAction(null)}
                      className="text-[10px] text-slate-500 hover:text-slate-300 font-mono transition-colors"
                    >
                      Clear Commitment
                    </button>
                  </div>
                  <h3 className="text-base font-bold text-white font-display leading-tight">
                    {committedAction}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">
                    This high-impact micro-step is currently prioritized to unlock your next flow state.
                  </p>
                </div>
              )}

              {/* Task Filter and Quick Add Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0f172a]/40 p-4 rounded-2xl border border-white/5 shadow-lg backdrop-blur-sm">
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {(["all", "pending", "high", "done"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setTaskFilterTab(tab)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer border ${
                        taskFilterTab === tab
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]"
                          : "border-indigo-500/20 text-indigo-400 hover:text-white hover:bg-indigo-500/10 hover:border-indigo-500/40"
                      }`}
                    >
                      {tab === "high" ? "High Priority" : tab}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xl shadow-indigo-500/15 hover:shadow-indigo-500/25 cursor-pointer hover:scale-[1.03] active:scale-95"
                >
                  <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                  Add Task
                </button>
              </div>

              <TaskGrid
                tasks={tasks}
                activeTab={taskFilterTab}
                onToggleStatus={handleToggleStatus}
                onToggleSubtask={handleToggleSubtask}
                onDelete={handleDeleteTask}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onPlanJourney={handlePlanJourney}
                onViewJourney={handleViewJourney}
              />

              {/* NEW SECTION: Task Timer */}
              <TaskTimer />
            </div>

            {/* Right Column: Unified Wellness, Habits stream, and AI Capture Stream Assistant */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <CaptureStreamAssistant />
              
              <OptionalWellness 
                habits={habits}
                onHabitsUpdated={setHabits}
                onHabitDeleted={(id) => setHabits(prev => prev.filter(h => h.id !== id))}
              />
            </div>
          </div>
        )}
      </main>

      {/* Bottom Bar (Clean Footer always visible and steady, no blinking notification) */}
      <footer className="px-6 md:px-8 py-4 bg-[#020617] border-t border-white/5 flex items-center justify-between sticky bottom-0 z-40 backdrop-blur-md text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
          <span>PULSE • LAST-MINUTE LIFE SAVER</span>
        </div>
        <span>© {new Date().getFullYear()} PULSE</span>
      </footer>

      {/* Global Timer Alarm Notification */}
      <TimerWidget />
      {isFinished && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pointer-events-none">
          <div className="bg-rose-600 text-white rounded-2xl shadow-2xl shadow-rose-900/50 p-6 max-w-md w-full pointer-events-auto border border-white/20 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white/20 p-3 rounded-xl animate-bounce">
                <Bell className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest opacity-80">Time's Up!</h4>
                <p className="text-xl font-bold leading-tight">{taskName || "Focus Task"}</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => snoozeTimer(5)}
                className="flex-1 bg-white text-rose-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors"
              >
                <FastForward className="w-4 h-4" /> SNOOZE 5M
              </button>
              <button 
                onClick={resetTimer}
                className="flex-1 bg-rose-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-rose-800 transition-colors"
              >
                <BellOff className="w-4 h-4" /> TURN OFF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTasksAdded={handleTasksAdded}
      />
    </div>
  );
}
