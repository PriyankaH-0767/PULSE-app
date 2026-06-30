import { useState } from "react";
import { Timer, Play, Pause, RotateCcw, Bell, BellOff, FastForward, Edit3 } from "lucide-react";
import { useTimer } from "../contexts/TimerContext";

export default function TaskTimer() {
  const { 
    timeLeft, isActive, isFinished, taskName, totalTime,
    startTimer, pauseTimer, resetTimer, snoozeTimer, setTaskName 
  } = useTimer();

  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(0);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [editingName, setEditingName] = useState(false);

  const handleStart = () => {
    if (timeLeft === 0 && !isActive) {
      startTimer(inputHours, inputMinutes, inputSeconds, taskName || "Unnamed Task");
    } else {
      useTimer().setIsActive(true);
      useTimer().setIsFinished(false);
    }
  };

  const handleTurnOff = () => {
    resetTimer();
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm shadow-xl relative overflow-hidden">
      {isFinished && <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />}
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            {editingName || (!taskName && !isActive && !isFinished) ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  placeholder="Task Name..."
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  className="bg-transparent border-b border-white/10 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 w-32"
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => !isActive && setEditingName(true)}>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-[120px]">
                  {taskName || "Focus Timer"}
                </h3>
                {!isActive && <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
            )}
            <p className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">Focus Duration</p>
          </div>
        </div>
        {isActive && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tight">Active</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative group">
          {timeLeft > 0 || isActive || isFinished ? (
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="66"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  className="text-slate-950"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="66"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={414.69}
                  strokeDashoffset={414.69 - (414.69 * (timeLeft / (totalTime || 1))) / 100 * 100}
                  className={`${isFinished ? 'text-rose-500' : 'text-indigo-500'} transition-all duration-1000`}
                />
              </svg>
              <div className={`absolute text-3xl font-black font-mono tracking-tighter transition-colors ${isFinished ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                {formatTime(timeLeft)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-36 h-36 rounded-full bg-slate-950 border-2 border-slate-900 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 z-10">
                  <div className="flex flex-col items-center gap-0.5">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={inputHours || ""}
                      onChange={(e) => setInputHours(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="00"
                      className="w-12 h-12 bg-slate-900 border border-white/10 rounded-xl text-xl font-black text-center text-white focus:border-indigo-500 outline-none transition-all"
                    />
                    <span className="text-[8px] font-black text-slate-500 uppercase">Hrs</span>
                  </div>
                  <span className="text-xl font-black text-slate-700">:</span>
                  <div className="flex flex-col items-center gap-0.5">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={inputMinutes || ""}
                      onChange={(e) => setInputMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      placeholder="00"
                      className="w-12 h-12 bg-slate-900 border border-white/10 rounded-xl text-xl font-black text-center text-white focus:border-indigo-500 outline-none transition-all"
                    />
                    <span className="text-[8px] font-black text-slate-500 uppercase">Min</span>
                  </div>
                </div>

                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute w-0.5 h-2 bg-slate-800 rounded-full" 
                    style={{ transform: `rotate(${i * 30}deg) translateY(-60px)` }}
                  />
                ))}
              </div>
            </div>
          )}
          
          {isFinished && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-lg animate-bounce flex items-center gap-2 z-50">
              <Bell className="w-3 h-3 fill-current" /> TIME UP!
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isFinished ? (
            <>
              <button
                onClick={() => snoozeTimer(5)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20"
              >
                <FastForward className="w-4 h-4" /> SNOOZE 5M
              </button>
              <button
                onClick={handleTurnOff}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
              >
                <BellOff className="w-4 h-4" /> TURN OFF
              </button>
            </>
          ) : (
            <>
              {!isActive ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Play className="w-4 h-4 fill-current" /> START
                </button>
              ) : (
                <button
                  onClick={pauseTimer}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
                >
                  <Pause className="w-4 h-4 fill-current" /> PAUSE
                </button>
              )}
              <button
                onClick={resetTimer}
                disabled={timeLeft === 0 && !isActive}
                className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500 uppercase tracking-widest">Live Progress</span>
          <span className="text-slate-300">
            {timeLeft > 0 ? Math.round((timeLeft / (totalTime || 1)) * 100) : 0}% remaining
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
          <div 
            className={`h-full transition-all duration-1000 ${isFinished ? 'bg-rose-500' : 'bg-indigo-500'}`}
            style={{ width: `${timeLeft > 0 ? (timeLeft / (totalTime || 0.1)) * 100 : (isFinished ? 100 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

