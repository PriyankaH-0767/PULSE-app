import React from "react";
import { motion } from "motion/react";

interface MomentumDialProps {
  completedCount: number;
  totalCount: number;
}

export default function MomentumDial({ completedCount, totalCount }: MomentumDialProps) {
  const ratio = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  // Circular gauge config
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (ratio / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-[#0f172a]/50 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden shadow-xl backdrop-blur-sm"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono self-start">
        Momentum Dial
      </h4>

      <div className="relative flex items-center justify-center mt-2">
        {/* SVG Dial */}
        <svg className="w-36 h-36 transform -rotate-90">
          {/* Background Circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Progress Circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke={ratio >= 75 ? "#10b981" : ratio >= 40 ? "#6366f1" : "#f59e0b"}
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tracking-tight">
            {ratio.toFixed(0)}%
          </span>
          <span className="text-[9px] text-slate-500 font-mono tracking-wider uppercase mt-0.5">
            Completed
          </span>
        </div>
      </div>

      <div className="w-full mt-2 space-y-2">
        <div className="flex items-center justify-between text-[10px] p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-slate-400 font-mono">Status</span>
          <span className={`font-semibold ${ratio >= 75 ? "text-emerald-400" : ratio >= 40 ? "text-indigo-400" : "text-amber-400"}`}>
            {ratio >= 75 ? "Peak Momentum" : ratio >= 40 ? "Steady Flow" : "Building Focus"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
