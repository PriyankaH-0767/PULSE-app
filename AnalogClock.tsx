import { useEffect, useState } from "react";

export default function AnalogClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours();

  const secondDegrees = (seconds / 60) * 360;
  const minuteDegrees = ((minutes + seconds / 60) / 60) * 360;
  const hourDegrees = (((hours % 12) + minutes / 60) / 12) * 360;

  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  
  const dayName = dayNames[time.getDay()];
  const monthName = monthNames[time.getMonth()];
  const date = time.getDate();

  return (
    <div className="flex items-center gap-5 bg-slate-900/40 px-6 py-4 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
      
      {/* Analog Clock Face */}
      <div className="relative w-24 h-24 rounded-full border-4 border-slate-800 bg-slate-950 flex items-center justify-center shrink-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.9),0_10px_20px_rgba(0,0,0,0.4)]">
        {/* Outer Ring glow */}
        <div className="absolute inset-0 rounded-full border border-white/5" />
        
        {/* Hour markers */}
        {[...Array(12)].map((_, i) => (
          <div 
            key={i} 
            className={`absolute rounded-full ${i % 3 === 0 ? 'w-1 h-3 bg-indigo-500' : 'w-0.5 h-1.5 bg-slate-700'}`} 
            style={{ 
              transform: `rotate(${i * 30}deg) translateY(-42px)` 
            }}
          />
        ))}
        
        {/* Numbers */}
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num, i) => (
          <span 
            key={num}
            className={`absolute text-[11px] font-black tracking-tighter ${num % 3 === 0 ? 'text-indigo-400' : 'text-slate-600'}`}
            style={{
              transform: `rotate(${i * 30}deg) translateY(-32px) rotate(-${i * 30}deg)`
            }}
          >
            {num}
          </span>
        ))}

        {/* Shadow hands for depth */}
        <div 
          className="absolute w-1.5 h-8 bg-black/40 rounded-full origin-bottom blur-[2px]" 
          style={{ 
            transform: `rotate(${hourDegrees}deg) translateY(2px)`,
            bottom: '50%'
          }}
        />

        {/* Hands */}
        <div 
          className="absolute w-1.5 h-8 bg-white rounded-full origin-bottom shadow-lg z-20" 
          style={{ 
            transform: `rotate(${hourDegrees}deg) translateY(-4px)`,
            bottom: '50%'
          }}
        />
        <div 
          className="absolute w-1 h-11 bg-slate-300 rounded-full origin-bottom shadow-lg z-10" 
          style={{ 
            transform: `rotate(${minuteDegrees}deg) translateY(-4px)`,
            bottom: '50%'
          }}
        />
        <div 
          className="absolute w-[1.5px] h-13 bg-rose-500 origin-bottom z-30 shadow-[0_0_10px_rgba(244,63,94,0.5)]" 
          style={{ 
            transform: `rotate(${secondDegrees}deg)`,
            bottom: '50%'
          }}
        />
        
        {/* Center pin */}
        <div className="absolute w-3 h-3 bg-white rounded-full z-40 shadow-xl border-2 border-slate-900" />
      </div>

      {/* Date & Time Info */}
      <div className="flex flex-col justify-center border-l border-white/10 pl-6 h-16">
        <div className="text-[13px] font-black text-indigo-400 tracking-[0.4em] leading-none mb-2.5 uppercase drop-shadow-sm">
          {dayName} • {monthName} {date}
        </div>
        <div className="text-2xl font-mono font-black text-white tracking-tighter leading-none flex items-baseline gap-1.5">
          <span className="text-indigo-100/40">[{time.getHours().toString().padStart(2, '0')}:</span>
          <span>{time.getMinutes().toString().padStart(2, '0')}</span>
          <span className="text-indigo-100/40">:{time.getSeconds().toString().padStart(2, '0')}]</span>
        </div>
      </div>
    </div>
  );
}
