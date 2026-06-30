import React, { useState } from "react";
import { Sunrise, Moon, Activity, CheckCircle2, Save, Clock, Brain, Compass, Sparkles, Check, Calendar, AlertCircle } from "lucide-react";
import { DatabaseState, ScheduleBlock, EnergyProfile } from "../types";
import { updateEnergyProfileAPI, updateTaskAPI } from "../utils/api";
import DeadlinesCalendar from "./DeadlinesCalendar";

interface AdaptivePlannerProps {
  state: DatabaseState;
  onStateUpdate: (newState: DatabaseState) => void;
  latestRunBlocks: ScheduleBlock[];
}

export default function AdaptivePlanner({ state, onStateUpdate, latestRunBlocks }: AdaptivePlannerProps) {
  const currentProfile = state.energyProfile || "steady";
  const [selectedProfile, setSelectedProfile] = useState<EnergyProfile>(currentProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isApplyingShifts, setIsApplyingShifts] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  // Active schedule blocks to display
  const blocks = latestRunBlocks.length > 0 ? latestRunBlocks : state.scheduleBlocks;

  async function handleGraphTaskClick(taskId: string, currentStatus: "pending" | "done") {
    try {
      const nextStatus = currentStatus === "done" ? "pending" : "done";
      
      // 1. Reactive state update for immediate UI response
      const updatedTasks = state.tasks.map(t =>
        t.id === taskId ? { ...t, status: nextStatus as "pending" | "done" } : t
      );
      onStateUpdate({
        ...state,
        tasks: updatedTasks
      });

      // 2. Persist the database update
      await updateTaskAPI(taskId, { status: nextStatus });

      // 3. Smoothly navigate/scroll to the completed tasks list block if completed
      if (nextStatus === "done") {
        setTimeout(() => {
          const completedPanel = document.getElementById("completed-tasks-subpanel");
          if (completedPanel) {
            completedPanel.scrollIntoView({ behavior: "smooth", block: "center" });
            completedPanel.classList.add("ring-2", "ring-emerald-500/50", "ring-offset-2", "ring-offset-slate-950");
            setTimeout(() => {
              completedPanel.classList.remove("ring-2", "ring-emerald-500/50", "ring-offset-2", "ring-offset-slate-950");
            }, 2000);
          }
        }, 300);
      }
    } catch (err) {
      console.error("Failed to toggle task from graph", err);
    }
  }

  // Get dynamic current month name and dates
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const todayDay = today.getDate();
  const currentMonthName = today.toLocaleString("default", { month: "long" }).toUpperCase();
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const getTaskHourInfo = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return {
        hours: d.getHours(),
        minutes: d.getMinutes(),
        label: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
    } catch {
      return { hours: 12, minutes: 0, label: "12:00 PM" };
    }
  };

  const isTodayDate = (isoString: string) => {
    if (!isoString || isoString === "no deadline") return false;
    try {
      const d = new Date(isoString);
      const t = new Date();
      return (
        d.getFullYear() === t.getFullYear() &&
        d.getMonth() === t.getMonth() &&
        d.getDate() === t.getDate()
      );
    } catch {
      return false;
    }
  };

  const isTaskInCurrentMonth = (isoString: string) => {
    if (!isoString || isoString === "no deadline") return false;
    try {
      const d = new Date(isoString);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    } catch {
      return false;
    }
  };

  // Retrieve all tasks for the current month
  const monthTasks = state.tasks.filter(t => t.deadline && isTaskInCurrentMonth(t.deadline));

  // Group tasks of this month by day of month
  const tasksByDay: { [day: number]: typeof state.tasks } = {};
  monthTasks.forEach(t => {
    try {
      const d = new Date(t.deadline);
      const dayNum = d.getDate();
      if (!tasksByDay[dayNum]) {
        tasksByDay[dayNum] = [];
      }
      tasksByDay[dayNum].push(t);
    } catch {}
  });

  const activeDays = Object.keys(tasksByDay).map(Number).sort((a, b) => a - b);
  // Ensure the present day is always present on the monthly view graph
  const daysToPlot = Array.from(new Set([...activeDays, todayDay])).sort((a, b) => a - b);

  // Spaced out X-coordinate logic for days in the graph (evenly spaced for active/present days)
  const getXForIndex = (index: number, total: number) => {
    if (total <= 1) return 300;
    const minX = 65;
    const maxX = 535;
    const percentage = index / (total - 1);
    return minX + percentage * (maxX - minX);
  };

  const selectedDayTasks = tasksByDay[selectedDay] || [];
  const completedSelectedTasks = selectedDayTasks.filter(t => t.status === "done");
  const pendingSelectedTasks = selectedDayTasks.filter(t => t.status === "pending");

  const profiles = [
    {
      id: "morning" as EnergyProfile,
      name: "Morning Person",
      icon: Sunrise,
      description: "Front-loads complex cognitive tasks early in the morning when mental reserves are at their peak.",
      focusPeak: "8:00 AM - 12:00 PM",
      color: "from-amber-500/20 to-orange-600/20 border-amber-500/30 text-amber-400 animate-pulse-subtle",
      hoverColor: "hover:border-amber-400/50",
      activeBorder: "border-amber-500 ring-2 ring-amber-500/20",
      pillBg: "bg-amber-500/10 text-amber-400",
      focusZoneText: "Peak Focus Slot",
      quote: "Win the morning, conquer the day."
    },
    {
      id: "night" as EnergyProfile,
      name: "Night Owl",
      icon: Moon,
      description: "Shifts core deep-work focus windows to late afternoon and evening when creative flow hits its stride.",
      focusPeak: "4:00 PM - 10:00 PM",
      color: "from-indigo-500/20 to-purple-600/20 border-indigo-500/30 text-indigo-400",
      hoverColor: "hover:border-indigo-400/50",
      activeBorder: "border-indigo-500 ring-2 ring-indigo-500/20",
      pillBg: "bg-indigo-500/10 text-indigo-400",
      focusZoneText: "Creative Midnight Flow",
      quote: "Creativity thrives under moonlight."
    },
    {
      id: "steady" as EnergyProfile,
      name: "Steady Pacer",
      icon: Activity,
      description: "Distributes energy evenly across a standard daylight routine with paced intervals and deliberate pauses.",
      focusPeak: "10:00 AM - 4:00 PM",
      color: "from-teal-500/20 to-emerald-600/20 border-teal-500/30 text-teal-400",
      hoverColor: "hover:border-teal-400/50",
      activeBorder: "border-teal-500 ring-2 ring-teal-500/20",
      pillBg: "bg-teal-500/10 text-teal-400",
      focusZoneText: "Sustained Focus Slot",
      quote: "Consistency builds compound habits."
    }
  ];

  // Helper function to shift a timeslot string adaptively
  function shiftTimeSlot(timeStr: string, profile: EnergyProfile): { shifted: string; tag: string; tagColor: string } {
    // If the timeslot has a known break or lunch label, keep it tagged as rest
    const isBreak = /break|lunch|rest|recharge/i.test(timeStr);
    
    // Parse start hour from string like "9:00 AM - 10:30 AM" or "2:00 PM"
    const match = timeStr.match(/(\d+):?(\d+)?\s*(AM|PM)/i);
    if (!match) {
      return { 
        shifted: timeStr, 
        tag: isBreak ? "Recharge" : "Focus Zone", 
        tagColor: isBreak ? "bg-slate-500/10 text-slate-400 border-slate-500/20" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
      };
    }

    const startHour = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const isPm = match[3].toUpperCase() === "PM";
    
    let originalHour24 = startHour;
    if (isPm && startHour !== 12) originalHour24 += 12;
    if (!isPm && startHour === 12) originalHour24 = 0;

    let shiftedHour24 = originalHour24;
    let tag = "Active Focus";
    let tagColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";

    if (profile === "morning") {
      // Shift 1 hour earlier for peak morning performance
      if (originalHour24 >= 9 && originalHour24 <= 17) {
        shiftedHour24 = Math.max(8, originalHour24 - 1);
      }
      
      if (shiftedHour24 >= 8 && shiftedHour24 <= 12) {
        tag = "🎯 Peak Energy Zone";
        tagColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
      } else if (shiftedHour24 > 12 && shiftedHour24 <= 16) {
        tag = "⚙️ Core Execution";
        tagColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
      } else {
        tag = "💤 Recharge / Wind Down";
        tagColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
      }
    } else if (profile === "night") {
      // Shift 4 hours later for night owls
      if (originalHour24 >= 8 && originalHour24 <= 18) {
        shiftedHour24 = (originalHour24 + 4) % 24;
      }
      
      if (shiftedHour24 >= 16 && shiftedHour24 <= 22) {
        tag = "🌙 Moonflow Zone";
        tagColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      } else if (shiftedHour24 >= 12 && shiftedHour24 < 16) {
        tag = "☕ Slow Ramp Up";
        tagColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
      } else {
        tag = "💤 Late Downtime";
        tagColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
      }
    } else {
      // Steady - standard distributed hours
      if (shiftedHour24 >= 9 && shiftedHour24 <= 12) {
        tag = "⚡ Early Focus";
        tagColor = "bg-teal-500/10 text-teal-400 border-teal-500/20";
      } else if (shiftedHour24 >= 13 && shiftedHour24 <= 16) {
        tag = "⚡ Afternoon Pacing";
        tagColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      } else {
        tag = "⏸️ Structured Pause";
        tagColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
      }
    }

    if (isBreak) {
      tag = "🔋 Natural Recovery";
      tagColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }

    // Convert back to string representation
    function toAmPm(h24: number, originalMinutes: number): string {
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      const ampm = h24 >= 12 ? "PM" : "AM";
      const minStr = originalMinutes.toString().padStart(2, "0");
      return `${h12}:${minStr} ${ampm}`;
    }

    // Reconstruct timeslot duration
    const durationMinutes = 60; // default length
    const endHour24 = (shiftedHour24 + Math.floor(durationMinutes / 60)) % 24;
    const endMin = (minutes + (durationMinutes % 60)) % 60;
    
    const startStr = toAmPm(shiftedHour24, minutes);
    const endStr = toAmPm(endHour24, endMin);

    return {
      shifted: `${startStr} - ${endStr}`,
      tag,
      tagColor
    };
  }

  async function handleSaveProfile(profileId: EnergyProfile) {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updatedState = await updateEnergyProfileAPI(profileId);
      onStateUpdate(updatedState);
      setSelectedProfile(profileId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  // Generate curves points for cognitive wave based on energy profile
  function getEnergyCurvePath(profile: EnergyProfile): string {
    if (profile === "morning") {
      // High start, peak at mid-morning, dip in afternoon, tiny bump in eve
      return "M 0 30 C 50 15, 100 10, 150 20 C 200 35, 250 85, 300 80 C 350 75, 400 65, 450 85 C 500 100, 550 110, 600 115";
    } else if (profile === "night") {
      // Low start, flat morning, massive surge late afternoon into late night
      return "M 0 100 C 50 105, 100 95, 150 90 C 200 80, 250 60, 300 45 C 350 30, 400 15, 450 25 C 500 40, 550 70, 600 110";
    } else {
      // Steady waves, peaks at 10am and 3pm, shallow dips
      return "M 0 80 C 50 75, 100 35, 150 40 C 200 50, 250 75, 300 45 C 350 40, 400 55, 450 60 C 500 70, 550 85, 600 90";
    }
  }

  async function handleApplyShifts() {
    setIsApplyingShifts(true);
    setApplySuccess(false);
    try {
      // Construct adapted schedule blocks using our shiftTimeSlot function
      const adaptedBlocks = blocks.map(b => {
        const { shifted } = shiftTimeSlot(b.timeSlot, selectedProfile);
        return {
          ...b,
          timeSlot: shifted
        };
      });

      // Let's call a custom endpoint or update the server schedule
      const res = await fetch("/api/db", {
        method: "GET" // just to refresh
      });
      
      // Let's update the active blocks in server db via custom PUT if possible
      // Or we can save them back through a custom update API
      const saveRes = await fetch("/api/tasks", {
        // We will mock this payload onto server blocks using the actual database state
        // Let's modify server.ts next to support updating schedule blocks directly!
      });

      // Let's send PUT /api/schedule
      const putRes = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: adaptedBlocks })
      });
      const putJson = await putRes.json();
      if (putJson.success) {
        // Refetch full state
        const resState = await fetch("/api/db");
        const jsonState = await resState.json();
        if (jsonState.success) {
          onStateUpdate(jsonState.data);
          setApplySuccess(true);
          setTimeout(() => setApplySuccess(false), 4000);
        }
      }
    } catch (err) {
      console.error("Failed to apply adapted schedule shifts:", err);
    } finally {
      setIsApplyingShifts(false);
    }
  }

  const selectedProfileData = profiles.find(p => p.id === selectedProfile) || profiles[2];
  const IconComponent = selectedProfileData.icon;

  return (
    <div className="space-y-8 animate-fade-in" id="adaptive-planner-screen">
      {/* Upper Brand Jumbotron */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-950/20 via-[#0f172a]/40 to-slate-950/80 p-6 md:p-8 shadow-2xl backdrop-blur-sm">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl"></div>
        
        <div className="relative space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-400 font-mono font-semibold">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" />
            Deadline Protection Optimization
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">Adaptive Daily Planner</h1>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Manage your agenda and optimize focus peaks.
          </p>
        </div>
      </div>

      {/* 12-Month Calendar & Advanced Deadline Alarm Section */}
      <DeadlinesCalendar state={state} onStateUpdate={onStateUpdate} />

      {/* Visualizer and Timeline Columns */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* Left column: [Month Name] Schedule Dynamic Timeline & Stats */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-[#0f172a]/50 p-6 space-y-6 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white font-display">{currentMonthName} Schedule</h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                {monthTasks.filter(t => t.status === "pending").length} PENDING • {monthTasks.filter(t => t.status === "done").length} DONE
              </span>
            </div>

            {/* Compact Horizontal Scrollable Timeline */}
            <div className="relative w-full bg-[#030712] rounded-xl border border-white/10 p-3 shadow-inner overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.02)_0%,transparent_70%)] pointer-events-none"></div>
              
              <div className="flex items-end gap-2 overflow-x-auto pb-3 pt-8 px-2 hide-scrollbar relative z-10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {daysToPlot.length === 0 ? (
                  <div className="w-full text-center py-4">
                    <p className="text-[11px] text-slate-500 font-mono">No tasks scheduled for this month yet.</p>
                  </div>
                ) : (
                  daysToPlot.map((dNum) => {
                    const dayTasks = tasksByDay[dNum] || [];
                    const isToday = dNum === todayDay;
                    const isSelected = dNum === selectedDay;

                    return (
                      <div 
                        key={dNum}
                        onClick={() => setSelectedDay(dNum)}
                        className={`flex flex-col items-center gap-2 cursor-pointer transition-all duration-300 min-w-[36px] group`}
                      >
                        {/* Task Dots Stack */}
                        <div className="flex flex-col-reverse items-center gap-1 min-h-[40px]">
                          {dayTasks.map((t, tIdx) => {
                            const isDone = t.status === "done";
                            let bgClass = "bg-indigo-500";
                            let ringClass = "ring-indigo-500/30";
                            if (isDone) {
                              bgClass = "bg-emerald-500";
                              ringClass = "ring-emerald-500/30";
                            } else if (t.priority === "High") {
                              bgClass = "bg-rose-500";
                              ringClass = "ring-rose-500/30";
                            } else if (t.priority === "Medium") {
                              bgClass = "bg-amber-500";
                              ringClass = "ring-amber-500/30";
                            }

                            return (
                              <div
                                key={t.id || tIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGraphTaskClick(t.id, t.status);
                                }}
                                title={isDone ? `[DONE] ${t.title}` : `[PENDING] ${t.title}`}
                                className={`w-2.5 h-2.5 rounded-full ${bgClass} ring-2 ${ringClass} transition-all duration-300 hover:scale-150 ${isDone ? 'opacity-50 hover:opacity-100' : 'shadow-[0_0_8px_rgba(255,255,255,0.2)]'}`}
                              />
                            );
                          })}
                        </div>
                        
                        {/* Date Pill */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 scale-110' : isToday ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400 border border-white/5 hover:bg-slate-700'}`}>
                          {dNum}
                        </div>
                        
                        {isToday && (
                          <span className="text-[8px] font-bold text-amber-500 absolute bottom-0 font-mono tracking-widest whitespace-nowrap -mb-1 opacity-70">
                            TODAY
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Date Schedule Listing details subpanel */}
            <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-white/5 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-widest">
                      {currentMonthName} {selectedDay} SCHEDULE DETAILS
                    </span>
                    {selectedDay === todayDay && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[#fbbf24] font-bold animate-pulse">
                        ★ TODAY'S TARGET
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs text-slate-300">
                    {selectedDay === todayDay ? "Your Focus for the Present Day" : `Schedules of date: Day ${selectedDay}`}
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
                  {completedSelectedTasks.length} / {selectedDayTasks.length} COMPLETED
                </span>
              </div>

              {selectedDayTasks.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                  <Calendar className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No tasks assigned for this date yet.</p>
                  <p className="text-[10px] text-slate-500 mt-1">Assign tasks or deadlines to this date to plot them!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500/15 pr-1" id="completed-tasks-subpanel">
                  {selectedDayTasks.map(t => {
                    const isDone = t.status === "done";
                    const timeInfo = getTaskHourInfo(t.deadline);
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleGraphTaskClick(t.id, t.status)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group select-none ${
                          isDone
                            ? "border-emerald-500/15 bg-emerald-500/5 hover:bg-emerald-500/10"
                            : "border-white/5 bg-slate-900/40 hover:bg-slate-900/80 hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          {/* Checkbox/Check Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGraphTaskClick(t.id, t.status);
                            }}
                            className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all border shrink-0 ${
                              isDone
                                ? "bg-emerald-500 border-emerald-400 text-slate-950 scale-105"
                                : "border-slate-500 hover:border-indigo-400 text-transparent"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          <div className="truncate">
                            <span className={`text-xs font-medium block truncate transition-colors ${
                              isDone ? "text-slate-500 line-through" : "text-white group-hover:text-indigo-300"
                            }`}>
                              {t.title}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3 text-indigo-400" />
                              Time Slot: {timeInfo.label} • {t.estimatedMinutes} mins
                            </span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                            t.priority === "High"
                              ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                              : t.priority === "Medium"
                              ? "bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24]"
                              : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                          }`}>
                            {t.priority}
                          </span>
                          {isDone && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                              COMPLETED
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {blocks.length > 0 && (
              <button
                onClick={handleApplyShifts}
                disabled={isApplyingShifts}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-900/40 text-white font-bold text-xs shadow-xl shadow-indigo-500/15 hover:shadow-indigo-500/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-95 disabled:opacity-40"
              >
                {isApplyingShifts ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Syncing Adaptations...
                  </>
                ) : applySuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                    Adapted Schedule Locked Successfully!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Apply Adapted Times to Today's Schedule
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
