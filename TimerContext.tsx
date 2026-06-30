import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface TimerContextType {
  timeLeft: number;
  isActive: boolean;
  isFinished: boolean;
  taskName: string;
  totalTime: number;
  setTimeLeft: (time: number) => void;
  setIsActive: (active: boolean) => void;
  setIsFinished: (finished: boolean) => void;
  setTaskName: (name: string) => void;
  setTotalTime: (time: number) => void;
  startTimer: (hours: number, minutes: number, seconds: number, name: string) => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  snoozeTimer: (minutes: number) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [totalTime, setTotalTime] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const playAlarmSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioRef.current) {
        audioRef.current = new AudioContextClass();
      }
      const ctx = audioRef.current;
      
      const playBeep = (delay: number, frequency: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration - 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };

      playBeep(0, 880, 0.2);
      playBeep(0.3, 880, 0.2);
      playBeep(0.6, 880, 0.5);
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      setIsFinished(true);
      playAlarmSound();
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  useEffect(() => {
    let alarmInterval: NodeJS.Timeout | null = null;
    if (isFinished) {
      alarmInterval = setInterval(() => {
        playAlarmSound();
      }, 3000);
    }
    return () => {
      if (alarmInterval) clearInterval(alarmInterval);
    };
  }, [isFinished]);

  const startTimer = (h: number, m: number, s: number, name: string) => {
    const total = h * 3600 + m * 60 + s;
    if (total > 0) {
      setTotalTime(total);
      setTimeLeft(total);
      setTaskName(name);
      setIsActive(true);
      setIsFinished(false);
    }
  };

  const pauseTimer = () => setIsActive(false);
  
  const resetTimer = () => {
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(0);
    setTotalTime(0);
    setTaskName('');
  };

  const snoozeTimer = (m: number) => {
    const snoozeSeconds = m * 60;
    setTotalTime(snoozeSeconds);
    setTimeLeft(snoozeSeconds);
    setIsFinished(false);
    setIsActive(true);
  };

  return (
    <TimerContext.Provider value={{
      timeLeft, isActive, isFinished, taskName, totalTime,
      setTimeLeft, setIsActive, setIsFinished, setTaskName, setTotalTime,
      startTimer, pauseTimer, resetTimer, snoozeTimer
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
