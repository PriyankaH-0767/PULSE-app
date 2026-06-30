import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RotateCw, CheckCircle2, Circle, AlertCircle, Zap, Brain, ArrowRight } from "lucide-react";
import { Task, AgentRun } from "../types";
import { fetchCoachingInsightAPI, CoachingInsight } from "../utils/api";
import PulseAgentView from "./PulseAgentView";
import MomentumDial from "./MomentumDial";

interface ContextCoachProps {
  tasks: Task[];
  latestRun: AgentRun | null;
  onRunComplete: (run: AgentRun) => void;
  onTasksAdded: (tasks: Task[]) => void;
  onCommitAction: (action: string) => void;
}

export default function ContextCoach({ tasks, latestRun, onRunComplete, onTasksAdded, onCommitAction }: ContextCoachProps) {
  const [insight, setInsight] = useState<CoachingInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCommitted, setIsCommitted] = useState(false);

  async function loadInsight(silent = false) {
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const data = await fetchCoachingInsightAPI();
      setInsight(data);
    } catch (err: any) {
      setError(err.message || "Failed to load coaching insights.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadInsight();
  }, [tasks.length]); // Reload if task count changes

  const completedTasks = tasks.filter((t) => t.status === "done");
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedCount = completedTasks.length;
  const pendingCount = pendingTasks.length;
  const totalCount = tasks.length;
  const ratio = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleCommit = () => {
    if (!insight?.suggestedAction) return;
    setIsCommitted(true);
    onCommitAction(insight.suggestedAction);
  };

  return (
    <div className="space-y-8" id="context-coach-screen">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a]/30 p-6 rounded-2xl border border-white/5 shadow-xl backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold text-white font-display flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-400" />
            Context Coach
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Task completion coaching analyzing your progress and suggesting high-impact micro-steps
          </p>
        </div>

        <button
          onClick={() => loadInsight(true)}
          disabled={isLoading || isRefreshing}
          className="self-start sm:self-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-xl shadow-indigo-600/15 hover:shadow-indigo-600/35 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-95 shrink-0"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Regenerating..." : "Get My Coaching Insight"}
        </button>
      </div>

      {isLoading ? (
        <div className="bg-[#0f172a]/50 border border-white/5 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 min-h-[300px] shadow-2xl">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/10 border-t-indigo-400 animate-spin"></div>
            <Sparkles className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-slate-300">Formulating custom cognitive coaching...</p>
            <p className="text-xs text-slate-500 font-mono">Running performance models on completed-vs-pending workspace stats</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <p className="text-sm font-medium text-slate-200">{error}</p>
          <button
            onClick={() => loadInsight()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg transition-all"
          >
            Retry Call
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Coach Dashboard Card (col-span 7) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* AI Insight Glow Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden bg-[#0f172a]/50 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-2xl backdrop-blur-sm"
            >
              {/* Absolut ambient background glows */}
              <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Cognitive Insight
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Based on {totalCount} total workspace items
                  </span>
                </div>

                <blockquote className="text-base md:text-lg text-slate-100 font-medium leading-relaxed font-display">
                  "{insight?.insight}"
                </blockquote>

                <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-y-2 gap-x-6">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span><strong className="text-white font-semibold">{completedCount}</strong> completed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Circle className="w-4 h-4 text-amber-400/80" />
                    <span><strong className="text-white font-semibold">{pendingCount}</strong> pending</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span><strong className="text-white font-semibold">{ratio.toFixed(0)}%</strong> completion efficiency</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tactical Suggested Action Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className={`border rounded-3xl p-6 md:p-8 transition-all duration-300 shadow-xl backdrop-blur-sm ${
                isCommitted
                  ? "bg-emerald-500/5 border-emerald-500/25 shadow-emerald-500/5"
                  : "bg-[#0f172a]/50 border-white/5 hover:border-white/10"
              }`}
            >
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                    Recommended Micro-Step
                  </span>
                  <h3 className="text-lg font-bold text-white font-display leading-tight">
                    {insight?.suggestedAction}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                    Our performance analysis shows this concrete action is highly optimized to bypass friction and unlock momentum based on your current agenda profile.
                  </p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={handleCommit}
                    disabled={isCommitted}
                    className={`px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95 ${
                      isCommitted
                        ? "bg-emerald-600/50 text-white/50 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                    }`}
                  >
                    {isCommitted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Step Committed!
                      </>
                    ) : (
                      <>
                        Commit to Action
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center font-mono">
                    {isCommitted ? "Let's make it happen!" : "Ready to tackle?"}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Metrics Panel (col-span 5) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <MomentumDial completedCount={completedCount} totalCount={totalCount} />

            {/* Cognitive Balance Summary */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 space-y-4"
            >
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Coach Guidelines
              </h4>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs shrink-0 font-bold mt-0.5">
                    ✓
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-slate-200">Bypass Friction</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Always begin with recommended micro-steps of 15 minutes or less to bypass procrastination thresholds.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs shrink-0 font-bold mt-0.5">
                    →
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-slate-200">Preserve Energy</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Batch tasks according to your designated Energy Profile in the Adaptive Planner.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Life Saver Agent */}
            <div className="border-t border-white/5 pt-6">
              <PulseAgentView
                latestRun={latestRun}
                onRunComplete={onRunComplete}
                onTasksAdded={onTasksAdded}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
