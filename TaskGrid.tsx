import { useState } from "react";
import { CheckSquare, Square, Trash2, Clock, Calendar, AlertCircle, Award, ListTodo, Plus, ChevronDown, ChevronUp, MapPin, Bell, Car } from "lucide-react";
import { Task } from "../types";

// ... rest of imports

interface TaskGridProps {
  tasks: Task[];
  activeTab: "all" | "pending" | "high" | "done";
  onToggleStatus: (id: string, currentStatus: "pending" | "done") => void;
  onToggleSubtask: (taskId: string, subtaskIndex: number) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
  onPlanJourney?: (task: Task) => void;
  onViewJourney?: (task: Task) => void;
}

export default function TaskGrid({ tasks, activeTab, onToggleStatus, onToggleSubtask, onDelete, onOpenAddModal, onPlanJourney, onViewJourney }: TaskGridProps) {
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Calculations for stats
  const totalCount = tasks.length;
  const completedToday = tasks.filter(t => t.status === "done").length;
  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const highPriorityCount = tasks.filter(t => t.priority === "High" && t.status === "pending").length;
  const completionRate = totalCount > 0 ? Math.round((completedToday / totalCount) * 100) : 0;

  // Filter tasks based on selected tab
  const filteredTasks = tasks.filter(t => {
    if (activeTab === "pending") return t.status === "pending";
    if (activeTab === "high") return t.priority === "High" && t.status === "pending";
    if (activeTab === "done") return t.status === "done";
    return true; // "all"
  });

  function toggleExpand(id: string) {
    setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Format deadlines to be readable
  function formatDeadline(isoString: string): { label: string; isClose: boolean } {
    if (!isoString || isoString === "no deadline") {
      return { label: "No deadline", isClose: false };
    }

    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { label: "No deadline", isClose: false };

      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Friendly string
      const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

      if (diffMs < 0) {
        return { label: `Overdue (${dateStr} ${timeStr})`, isClose: true };
      } else if (diffHours < 48) {
        return { label: `Due ${diffHours < 24 ? "today" : "tomorrow"} at ${timeStr}`, isClose: true };
      } else {
        return { label: `${dateStr} @ ${timeStr}`, isClose: false };
      }
    } catch {
      return { label: "No deadline", isClose: false };
    }
  }

  return (
    <div className="space-y-8" id="task-grid-section">
      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats-strip">
        <div className="bg-[#0f172a]/50 border border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-sm transition-all hover:border-white/10">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-mono font-semibold">Completed</p>
            <h3 className="text-3xl font-extrabold text-white">{completedToday}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/15">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a]/50 border border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-sm transition-all hover:border-white/10">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-mono font-semibold">Pending</p>
            <h3 className="text-3xl font-extrabold text-white">{pendingCount}</h3>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/15">
            <ListTodo className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a]/50 border border-white/5 border-l-rose-500/50 border-l-2 p-5 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-sm transition-all hover:border-white/10">
          <div>
            <p className="text-xs text-rose-400 uppercase tracking-wider mb-1 font-mono font-semibold">High Priority</p>
            <h3 className="text-3xl font-extrabold text-rose-50">{highPriorityCount}</h3>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/15">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a]/50 border border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-sm transition-all hover:border-white/10">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-mono font-semibold">Focus Rate</p>
            <h3 className="text-3xl font-extrabold text-white">{completionRate}%</h3>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/15">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Task Grid / Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="tasks-list-grid">
        {filteredTasks.length > 0 ? (
          filteredTasks.map(task => {
            const { label: deadlineLabel, isClose } = formatDeadline(task.deadline);
            const isExpanded = !!expandedTasks[task.id];
            
            // Subtask statistics
            const subtaskCount = task.subtasks?.length || 0;
            const completedSubtaskCount = task.subtasks?.filter(st => st.done).length || 0;
            const subtaskPercent = subtaskCount > 0 ? Math.round((completedSubtaskCount / subtaskCount) * 100) : 0;

            return (
              <div
                key={task.id}
                className={`bg-[#0f172a]/40 border rounded-2xl p-5 flex flex-col justify-between shadow-xl backdrop-blur-sm transition-all duration-200 relative group hover:scale-[1.01] hover:shadow-2xl ${
                  task.status === "done" 
                    ? "border-emerald-500/20 bg-emerald-950/5 opacity-70" 
                    : task.priority === "High"
                      ? "border-rose-500/25 hover:border-rose-500/50 shadow-rose-950/10"
                      : "border-white/5 hover:border-white/10"
                }`}
                id={`task-card-${task.id}`}
              >
                {/* Glowing status indicator for High Priority tasks */}
                {task.priority === "High" && task.status === "pending" && (
                  <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse"></div>
                )}

                {/* Upper row */}
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => onToggleStatus(task.id, task.status)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0 mt-0.5 hover:scale-110 active:scale-95"
                    aria-label={task.status === "done" ? "Mark Pending" : "Mark Completed"}
                  >
                    {task.status === "done" ? (
                      <CheckSquare className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-500 hover:text-indigo-400 transition-colors" />
                    )}
                  </button>

                  <div className="space-y-2 min-w-0 flex-1">
                    <h5 className={`text-base font-bold tracking-tight leading-relaxed text-white truncate ${task.status === "done" ? "line-through text-slate-500 font-medium" : ""}`}>
                      {task.title}
                    </h5>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className={`w-3.5 h-3.5 ${isClose && task.status === "pending" ? "text-rose-400" : "text-slate-500"}`} />
                        <span className={isClose && task.status === "pending" ? "text-rose-400 font-semibold" : "font-medium"}>
                          {deadlineLabel}
                        </span>
                      </span>

                      <span className="text-slate-700">•</span>

                      <span className="flex items-center gap-1 font-medium font-mono text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {task.estimatedMinutes}m
                      </span>

                      {task.alarmTime && (
                        <>
                          <span className="text-slate-700">•</span>
                          <span className="flex items-center gap-1 font-medium font-mono text-[11px] text-amber-400">
                            <Bell className="w-3.5 h-3.5" />
                            {new Date(task.alarmTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </>
                      )}

                      {task.transportationMode && (
                        <>
                          <span className="text-slate-700">•</span>
                          <span className="flex items-center gap-1 font-medium font-mono text-[11px] text-sky-400 uppercase">
                            <Car className="w-3.5 h-3.5" />
                            {task.transportationMode}
                          </span>
                        </>
                      )}

                      {task.source && task.source !== "manual" && (
                        <>
                          <span className="text-slate-700">•</span>
                          <span className="text-indigo-400 bg-indigo-500/10 border border-indigo-500/10 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                            {task.source}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtask Section */}
                {subtaskCount > 0 && (
                  <div className="mt-5 pt-4 border-t border-white/5">
                    <button
                      onClick={() => toggleExpand(task.id)}
                      className="w-full flex items-center justify-between text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 px-3 py-1.5 rounded-xl shadow-sm"
                    >
                      <span className="font-mono">
                        Subtasks ({completedSubtaskCount}/{subtaskCount}) • {subtaskPercent}%
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {/* Miniature progress bar */}
                    <div className="w-full bg-slate-950/50 h-1.5 rounded-full overflow-hidden mt-2.5">
                      <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${subtaskPercent}%` }} />
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 pl-1 animate-fade-in">
                        {task.subtasks.map((sub, stIdx) => (
                          <div 
                            key={stIdx}
                            onClick={() => onToggleSubtask(task.id, stIdx)}
                            className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white transition-all cursor-pointer py-1.5 select-none hover:bg-white/5 px-2 rounded-lg"
                          >
                            {sub.done ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 hover:text-indigo-400 shrink-0 transition-colors" />
                            )}
                            <span className={`truncate flex-1 font-medium ${sub.done ? "line-through text-slate-500" : ""}`}>
                              {sub.step}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0 font-mono">{sub.estimatedMinutes}m</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Lower row */}
                <div className="mt-5 pt-3 border-t border-white/5 flex justify-between items-center bg-slate-950/30 -mx-5 -mb-5 px-5 py-3.5 rounded-b-2xl">
                  {/* Priority Badge */}
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
                    task.priority === "High"
                      ? "text-rose-400 border-rose-500/20 bg-rose-500/10"
                      : task.priority === "Medium"
                        ? "text-amber-400 border-amber-500/20 bg-amber-500/10"
                        : "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                  }`}>
                    {task.priority} Priority
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {task.journeyData ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onViewJourney && onViewJourney(task)}
                          className="px-2.5 py-1 text-[10px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-all shadow shadow-indigo-600/30 flex items-center gap-1 cursor-pointer hover:scale-[1.02]"
                          title="View route interactively on the app map"
                        >
                          <MapPin className="w-3 h-3 text-indigo-100" />
                          View
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${task.journeyData.origin.lat},${task.journeyData.origin.lng}&destination=${task.journeyData.destination.lat},${task.journeyData.destination.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-[10px] font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-md transition-colors"
                          title="Open physical turn-by-turn navigation in external Google Maps"
                        >
                          GPS ↗
                        </a>
                      </div>
                    ) : (
                      onPlanJourney && (
                        <button
                          onClick={() => onPlanJourney(task)}
                          className="px-2.5 py-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-md transition-colors"
                          title="Plan Journey"
                        >
                          Plan Journey
                        </button>
                      )
                    )}
                    <button
                      onClick={() => onDelete(task.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer hover:scale-105"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-1 md:col-span-2 text-center py-12 bg-slate-900/10 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-6">
            <ListTodo className="w-8 h-8 text-slate-500 mb-2" />
            <h5 className="text-sm font-semibold text-white">No tasks found</h5>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Add a task manually, extract them from text with AI, or run the Pulse Agent to review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
