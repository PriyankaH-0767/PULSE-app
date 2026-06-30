import { useTimer } from "../contexts/TimerContext";
import { Timer, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function TimerWidget() {
  const { timeLeft, isActive, taskName, totalTime } = useTimer();

  if (!isActive || timeLeft <= 0) return null;

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const progress = (timeLeft / (totalTime || 1)) * 100;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-24 right-8 z-[9999] group"
      >
        <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-5 shadow-[0_0_40px_rgba(99,102,241,0.3)] flex items-center gap-5 min-w-[240px]">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                className="text-slate-800"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={125.6}
                strokeDashoffset={125.6 - (125.6 * progress) / 100}
                className="text-indigo-500 transition-all duration-1000"
              />
            </svg>
            <Timer className="absolute w-5 h-5 text-indigo-400" />
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Live Timer</span>
            <span className="text-lg font-mono font-black text-white leading-none tracking-tighter">
              {formatTime(timeLeft)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px] mt-1 italic">
              {taskName || "Focusing..."}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
