import React, { useState, useEffect, useRef } from 'react';
import { Map, MapMarker, MapRoute, MapControls, MarkerContent, MarkerPopup } from './ui/map';
import { Navigation, MapPin, Compass, Clock, AlertTriangle, ChevronRight, Car, Brain, Check, RefreshCw, Search, Bell, Plus } from 'lucide-react';
import { format, differenceInMinutes, subSeconds, addSeconds } from 'date-fns';

interface Location {
  name: string;
  lng: number;
  lat: number;
}

interface JourneyPlannerProps {
  initialDeadline?: string;
  initialOrigin?: Location | null;
  initialDestination?: Location | null;
  onAttachToTask?: (data: any) => void;
}

function LocationAutocomplete({ label, value, onChange, onTextChange }: { label: string, value: Location | null, onChange: (loc: Location | null) => void, onTextChange?: (text: string) => void }) {
  const [query, setQuery] = useState(value ? value.name : '');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (value) {
      setQuery(value.name);
    }
  }, [value]);

  const handleSearch = (text: string) => {
    setQuery(text);
    onTextChange?.(text);
    if (!text) {
      setResults([]);
      setIsOpen(false);
      onChange(null);
      return;
    }
    
    setIsOpen(true);
    setIsLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&countrycodes=in`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error("Geocoding error", err);
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  const handleSelect = (r: any) => {
    const loc = {
      name: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon)
    };
    setQuery(r.display_name);
    setResults([]);
    setIsOpen(false);
    onChange(loc);
  };

  return (
    <div className="relative space-y-1.5">
       <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
       <div className="relative">
         <input 
           type="text"
           placeholder="Search any place in India..."
           className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
           value={query}
           onChange={(e) => handleSearch(e.target.value)}
           onFocus={() => { if (results.length > 0) setIsOpen(true); }}
           onBlur={() => setTimeout(() => setIsOpen(false), 200)}
         />
         <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
         {isLoading && <RefreshCw className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-500" />}
       </div>
       
       {isOpen && results.length > 0 && (
         <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
           {results.map((r, i) => (
             <div 
               key={i} 
               className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer border-b border-white/5 last:border-0"
               onClick={() => handleSelect(r)}
             >
               <div className="truncate">{r.display_name}</div>
             </div>
           ))}
         </div>
       )}
    </div>
  );
}

export default function JourneyPlanner({ initialDeadline, initialOrigin, initialDestination, onAttachToTask }: JourneyPlannerProps) {
  const [origin, setOrigin] = useState<Location | null>(initialOrigin || null);
  const [dest, setDest] = useState<Location | null>(initialDestination || null);
  const [originText, setOriginText] = useState(initialOrigin?.name || '');
  const [destText, setDestText] = useState(initialDestination?.name || '');
  const [arriveBy, setArriveBy] = useState<string>(initialDeadline || '');
  const [departAt, setDepartAt] = useState<string>('');
  const [timeMode, setTimeMode] = useState<'depart' | 'arrive'>(initialDeadline ? 'arrive' : 'depart');
  
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [transportOptions, setTransportOptions] = useState<any[]>([]);
  
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTransportMode, setSelectedTransportMode] = useState<string>('');
  const [journeyAlarmTime, setJourneyAlarmTime] = useState<string>('');
  
  const mapRef = useRef<any>(null);

  // Sync initial props on change (e.g. when clicking View Route on different tasks)
  useEffect(() => {
    if (initialOrigin || initialDestination) {
      setOrigin(initialOrigin || null);
      setDest(initialDestination || null);
      setOriginText(initialOrigin?.name || '');
      setDestText(initialDestination?.name || '');
      setRouteInfo(null);
    }
  }, [initialOrigin, initialDestination]);

  const getRecommend = async (distanceKm: number, durationSec: number, minutesUntilDeadline: number | null) => {
    try {
      setIsLoadingAI(true);
      
      const res = await fetch("/api/journey/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distanceKm, durationSec, minutesUntilDeadline })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTransportOptions(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const geocode = async (text: string) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1&countrycodes=in`);
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          name: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (err) {
      console.error("Geocoding failed for:", text, err);
    }
    return null;
  };

  const handleCalculateClick = async () => {
    if (!originText || !destText) {
      setErrorMsg("Please enter both starting point and destination.");
      return;
    }

    setIsLoadingRoute(true);
    setErrorMsg('');
    
    try {
      let currentOrigin = origin;
      let currentDest = dest;

      // Geocode if missing coordinates or if text changed
      if (!currentOrigin || (currentOrigin.name !== originText && !originText.includes(currentOrigin.name))) {
        const loc = await geocode(originText);
        if (loc) {
          currentOrigin = loc;
          setOrigin(loc);
        } else {
          setErrorMsg(`Could not find the location: "${originText}". Try being more specific.`);
          setIsLoadingRoute(false);
          return;
        }
      }

      if (!currentDest || (currentDest.name !== destText && !destText.includes(currentDest.name))) {
        const loc = await geocode(destText);
        if (loc) {
          currentDest = loc;
          setDest(loc);
        } else {
          setErrorMsg(`Could not find the location: "${destText}". Try being more specific.`);
          setIsLoadingRoute(false);
          return;
        }
      }

      if (currentOrigin && currentDest) {
        await calculateRoute(currentOrigin, currentDest);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Something went wrong. Please check your connection and try again.");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const calculateRoute = async (o: Location, d: Location) => {
    setRouteInfo(null);
    setTransportOptions([]);
    
    try {
      const res = await fetch("/api/journey/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: o, destination: d })
      });
      const data = await res.json();
      
      if (!data.success) {
        setErrorMsg(data.error || "Couldn't calculate the route right now — the routing service may be busy, try again in a moment.");
        return;
      }
      
      const routeData = data.data;
      
      const distanceKm = routeData.distance / 1000;
      const durationSec = routeData.duration;
      
      let leaveByStr = "";
      let minutesUntilDeadline: number | undefined;

      if (timeMode === 'arrive' && arriveBy) {
        const deadlineDate = new Date(arriveBy);
        // buffer: 15 mins
        const leaveDate = subSeconds(deadlineDate, durationSec + 15 * 60);
        leaveByStr = `Leave by ${format(leaveDate, "h:mm a")} to arrive on time`;
        minutesUntilDeadline = differenceInMinutes(deadlineDate, new Date());
        setJourneyAlarmTime(format(leaveDate, "yyyy-MM-dd'T'HH:mm"));
      } else if (timeMode === 'depart' && departAt) {
        const departureDate = new Date(departAt);
        const arrivalDate = addSeconds(departureDate, durationSec);
        leaveByStr = `Depart at ${format(departureDate, "h:mm a")} → Est. Arrival: ${format(arrivalDate, "h:mm a")}`;
        setJourneyAlarmTime(format(departureDate, "yyyy-MM-dd'T'HH:mm"));
      }
      
      setRouteInfo({
        origin: o,
        destination: d,
        distanceKm: distanceKm.toFixed(1),
        durationStr: formatDuration(durationSec),
        durationSec,
        geometry: routeData.geometry.coordinates,
        leaveByStr,
        departAt: timeMode === 'depart' ? departAt : undefined,
        arriveBy: timeMode === 'arrive' ? arriveBy : undefined
      });
      
      if (mapRef.current) {
        const coords = routeData.geometry.coordinates;
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        for (const [lng, lat] of coords) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        
        mapRef.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 80, duration: 1500 }
        );
      }
      
      getRecommend(distanceKm, durationSec, minutesUntilDeadline !== undefined ? minutesUntilDeadline : null);
    } catch (err) {
      console.error(err);
      setErrorMsg("Couldn't calculate the route right now — the routing service may be busy, try again in a moment.");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    // We only trigger automatic calculation if we ALREADY have valid coordinates for both
    if (origin && dest && origin.lat !== 0 && dest.lat !== 0 && !isLoadingRoute) {
      const isNewRoute = !routeInfo || 
        routeInfo.origin.lat !== origin.lat || 
        routeInfo.origin.lng !== origin.lng || 
        routeInfo.destination.lat !== dest.lat || 
        routeInfo.destination.lng !== dest.lng;
        
      if (isNewRoute) {
        setIsLoadingRoute(true);
        calculateRoute(origin, dest).finally(() => setIsLoadingRoute(false));
      }
    }
  }, [origin, dest]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h} hr ${m} min`;
    return `${m} min`;
  };

  const getTransportIcon = (option: string) => {
    const opt = option.toLowerCase();
    if (opt.includes('walk')) return "🚶";
    if (opt.includes('bike') || opt.includes('bicycle') || opt.includes('cycle')) return "🚲";
    if (opt.includes('auto') || opt.includes('rickshaw')) return "🛺";
    if (opt.includes('scooter') || opt.includes('two-wheeler') || opt.includes('motorcycle')) return "🛵";
    if (opt.includes('car') || opt.includes('cab') || opt.includes('taxi') || opt.includes('uber') || opt.includes('ola')) return "🚗";
    if (opt.includes('bus')) return "🚌";
    if (opt.includes('metro') || opt.includes('train')) return "🚆";
    if (opt.includes('flight') || opt.includes('air')) return "✈️";
    return "📍";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[80vh]">
      <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 pb-10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-400" />
            Plan a Journey
          </h2>
          <p className="text-sm text-slate-400 mt-1">Get precise road distances, times, and AI transport recommendations to arrive on time.</p>
        </div>
        
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="space-y-3">
             <LocationAutocomplete 
               label="Starting Point"
               value={origin}
               onChange={setOrigin}
               onTextChange={setOriginText}
             />
             
             <LocationAutocomplete 
               label="Destination"
               value={dest}
               onChange={setDest}
               onTextChange={setDestText}
             />
             
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Time Preference</label>
               <div className="flex bg-slate-950 rounded-xl p-1 border border-white/5 mb-1">
                 <button 
                   onClick={() => setTimeMode('depart')}
                   className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${timeMode === 'depart' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                   DEPART AT
                 </button>
                 <button 
                   onClick={() => setTimeMode('arrive')}
                   className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${timeMode === 'arrive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                   ARRIVE BY
                 </button>
               </div>
               
               {timeMode === 'depart' ? (
                 <input 
                   type="datetime-local"
                   value={departAt}
                   onChange={(e) => setDepartAt(e.target.value)}
                   className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                 />
               ) : (
                 <input 
                   type="datetime-local"
                   value={arriveBy}
                   onChange={(e) => setArriveBy(e.target.value)}
                   className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                 />
               )}
             </div>
          </div>
          
          <button 
            onClick={handleCalculateClick}
            disabled={isLoadingRoute || !originText || !destText}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
          >
            {isLoadingRoute ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            {isLoadingRoute ? "Calculating..." : "Calculate Route"}
          </button>
          
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200">{errorMsg}</p>
            </div>
          )}
        </div>
        
        {routeInfo && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
             <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                   <Car className="w-24 h-24" />
                </div>
                <h3 className="text-lg font-bold text-white flex items-baseline gap-2">
                   {routeInfo.durationStr}
                   <span className="text-sm font-medium text-slate-400">{routeInfo.distanceKm} km</span>
                </h3>
                
                {routeInfo.leaveByStr && (
                  <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                    <p className="text-xs text-indigo-300 font-medium mb-1">Recommended Departure</p>
                    <p className="text-sm text-white font-bold">{routeInfo.leaveByStr}</p>
                    <p className="text-xs text-indigo-200/70 mt-1">Includes a 15-minute buffer.</p>
                  </div>
                )}
             </div>
             
             <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Brain className="w-4 h-4 text-purple-400" />
                  AI Transport Recommendations
                </h4>
                
                {isLoadingAI ? (
                  <div className="p-6 bg-slate-900 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                    <p className="text-xs text-slate-400">Analyzing trip variables...</p>
                  </div>
                ) : transportOptions.length > 0 ? (
                  <div className="space-y-2">
                    {transportOptions.map((opt, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                          console.log("Selected mode:", opt.option);
                          setSelectedTransportMode(opt.option);
                        }}
                        className={`p-4 bg-slate-900 border rounded-2xl transition-all cursor-pointer relative overflow-hidden ${
                          selectedTransportMode === opt.option 
                            ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50' 
                            : 'border-white/5 hover:border-white/10 hover:bg-slate-800'
                        }`}
                      >
                        {selectedTransportMode === opt.option && (
                          <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500 flex items-center justify-center rounded-bl-xl shadow-lg">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                           <div className="flex flex-col">
                             <span className="font-bold text-slate-200 text-sm flex items-center gap-2">
                               <span className="text-xl">{getTransportIcon(opt.option)}</span>
                               {opt.option}
                             </span>
                             <span className="text-[10px] text-indigo-400 font-bold mt-0.5 uppercase tracking-widest bg-indigo-500/10 w-fit px-1.5 py-0.5 rounded">
                               Est. Duration: {opt.duration}
                             </span>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider h-fit ${
                               opt.suitability === 'Best' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                               opt.suitability === 'Good' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                               'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                             }`}>
                               {opt.suitability}
                             </span>
                           </div>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed pr-6">{opt.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-center">
                     <p className="text-xs text-slate-400">No recommendations available.</p>
                  </div>
                )}
              </div>

              {routeInfo && (
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Bell className="w-3 h-3" /> Set Reminder Alarm
                  </label>
                  <input 
                    type="datetime-local"
                    value={journeyAlarmTime}
                    onChange={(e) => setJourneyAlarmTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                  />
                  <p className="text-[10px] text-slate-500 ml-1">We will alert you at this exact time with sound.</p>
                </div>
              )}

             {onAttachToTask && (
               <div className="flex flex-col gap-4 mt-8 pt-6 border-t border-white/5 pb-12">
                 <button 
                   onClick={() => {
                     if (!selectedTransportMode) {
                       alert("Please select a transport mode from the options above before saving.");
                       return;
                     }
                     onAttachToTask({
                       ...routeInfo,
                       selectedMode: selectedTransportMode,
                       alarmTime: journeyAlarmTime,
                       actionType: 'attach'
                     });
                   }}
                   className={`w-full font-bold py-4 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer ${
                     selectedTransportMode 
                       ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' 
                       : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'
                   }`}
                 >
                   <Check className={`w-5 h-5 ${selectedTransportMode ? 'text-white' : 'text-slate-500'}`} />
                   Save to Existing Task
                 </button>
                 <button 
                   onClick={() => {
                     if (!selectedTransportMode) {
                       alert("Please select a transport mode from the options above before saving.");
                       return;
                     }
                     onAttachToTask({
                       ...routeInfo,
                       selectedMode: selectedTransportMode,
                       alarmTime: journeyAlarmTime,
                       actionType: 'new'
                     });
                   }}
                   className={`w-full font-bold py-4 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                     selectedTransportMode 
                       ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' 
                       : 'bg-slate-900 text-slate-500 border border-white/10 hover:bg-slate-800'
                   }`}
                 >
                   <Plus className={`w-5 h-5 ${selectedTransportMode ? 'text-white' : 'text-slate-600'}`} />
                   Save as New Task
                 </button>
                 {!selectedTransportMode && (
                   <p className="text-[10px] text-center text-amber-500/70 font-medium animate-pulse">
                     * Select a transport mode above to enable saving
                   </p>
                 )}
               </div>
             )}
          </div>
        )}
      </div>
      
      <div className="lg:col-span-8 bg-slate-900 rounded-3xl overflow-hidden border border-white/5 relative min-h-[400px]">
         <Map 
           ref={mapRef}
           theme="dark"
           className="absolute inset-0 w-full h-full"
           center={[77.5946, 12.9716]}
           zoom={5}
         >
            <MapControls position="bottom-right" showZoom showCompass />
            
            {routeInfo && (
              <>
                <MapRoute 
                  coordinates={routeInfo.geometry} 
                  color="#6366f1" 
                  width={4} 
                  opacity={0.8}
                />
                <MapMarker longitude={routeInfo.origin.lng} latitude={routeInfo.origin.lat}>
                  <MarkerContent className="bg-indigo-600 rounded-full p-1.5 shadow-lg border-2 border-slate-900 text-white">
                     <MapPin className="w-4 h-4" />
                  </MarkerContent>
                  <MarkerPopup className="bg-slate-900 border-white/10 text-white text-xs font-bold py-1 px-2">
                    {routeInfo.origin.name}
                  </MarkerPopup>
                </MapMarker>
                
                <MapMarker longitude={routeInfo.destination.lng} latitude={routeInfo.destination.lat}>
                  <MarkerContent className="bg-rose-500 rounded-full p-1.5 shadow-lg border-2 border-slate-900 text-white">
                     <MapPin className="w-4 h-4" />
                  </MarkerContent>
                  <MarkerPopup className="bg-slate-900 border-white/10 text-white text-xs font-bold py-1 px-2">
                    {routeInfo.destination.name}
                  </MarkerPopup>
                </MapMarker>
              </>
            )}
         </Map>
      </div>
    </div>
  );
}
