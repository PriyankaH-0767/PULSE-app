import React, { useState, useEffect } from "react";
import { Droplet, Plus, Minus, Heart, Flame, CheckCircle2, Circle, Trash2, Loader2, Award } from "lucide-react";
import { Habit } from "../types";
import { addHabitAPI, logHabitAPI, deleteHabitAPI } from "../utils/api";

interface OptionalWellnessProps {
  habits: Habit[];
  onHabitsUpdated: (updated: Habit[]) => void;
  onHabitDeleted: (id: string) => void;
}

export default function OptionalWellness({ habits, onHabitsUpdated, onHabitDeleted }: OptionalWellnessProps) {
  const [glasses, setGlasses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [newHabitName, setNewHabitName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingId, setIsLoggingId] = useState<string | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedGlasses = localStorage.getItem("wellness_water_glasses");
    const savedStreak = localStorage.getItem("wellness_water_streak");
    const lastDate = localStorage.getItem("wellness_water_last_date");

    if (savedGlasses) setGlasses(parseInt(savedGlasses, 10));
    if (savedStreak) setStreak(parseInt(savedStreak, 10));

    // Simple streak reset if a day is completely missed
    const todayStr = new Date().toISOString().split("T")[0];
    if (lastDate && lastDate !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      if (lastDate !== yesterdayStr) {
        setStreak(0);
        localStorage.setItem("wellness_water_streak", "0");
      }
    }
  }, []);

  const adjustGlasses = (amount: number) => {
    const newVal = Math.max(0, glasses + amount);
    setGlasses(newVal);
    localStorage.setItem("wellness_water_glasses", newVal.toString());

    const todayStr = new Date().toISOString().split("T")[0];
    localStorage.setItem("wellness_water_last_date", todayStr);

    // Increase streak if we hit 8 glasses today
    if (newVal >= 8 && glasses < 8) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      localStorage.setItem("wellness_water_streak", newStreak.toString());
    } else if (newVal < 8 && glasses >= 8) {
      const newStreak = Math.max(0, streak - 1);
      setStreak(newStreak);
      localStorage.setItem("wellness_water_streak", newStreak.toString());
    }
  };

  async function handleAddHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    setIsSaving(true);
    try {
      const added = await addHabitAPI(newHabitName);
      onHabitsUpdated([...habits, added]);
      setNewHabitName("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogHabit(id: string) {
    setIsLoggingId(id);
    try {
      const updated = await logHabitAPI(id);
      onHabitsUpdated(habits.map(h => h.id === id ? updated : h));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingId(null);
    }
  }

  async function handleDeleteHabit(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteHabitAPI(id);
      onHabitDeleted(id);
    } catch (err) {
      console.error(err);
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-[#0f172a]/20 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl backdrop-blur-sm" id="optional-wellness-card">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-3.5 h-3.5 text-rose-500" />
          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Integrations & Optional Wellness
          </h5>
        </div>
        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-semibold border border-indigo-500/20 font-mono">
          DAILY WELLNESS
        </span>
      </div>
      
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Secondary routines and optional health trackers. Log habits and water intake to maintain peak focus and cognitive performance.
      </p>

      {/* 1. Habit Stream List (Styled exactly in the Wellness sub-widget style) */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
          Habit Streams
        </span>
        
        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
          {habits.length > 0 ? (
            habits.map(habit => {
              const isLoggedToday = habit.lastLoggedDate === todayStr;
              const isLogging = isLoggingId === habit.id;

              return (
                <div
                  key={habit.id}
                  onClick={() => !isLoggedToday && handleLogHabit(habit.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all select-none ${
                    isLoggedToday
                      ? "bg-emerald-500/5 border-emerald-500/15 cursor-default text-emerald-100"
                      : "bg-slate-950/20 border-white/5 hover:border-indigo-500/40 hover:bg-[#111827]/50 cursor-pointer text-slate-200"
                  }`}
                  id={`habit-card-${habit.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isLogging ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    ) : isLoggedToday ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 hover:text-indigo-400 shrink-0 transition-colors" />
                    )}

                    <div className="min-w-0">
                      <span className={`text-xs font-semibold block truncate ${isLoggedToday ? "line-through text-slate-500" : "text-slate-300"}`}>
                        {habit.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-orange-500/10 px-1.5 py-0.5 rounded text-[10px] font-mono text-orange-400 border border-orange-500/10">
                      <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                      <span>{habit.currentStreak}d</span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteHabit(habit.id, e)}
                      className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                      title="Delete Habit"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 bg-slate-950/10 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center p-3">
              <Award className="w-5 h-5 text-slate-600 mb-1" />
              <span className="text-[11px] font-medium text-slate-400">No habits tracked</span>
            </div>
          )}
        </div>

        {/* Add Habit Form inline formatted exactly like other cards */}
        <form onSubmit={handleAddHabit} className="flex gap-2 bg-slate-950/20 p-2 rounded-xl border border-white/5">
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder="New habit, e.g. Stretch..."
            className="flex-1 rounded-lg bg-slate-900/50 border border-white/10 px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/30 transition-colors"
            required
          />
          <button
            type="submit"
            disabled={isSaving || !newHabitName.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 px-2.5 rounded-lg text-xs font-semibold shadow transition-all shrink-0 cursor-pointer disabled:opacity-30"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>

      {/* 2. Hydration Tracker widget (The exact standard widget from wellness) */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
          Hydration Track
        </span>
        
        <div className="flex items-center justify-between bg-slate-950/20 p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/15">
              <Droplet className="w-4 h-4 fill-blue-500/10" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-300 block">Hydration</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {glasses} / 8 glasses
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustGlasses(-1)}
              disabled={glasses === 0}
              className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-all disabled:opacity-30 cursor-pointer"
              title="Remove 1 glass"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => adjustGlasses(1)}
              className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer"
              title="Add 1 glass"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {streak > 0 && (
          <div className="text-[10px] text-amber-400 font-mono flex items-center justify-center gap-1 bg-amber-500/5 py-1 px-2 rounded-lg border border-amber-500/10">
            🔥 Hydration Streak: {streak} day{streak !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
