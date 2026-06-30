import React, { useState, useEffect, useRef } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Search, Navigation, MapPin, Bus, Car, Footprints, Info } from 'lucide-react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function RoutingControl({ initialOrigin, initialDestination }: { initialOrigin?: string, initialDestination?: string }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const placesLibrary = useMapsLibrary('places');

  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  const [origin, setOrigin] = useState(initialOrigin || '');
  const [destination, setDestination] = useState(initialDestination || '');
  const [travelMode, setTravelMode] = useState<google.maps.TravelMode | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string, duration: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialOrigin) setOrigin(initialOrigin);
    if (initialDestination) setDestination(initialDestination);
  }, [initialOrigin, initialDestination]);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ map }));
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!placesLibrary || !originInputRef.current || !destInputRef.current) return;
    const originAutocomplete = new placesLibrary.Autocomplete(originInputRef.current, {
        componentRestrictions: { country: 'IN' },
        fields: ['place_id', 'geometry', 'name', 'formatted_address']
    });
    const destAutocomplete = new placesLibrary.Autocomplete(destInputRef.current, {
        componentRestrictions: { country: 'IN' },
        fields: ['place_id', 'geometry', 'name', 'formatted_address']
    });
    originAutocomplete.addListener('place_changed', () => {
      setOrigin(originInputRef.current?.value || '');
    });
    destAutocomplete.addListener('place_changed', () => {
      setDestination(destInputRef.current?.value || '');
    });
  }, [placesLibrary]);

  useEffect(() => {
    if (routesLibrary) {
        setTravelMode(routesLibrary.TravelMode.DRIVING);
    }
  }, [routesLibrary]);

  const calculateRoute = () => {
    if (!directionsService || !directionsRenderer || !origin || !destination || !travelMode) return;
    setErrorMsg('');
    setRouteInfo(null);
    directionsService.route(
      {
        origin,
        destination,
        travelMode: travelMode,
        provideRouteAlternatives: true
      },
      (response, status) => {
        if (status === 'OK' && response) {
          directionsRenderer.setDirections(response);
          const route = response.routes[0]?.legs[0];
          if (route) {
             setRouteInfo({
                distance: route.distance?.text || '',
                duration: route.duration?.text || ''
             });
          }
        } else {
          setErrorMsg('Could not find a route between these locations.');
          directionsRenderer.setDirections({ routes: [] } as any);
        }
      }
    );
  };

  const travelModes = routesLibrary ? [
    { mode: routesLibrary.TravelMode.DRIVING, icon: <Car className="w-5 h-5" />, label: 'Car' },
    { mode: routesLibrary.TravelMode.TRANSIT, icon: <Bus className="w-5 h-5" />, label: 'Transit' },
    { mode: routesLibrary.TravelMode.WALKING, icon: <Footprints className="w-5 h-5" />, label: 'Walk' },
  ] : [];

  return (
    <div className="absolute top-4 left-4 z-10 w-80 bg-slate-900 shadow-xl rounded-2xl overflow-hidden border border-white/10 flex flex-col">
       <div className="bg-indigo-600 p-4 pb-2 space-y-3">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                 <MapPin className="w-4 h-4 text-indigo-600" />
             </div>
             <span className="text-white font-bold text-lg tracking-tight">Map</span>
          </div>
          <div className="flex gap-2">
            {travelModes.map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => { setTravelMode(mode); setTimeout(calculateRoute, 100); }}
                className={`p-2 rounded-full transition-colors ${travelMode === mode ? 'bg-white/20 text-white' : 'text-indigo-200 hover:bg-white/10'}`}
                title={label}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="space-y-2 relative">
             <div className="flex items-center bg-slate-900 rounded-lg overflow-hidden pr-2">
                <MapPin className="w-4 h-4 ml-3 text-indigo-400 shrink-0" />
                <input 
                    ref={originInputRef}
                    type="text" 
                    placeholder="Choose starting point"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    className="w-full bg-transparent p-2 text-sm text-white focus:outline-none placeholder-slate-500"
                />
             </div>
             <div className="flex items-center bg-slate-900 rounded-lg overflow-hidden pr-2">
                <Navigation className="w-4 h-4 ml-3 text-rose-400 shrink-0" />
                <input 
                    ref={destInputRef}
                    type="text" 
                    placeholder="Choose destination"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    className="w-full bg-transparent p-2 text-sm text-white focus:outline-none placeholder-slate-500"
                />
             </div>
          </div>
          <div className="pt-2">
            <button 
                onClick={calculateRoute}
                disabled={!origin || !destination}
                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg text-sm transition-colors"
            >
                Get Directions
            </button>
          </div>
       </div>

       {(routeInfo || errorMsg) && (
           <div className="p-4 bg-slate-900 border-t border-white/5">
              {errorMsg ? (
                  <p className="text-sm text-rose-400">{errorMsg}</p>
              ) : routeInfo && (
                  <div>
                      <h3 className="text-lg font-bold text-white mb-1">
                          {routeInfo.duration}
                      </h3>
                      <p className="text-slate-400 text-sm">{routeInfo.distance}</p>
                      
                      <div className="mt-3 flex items-start gap-2 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-indigo-200">
                             Keep deadlines in mind! Leave earlier to account for potential traffic or congestion.
                          </p>
                      </div>
                  </div>
              )}
           </div>
       )}
    </div>
  );
}

export default function MapsDashboard({ initialOrigin, initialDestination }: { initialOrigin?: string, initialDestination?: string }) {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-8 text-center bg-slate-900 text-slate-200 rounded-3xl border border-white/5 shadow-2xl">
        <MapPin className="w-12 h-12 text-indigo-500 mb-4" />
        <h2 className="text-xl font-bold mb-4 text-white">Google Maps API Key Required</h2>
        <p className="mb-4 text-sm text-slate-400 max-w-md">
          To view the interactive map, you need to provide a valid Google Maps Platform API key.
        </p>
        <div className="bg-slate-950 p-6 rounded-xl border border-white/10 text-left">
          <p className="text-sm text-slate-300 font-semibold mb-2">How to add your key:</p>
          <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
            <li>Open the <strong>Settings</strong> menu (gear icon).</li>
            <li>Go to the <strong>Secrets</strong> section.</li>
            <li>Add a new secret named <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
            <li>Paste your Google Maps API key and save.</li>
          </ol>
        </div>
        <a 
          href="https://console.cloud.google.com/google/maps-apis/start" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Get an API Key
        </a>
      </div>
    );
  }

  return (
    <div className="h-[80vh] w-full rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative" id="maps-dashboard">
      <APIProvider apiKey={API_KEY} version="weekly" libraries={['places', 'routes']}>
        <Map
          defaultCenter={{ lat: 20.5937, lng: 78.9629 }} // Center of India
          defaultZoom={5}
          mapId="INDIA_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          disableDefaultUI={true}
          className="w-full h-full"
        >
           <RoutingControl initialOrigin={initialOrigin} initialDestination={initialDestination} />
        </Map>
      </APIProvider>
    </div>
  );
}
