import React, { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Clock, AlertTriangle, Lightbulb, CheckCircle2, RefreshCw, Terminal, Plus, FileText } from "lucide-react";
import { AgentRun, Task } from "../types";
import { runPulseAgentAPI, extractTasksWithAI_API } from "../utils/api";

interface PulseAgentViewProps {
  latestRun: AgentRun | null;
  onRunComplete: (run: AgentRun) => void;
  onTasksAdded: (tasks: Task[]) => void;
}

export default function PulseAgentView({ latestRun, onRunComplete, onTasksAdded }: PulseAgentViewProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Capture Stream state
  const [messyText, setMessyText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);

  async function handleRunAgent() {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const result = await runPulseAgentAPI();
      onRunComplete(result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "The Pulse Agent experienced an issue reviewing your day. Please verify your GEMINI_API_KEY.");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleDirectExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!messyText.trim()) return;

    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(null);

    try {
      const extracted = await extractTasksWithAI_API(messyText);
      onTasksAdded(extracted);
      setMessyText("");
      setExtractSuccess(`Successfully extracted ${extracted.length} focus directive(s)!`);
      setTimeout(() => setExtractSuccess(null), 6000);
    } catch (err: any) {
      console.error(err);
      setExtractError(err.message || "Failed to parse text. Please check your GEMINI_API_KEY.");
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <div className="space-y-6" id="pulse-agent-panel">
      {/* Pulse Agent Centerpiece (Trigger Card) */}
      <div 
        className="bg-gradient-to-br from-indigo-900/80 via-violet-950/70 to-slate-950 border border-indigo-500/35 p-6 rounded-3xl relative overflow-hidden shadow-2xl shadow-indigo-500/10"
        id="pulse-agent-trigger-card"
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-[50px]"></div>
        <div className="relative z-10 space-y-5">
          <div>
            <h3 className="text-xl font-bold text-white mb-1 tracking-tight font-display">Life Saver Agent</h3>
            <p className="text-xs text-indigo-100/80 leading-relaxed">
              Autonomous review of your agenda, deadlines, and active tasks. Triggers AI optimizer algorithms.
            </p>
          </div>

          <button 
            onClick={handleRunAgent}
            disabled={isRunning}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-xl hover:scale-[1.02] active:scale-95 active:translate-y-px transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:scale-100 shadow-indigo-500/20 hover:shadow-indigo-500/35"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Running Agent Analysis...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-white text-white animate-pulse" />
                <span>Run Life Saver Now</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-950/30 border border-red-900/40 rounded-xl flex items-start gap-2 text-[11px] text-red-300 relative z-10">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Execution Error</span>
              {errorMsg}
            </div>
          </div>
        )}
      </div>
      {/* Loading state visual indicator */}
      {isRunning && (
        <div className="p-6 text-center bg-[#0f172a]/50 border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4 animate-pulse shadow-xl">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-white tracking-wider uppercase font-mono">The Life Saver is reviewing your day...</h5>
            <p className="text-xs text-slate-400">Evaluating deadlines, building schedule, and triggering notifications.</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {latestRun && !isRunning && (
        <div className="space-y-6 animate-fade-in" id="pulse-agent-report">
          {/* Section Divider */}
          <div className="flex items-center gap-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Active Life Saver Report
            </h4>
            <div className="w-full h-px bg-white/5" />
            <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap bg-white/5 px-2 py-0.5 rounded border border-white/5">
              {new Date(latestRun.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* (a) Plain-text Agent Summary */}
          <div className="bg-[#0f172a]/50 border border-white/5 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono">
                Executive Action Summary
              </h5>
            </div>
            <p className="text-xs leading-relaxed text-slate-200 font-sans italic">
              "{latestRun.summary}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
