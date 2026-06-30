import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Clock, Bell, Check, AlertTriangle, Play, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, Mic, MicOff } from "lucide-react";
import { Task, DatabaseState, Priority } from "../types";
import { updateTaskAPI, addTaskAPI } from "../utils/api";

interface DeadlinesCalendarProps {
  state: DatabaseState;
  onStateUpdate: (newState: DatabaseState) => void;
}

export interface CalendarAlarm {
  id: string;
  taskId: string;
  taskTitle: string;
  scheduledTime: string; // ISO string
  alarmTime: string; // ISO string (1 day before)
  triggered: boolean;
}

const LANGUAGES = [
  { code: "en-IN", name: "English (India)" },
  { code: "hi-IN", name: "Hindi (हिंदी)" },
  { code: "ta-IN", name: "Tamil (தமிழ்)" },
  { code: "te-IN", name: "Telugu (తెలుగు)" },
  { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)" },
  { code: "bn-IN", name: "Bengali (বাংলা)" },
  { code: "mr-IN", name: "Marathi (मराठी)" },
  { code: "gu-IN", name: "Gujarati (ગુજરાતી)" }
];

export default function DeadlinesCalendar({ state, onStateUpdate }: DeadlinesCalendarProps) {
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(5); // 0-indexed, default to June (5)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [scheduledHour, setScheduledHour] = useState<string>("10:00");
  const [alarmHour, setAlarmHour] = useState<string>("10:00");
  const [selectedTaskIdsForNewAlarms, setSelectedTaskIdsForNewAlarms] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ id: string; title: string; msg: string } | null>(null);

  // Speech Recognition States
  const [selectedLang, setSelectedLang] = useState("en-IN");
  const [listeningMode, setListeningMode] = useState<"time" | "title" | null>(null);
  const isListening = listeningMode !== null;
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Custom Task Creation State
  const [activeTab, setActiveTab] = useState<"existing" | "custom">("existing");
  const [customTaskTitle, setCustomTaskTitle] = useState("");
  const [customTaskPriority, setCustomTaskPriority] = useState<Priority>("Medium");
  const [customTaskMinutes, setCustomTaskMinutes] = useState(30);

  // Generate 12 months dynamically starting from the current month always
  const getNext12Months = () => {
    const monthsList = [];
    const today = new Date();
    // Use first day of month to avoid overflow issues
    today.setDate(1);
    
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      monthsList.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        name: d.toLocaleDateString("default", { month: "long" }),
      });
    }
    return monthsList;
  };

  const next12Months = getNext12Months();

  // Set default currentMonth and year to match the first available month on mount
  useEffect(() => {
    if (next12Months.length > 0) {
      // Find June 2026 if possible, else default to first month
      const june2026 = next12Months.find(m => m.year === 2026 && m.month === 5);
      if (june2026) {
        setCurrentMonth(5);
        setCurrentYear(2026);
      } else {
        setCurrentMonth(next12Months[0].month);
        setCurrentYear(next12Months[0].year);
      }
    }
  }, []);

  // Web Speech API initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      recognitionRef.current = rec;
    }
  }, []);

  const startListening = (mode: "time" | "title") => {
    if (!recognitionRef.current) return;
    setVoiceError(null);
    setVoiceSuccess(null);
    setListeningMode(mode);

    const recognition = recognitionRef.current;
    recognition.lang = selectedLang;

    recognition.onstart = () => {
      setListeningMode(mode);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setVoiceSuccess(`Spoken: "${transcript}"`);
        if (mode === "title") {
          setCustomTaskTitle(transcript);
        } else {
          // Extract time from speech (e.g., "10:30", "14:15", "4 PM")
          const cleaned = transcript.toLowerCase();
          
          // 1. Matches HH:MM
          const hhmmMatch = cleaned.match(/(\d{1,2})[:.](\d{2})/);
          if (hhmmMatch) {
            let h = parseInt(hhmmMatch[1], 10);
            const m = hhmmMatch[2];
            if (cleaned.includes("pm") && h < 12) h += 12;
            if (cleaned.includes("am") && h === 12) h = 0;
            const hStr = h.toString().padStart(2, "0");
            setScheduledHour(`${hStr}:${m}`);
            setVoiceSuccess(`Speech set time to: ${hStr}:${m}`);
            return;
          }

          // 2. Matches hour like "9 am" or "10 pm"
          const ampmMatch = cleaned.match(/(\d{1,2})\s*(am|pm)/);
          if (ampmMatch) {
            let h = parseInt(ampmMatch[1], 10);
            const ampm = ampmMatch[2];
            if (ampm === "pm" && h < 12) h += 12;
            if (ampm === "am" && h === 12) h = 0;
            const hStr = h.toString().padStart(2, "0");
            setScheduledHour(`${hStr}:00`);
            setVoiceSuccess(`Speech set time to: ${hStr}:00`);
            return;
          }

          // 3. Match any single or double digit and treat as hour
          const digitMatch = cleaned.match(/\b(\d{1,2})\b/);
          if (digitMatch) {
            const h = parseInt(digitMatch[1], 10);
            if (h >= 0 && h <= 23) {
              const hStr = h.toString().padStart(2, "0");
              setScheduledHour(`${hStr}:00`);
              setVoiceSuccess(`Speech set time to: ${hStr}:00`);
              return;
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error(event);
      let friendlyMessage = "Failed to capture speech.";
      if (event.error === "no-speech") {
        friendlyMessage = "No speech detected. Please try again.";
      } else if (event.error === "audio-capture") {
        friendlyMessage = "Microphone is unavailable.";
      } else if (event.error === "not-allowed") {
        friendlyMessage = "Permission denied.";
      }
      setVoiceError(friendlyMessage);
      setListeningMode(null);
    };

    recognition.onend = () => {
      setListeningMode(null);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setListeningMode(null);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
      setListeningMode(null);
    }
  };

  // Synthesizer beep warning sound for urgent alarms
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

  const daysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const startDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const numDays = daysInMonth(currentYear, currentMonth);
  const firstDay = startDayOfWeek(currentYear, currentMonth);

  const monthWeeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  // Pad the first week
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= numDays; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      monthWeeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    monthWeeks.push(currentWeek);
  }

  // Find tasks assigned to a specific date
  const getTasksForDate = (year: number, month: number, day: number) => {
    return state.tasks.filter(t => {
      if (!t.deadline || t.deadline === "no deadline") return false;
      const taskDate = new Date(t.deadline);
      return (
        taskDate.getFullYear() === year &&
        taskDate.getMonth() === month &&
        taskDate.getDate() === day
      );
    });
  };

  const handleDateClick = (day: number) => {
    const clicked = new Date(currentYear, currentMonth, day);
    setSelectedDate(clicked);
    setSelectedTaskIdsForNewAlarms([]);
  };

  const handleStoreAndSetAlarm = async () => {
    if (!selectedDate) return;

    // Parse the scheduled hour (e.g. "10:00")
    const [hours, minutes] = scheduledHour.split(":").map(Number);
    const targetTime = new Date(selectedDate);
    targetTime.setHours(isNaN(hours) ? 10 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);

    // Parse the alarm hour (default to scheduledHour if not specified)
    const [aHours, aMinutes] = alarmHour.split(":").map(Number);
    const alarmTime = new Date(selectedDate);
    alarmTime.setHours(isNaN(aHours) ? hours : aHours, isNaN(aMinutes) ? minutes : aMinutes, 0, 0);

    try {
      let currentTasks = [...state.tasks];

      if (activeTab === "custom") {
        if (!customTaskTitle.trim()) {
          alert("Please type or speak a task title first.");
          return;
        }

        // Create the task on server
        const newTask = await addTaskAPI({
          title: customTaskTitle.trim(),
          priority: customTaskPriority,
          estimatedMinutes: customTaskMinutes || 30,
          source: voiceSuccess && voiceSuccess.includes(customTaskTitle.trim().substring(0, 5)) ? "voice" : "manual",
          deadline: targetTime.toISOString(),
          alarmTime: alarmTime.toISOString()
        });

        // Add to our list
        currentTasks = [newTask, ...currentTasks];
      } else {
        if (selectedTaskIdsForNewAlarms.length === 0) {
          alert("Please select at least one task from the list.");
          return;
        }

        for (const taskId of selectedTaskIdsForNewAlarms) {
          const task = currentTasks.find(t => t.id === taskId);
          if (!task) continue;

          // Store/Update task's deadline with the scheduled time
          const updatedTask = await updateTaskAPI(task.id, {
            deadline: targetTime.toISOString(),
            alarmTime: alarmTime.toISOString(),
            alarmTriggered: false
          });

          // Update local tasks list
          currentTasks = currentTasks.map(t => t.id === task.id ? updatedTask : t);
        }
      }

      // Update full state on App component
      onStateUpdate({
        ...state,
        tasks: currentTasks
      });

      setSelectedDate(null);
      setSelectedTaskIdsForNewAlarms([]);
      setCustomTaskTitle("");
      
      if (activeTab === "custom") {
        alert(`Success! Created and scheduled "${customTaskTitle}" for ${targetTime.toLocaleDateString()} at ${scheduledHour}. Alarm set for ${alarmHour}.`);
      } else {
        alert(`Success! Scheduled ${selectedTaskIdsForNewAlarms.length} task(s) for ${targetTime.toLocaleDateString()} at ${scheduledHour}. Alarms set for ${alarmHour}.`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to assign schedule and alarms.");
    }
  };

  const removeAlarm = async (taskId: string) => {
    try {
      const updatedTask = await updateTaskAPI(taskId, {
        alarmTime: "",
        alarmTriggered: false
      });
      if (updatedTask) {
        onStateUpdate({
          ...state,
          tasks: state.tasks.map(t => t.id === taskId ? updatedTask : t)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Find all month index offsets
  const activeMonthIndex = next12Months.findIndex(m => m.year === currentYear && m.month === currentMonth);

  return (
    <div className="bg-[#0f172a]/50 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-sm space-y-6" id="deadlines-calendar-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-mono font-bold">
            <CalendarIcon className="w-3 h-3" /> 12-MONTH HORIZON
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight font-display">Deadlines Planner Calendar</h3>
          <p className="text-xs text-slate-400">Click a date to schedule a task and set a custom reminder alarm.</p>
        </div>

        {/* Month Selector Carousel Header */}
        <div className="flex items-center gap-2 bg-slate-950/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => {
              if (activeMonthIndex > 0) {
                const prev = next12Months[activeMonthIndex - 1];
                setCurrentMonth(prev.month);
                setCurrentYear(prev.year);
              }
            }}
            disabled={activeMonthIndex <= 0}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-xs font-bold text-white min-w-[120px] text-center">
            {next12Months[activeMonthIndex]?.name} {currentYear}
          </span>

          <button
            onClick={() => {
              if (activeMonthIndex < next12Months.length - 1) {
                const next = next12Months[activeMonthIndex + 1];
                setCurrentMonth(next.month);
                setCurrentYear(next.year);
              }
            }}
            disabled={activeMonthIndex >= next12Months.length - 1}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alarm notification banner */}
      {notification && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 animate-pulse">
          <Bell className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">Scheduled Reminder</h4>
            <p className="text-xs text-slate-200 leading-relaxed">{notification.msg}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left sidebar (month quick access), right Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quick Month Quick Selection list (satisfies "Full Months dates and keep updating") */}
        <div className="lg:col-span-3 space-y-2 border-r border-white/5 pr-4 hidden lg:block">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">12-Month Navigation</span>
          <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500/20 pr-1">
            {next12Months.map((m, idx) => {
              const isSelected = m.month === currentMonth && m.year === currentYear;
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  onClick={() => {
                    setCurrentMonth(m.month);
                    setCurrentYear(m.year);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  <span>{m.name}</span>
                  <span className="text-[10px] font-mono opacity-60">{m.year}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 7-column Monthly Calendar Grid */}
        <div className="lg:col-span-9 space-y-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 font-mono mb-2">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
            {monthWeeks.map((week, wIdx) =>
              week.map((day, dIdx) => {
                if (day === null) {
                  return <div key={`empty-${wIdx}-${dIdx}`} className="aspect-square bg-slate-950/10 rounded-lg opacity-20 border border-white/5"></div>;
                }

                const dayTasks = getTasksForDate(currentYear, currentMonth, day);
                const hasPendingTasks = dayTasks.some(t => t.status === "pending");
                const hasCompletedTasks = dayTasks.length > 0 && dayTasks.every(t => t.status === "done");
                
                const isToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === currentMonth &&
                  new Date().getFullYear() === currentYear;

                const isSelected =
                  selectedDate &&
                  selectedDate.getDate() === day &&
                  selectedDate.getMonth() === currentMonth &&
                  selectedDate.getFullYear() === currentYear;

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => handleDateClick(day)}
                    className={`aspect-[1/1] rounded-lg border p-1 flex flex-col justify-between transition-all cursor-pointer relative group ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-400 text-white scale-[1.03] shadow-md shadow-indigo-600/30"
                        : isToday
                        ? "bg-amber-500 border-amber-400 border-2 text-slate-950 font-bold shadow-[0_0_20px_rgba(245,158,11,0.5)] z-10"
                        : "bg-slate-950/40 border-white/5 text-slate-300 hover:bg-[#1e293b]/40 hover:border-white/10"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className={`text-[10px] font-bold font-mono ${isToday ? 'text-slate-950' : 'text-slate-400'}`}>{day}</span>
                      {isToday && (
                        <div className="flex flex-col items-end">
                          <span className="text-[7px] font-black bg-slate-950 text-amber-500 px-1 rounded-[2px] leading-none py-0.5 shadow-sm">NOW</span>
                        </div>
                      )}
                    </div>

                    {/* Task Indicators */}
                    <div className="flex gap-0.5 justify-center w-full mt-auto">
                      {dayTasks.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.status === "done"
                              ? "bg-emerald-400/80"
                              : t.priority === "High"
                              ? "bg-rose-500"
                              : "bg-indigo-400"
                          }`}
                          title={t.title}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[7px] font-mono leading-none text-slate-500">+</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Date Scheduling popup-style editor inside layout */}
      {selectedDate && (
        <div className="p-5 bg-indigo-950/20 border border-indigo-500/25 rounded-2xl space-y-5 animate-fade-in" id="deadline-schedule-panel">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
              Assign the Tasks — {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h4>
            <button
              onClick={() => {
                setSelectedDate(null);
                setSelectedTaskIdsForNewAlarms([]);
              }}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tab Selector for Task Assignment Method */}
            <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5 gap-1 w-full col-span-1 md:col-span-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("existing");
                  setVoiceError(null);
                  setVoiceSuccess(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "existing"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                Choose Existing Pending Tasks
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("custom");
                  setVoiceError(null);
                  setVoiceSuccess(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "custom"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                Create & Assign Custom Task (Type / Speak 🎙️)
              </button>
            </div>

            {/* Left side: Task choice / custom creation form */}
            <div className="space-y-4">
              {activeTab === "existing" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block font-bold">1. Select Tasks to Assign ({selectedTaskIdsForNewAlarms.length} selected)</label>
                    {state.tasks.filter(t => t.status === "pending").length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allPending = state.tasks.filter(t => t.status === "pending").map(t => t.id);
                          if (selectedTaskIdsForNewAlarms.length === allPending.length) {
                            setSelectedTaskIdsForNewAlarms([]);
                          } else {
                            setSelectedTaskIdsForNewAlarms(allPending);
                          }
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        {selectedTaskIdsForNewAlarms.length === state.tasks.filter(t => t.status === "pending").length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>
                  <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3 max-h-[180px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-indigo-500/20 shadow-inner">
                    {state.tasks.filter(t => t.status === "pending").length === 0 ? (
                      <span className="text-xs text-slate-500 italic block text-center py-4">No pending tasks available to assign today.</span>
                    ) : (
                      state.tasks
                        .filter(t => t.status === "pending")
                        .map(t => {
                          const isChecked = selectedTaskIdsForNewAlarms.includes(t.id);
                          return (
                            <label
                              key={t.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-indigo-500/10 border border-indigo-500/20 text-white"
                                  : "hover:bg-white/[0.02] border border-transparent text-slate-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedTaskIdsForNewAlarms(selectedTaskIdsForNewAlarms.filter(id => id !== t.id));
                                  } else {
                                    setSelectedTaskIdsForNewAlarms([...selectedTaskIdsForNewAlarms, t.id]);
                                  }
                                }}
                                className="rounded border-white/10 text-indigo-600 focus:ring-0 mt-0.5 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-semibold block truncate leading-tight">{t.title}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[9px] font-mono font-bold uppercase px-1 rounded ${
                                    t.priority === "High" ? "bg-rose-500/15 text-rose-400" : t.priority === "Medium" ? "bg-amber-500/15 text-amber-400" : "bg-slate-500/15 text-slate-400"
                                  }`}>
                                    {t.priority} Priority
                                  </span>
                                </div>
                              </div>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 bg-[#0d1527]/50 border border-white/5 rounded-xl p-4">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    New Custom Task Details
                  </h5>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Task Title / Verbal Dictation</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type task title, or click mic to dictate..."
                        value={customTaskTitle}
                        onChange={(e) => setCustomTaskTitle(e.target.value)}
                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 py-2.5 px-3 focus:outline-none focus:border-indigo-500 font-medium"
                      />

                      {isSpeechSupported && (
                        <button
                          type="button"
                          onClick={() => {
                            if (listeningMode === "title") {
                              stopListening();
                            } else {
                              startListening("title");
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                            listeningMode === "title"
                              ? "bg-rose-600/20 border-rose-500 text-rose-400 animate-pulse"
                              : "bg-indigo-600/10 border-indigo-500/25 text-indigo-400 hover:bg-indigo-600/20"
                          }`}
                          title={listeningMode === "title" ? "Stop dictating" : "Dictate task title in selected Indian language"}
                        >
                          {listeningMode === "title" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Priority</label>
                      <select
                        value={customTaskPriority}
                        onChange={(e) => setCustomTaskPriority(e.target.value as Priority)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 py-2 px-2.5 focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="High">🔴 High</option>
                        <option value="Medium">🟡 Medium</option>
                        <option value="Low">🟢 Low</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Est. Minutes</label>
                      <input
                        type="number"
                        min="5"
                        max="480"
                        value={customTaskMinutes}
                        onChange={(e) => setCustomTaskMinutes(parseInt(e.target.value, 10) || 30)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 py-2 px-2.5 focus:outline-none focus:border-indigo-500 font-mono text-center font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Time Configuration (Typed or Voice Input) */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block font-bold">2. Target Scheduled Time</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={scheduledHour}
                    onChange={(e) => {
                      setScheduledHour(e.target.value);
                      setAlarmHour(e.target.value); // Sync alarm by default
                    }}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 py-2.5 px-3 focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
                  />

                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        if (listeningMode === "time") {
                          stopListening();
                        } else {
                          startListening("time");
                        }
                      }}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                        listeningMode === "time"
                          ? "bg-rose-600/20 border-rose-500 text-rose-400 animate-pulse"
                          : "bg-indigo-600/10 border-indigo-500/25 text-indigo-400 hover:bg-indigo-600/20"
                      }`}
                      title={listeningMode === "time" ? "Stop listening" : "Speak time (e.g. 10:30 or 4 PM)"}
                    >
                      {listeningMode === "time" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block font-bold">3. Set Alarm At</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={alarmHour}
                    onChange={(e) => setAlarmHour(e.target.value)}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 py-2.5 px-3 focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
                  />
                  <div className="p-2.5 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-indigo-400">
                    <Bell className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Language Selector & Mic Indicators */}
              {isSpeechSupported && (
                <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">Speech Recognition (India Regional)</span>
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      className="bg-slate-900 border border-white/5 rounded-lg text-[10px] text-slate-400 py-1 px-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Feedback line */}
                  {isListening && (
                    <div className="text-[10px] text-indigo-400 font-medium flex items-center gap-1.5 animate-pulse bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                      <span>
                        {listeningMode === "title" 
                          ? "Speak task details now... Dictated text will auto-fill input." 
                          : "Speak time now (e.g. '10:30' or '4 PM')"
                        }
                      </span>
                    </div>
                  )}

                  {voiceSuccess && (
                    <div className="text-[10px] text-emerald-400 font-mono leading-normal bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                      {voiceSuccess}
                    </div>
                  )}

                  {voiceError && (
                    <div className="text-[10px] text-rose-400 font-mono leading-normal bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10">
                      {voiceError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleStoreAndSetAlarm}
            disabled={activeTab === "existing" ? selectedTaskIdsForNewAlarms.length === 0 : !customTaskTitle.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {activeTab === "custom" 
              ? `Confirm Schedule & Set Alarm for Custom Task: "${customTaskTitle || 'Custom Task'}"` 
              : `Confirm Schedule & Set Alarms for (${selectedTaskIdsForNewAlarms.length}) Task(s)`
            }
          </button>
        </div>
      )}

      {/* Alarms list display */}
      <div className="space-y-3" id="active-alarms-subpanel">
        {(() => {
          const tasksWithAlarms = state.tasks.filter(t => t.alarmTime && t.status === "pending");
          return (
            <>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                Scheduled Task Alarms ({tasksWithAlarms.length})
              </h4>

              {tasksWithAlarms.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No scheduled alarms are active.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tasksWithAlarms.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        task.alarmTriggered
                          ? "bg-slate-950/20 border-white/5 opacity-60"
                          : "bg-indigo-950/10 border-indigo-500/20"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-white block truncate max-w-[200px]">
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>Due: {task.deadline !== "no deadline" ? new Date(task.deadline).toLocaleDateString() : 'N/A'} at {task.deadline !== "no deadline" ? new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-mono">
                          <Bell className="w-3 h-3 text-indigo-400" />
                          <span>Alarm: {task.alarmTime ? new Date(task.alarmTime).toLocaleDateString() : 'N/A'} at {task.alarmTime ? new Date(task.alarmTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {task.alarmTriggered ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            TRIGGERED
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                            ACTIVE
                          </span>
                        )}
                        <button
                          onClick={() => removeAlarm(task.id)}
                          className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer text-xs"
                          title="Delete alarm"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
