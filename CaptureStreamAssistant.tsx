import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Loader2, 
  Mic, 
  MicOff, 
  Search, 
  Mail, 
  Copy, 
  Check, 
  Globe, 
  Upload, 
  HelpCircle,
  FileText
} from "lucide-react";
import { queryAIAssistantAPI, transcribeAudioAPI } from "../utils/api";

const INDIAN_LANGUAGES = [
  { name: "English (India)", code: "en-IN", native: "English" },
  { name: "Hindi", code: "hi-IN", native: "हिन्दी" },
  { name: "Bengali", code: "bn-IN", native: "বাংলা" },
  { name: "Tamil", code: "ta-IN", native: "தமிழ்" },
  { name: "Telugu", code: "te-IN", native: "తెలుగు" },
  { name: "Marathi", code: "mr-IN", native: "मराठी" },
  { name: "Gujarati", code: "gu-IN", native: "ગુજરાતી" },
  { name: "Kannada", code: "kn-IN", native: "ಕನ್ನಡ" },
  { name: "Malayalam", code: "ml-IN", native: "മലയാളம்" },
  { name: "Punjabi", code: "pa-IN", native: "ਪੰਜਾਬੀ" },
  { name: "Urdu", code: "ur-IN", native: "اردو" },
];

export default function CaptureStreamAssistant() {
  const [query, setQuery] = useState("");
  const [selectedLang, setSelectedLang] = useState(INDIAN_LANGUAGES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Voice recording / Speech-to-text state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // File Upload State for fallback transcription
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Initialize browser SpeechRecognition
  useEffect(() => {
    const SpeechRecognitionClass = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuery(prev => prev ? `${prev} ${transcript}`.trim() : transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone permission denied. Please enable microphone access.");
        } else {
          setErrorMsg(`Voice search error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Update recognition language when user changes dropdown selection
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = selectedLang.code;
    }
  }, [selectedLang]);

  function toggleListening() {
    if (!recognitionRef.current) {
      setErrorMsg("Your current browser does not support native speech recognition. Try using Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition", err);
      }
    }
  }

  // Handle direct file upload and transcription
  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.endsWith(".mp3") && !file.name.endsWith(".wav") && !file.name.endsWith(".m4a")) {
      setErrorMsg("Only audio files (.mp3, .wav, .m4a) are supported.");
      return;
    }

    setIsTranscribing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const base64data = reader.result as string;
        const base64Content = base64data.split(",")[1];
        
        const transcript = await transcribeAudioAPI(base64Content, file.type);
        if (transcript.trim()) {
          setQuery(prev => prev ? `${prev} ${transcript}`.trim() : transcript);
        } else {
          setErrorMsg("Could not recognize speech in the audio file.");
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Failed to transcribe audio file.");
      } finally {
        setIsTranscribing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setResponse(null);

    try {
      const answer = await queryAIAssistantAPI(query, selectedLang.name);
      setResponse(answer);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to get response from AI Assistant.");
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = () => {
    if (!response) return;
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple, high-reliability markdown-ish formatter
  const renderResponseText = (text: string) => {
    return text.split("\n").map((line, idx) => {
      // Check for code blocks
      if (line.startsWith("```")) {
        return null; // hide backticks line
      }
      // Bullet points
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-slate-300 leading-relaxed mb-1">
            {line.substring(2)}
          </li>
        );
      }
      // Headings
      if (line.startsWith("### ")) {
        return (
          <h6 key={idx} className="text-xs font-bold text-indigo-300 mt-3 mb-1 uppercase tracking-wider font-mono">
            {line.substring(4)}
          </h6>
        );
      }
      if (line.startsWith("## ") || line.startsWith("# ")) {
        return (
          <h5 key={idx} className="text-sm font-bold text-white mt-4 mb-2 font-display">
            {line.replace(/^#+\s+/, "")}
          </h5>
        );
      }
      // Regular line
      return line.trim() ? (
        <p key={idx} className="text-xs text-slate-300 leading-relaxed mb-2.5">
          {line}
        </p>
      ) : (
        <div key={idx} className="h-2" />
      );
    });
  };

  const handleShortcut = (shortcutText: string) => {
    setQuery(shortcutText);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 border border-white/20 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl shadow-indigo-500/40 relative overflow-hidden" id="ai-assistant-capture-card">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none" />
      
      {/* Card Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/20 border border-white/30 shadow-inner backdrop-blur-sm">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h5 className="text-sm font-extrabold text-white uppercase tracking-widest font-display">
              Pulse Intelligence
            </h5>
            <p className="text-[10px] text-indigo-100 font-mono tracking-wider">AI COMPANION</p>
          </div>
        </div>
        <span className="text-[10px] bg-white text-indigo-700 px-3 py-1 rounded-full font-bold shadow-lg uppercase tracking-widest">
          Active
        </span>
      </div>

      <p className="text-sm text-indigo-50 leading-relaxed relative z-10 font-medium">
        Your autonomous co-pilot. Draft emails, translate languages, or run knowledge searches instantly. Speak or type in any Indian language.
      </p>

      {/* Language Selection & Recording Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/20 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-indigo-200 shrink-0" />
          <select
            value={selectedLang.code}
            onChange={(e) => {
              const lang = INDIAN_LANGUAGES.find(l => l.code === e.target.value);
              if (lang) setSelectedLang(lang);
            }}
            className="bg-transparent text-[11px] font-semibold text-slate-200 focus:outline-none cursor-pointer hover:text-indigo-300 transition-colors"
          >
            {INDIAN_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code} className="bg-slate-950 text-slate-300">
                {lang.name} ({lang.native})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-indigo-300 border border-white/5 transition-all text-[10px] flex items-center gap-1 cursor-pointer"
            title="Upload pre-recorded audio file"
            disabled={isTranscribing || isLoading}
          >
            {isTranscribing ? (
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            <span className="sr-only">Upload Audio</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAudioUpload}
            accept="audio/*"
            className="hidden"
          />
        </div>
      </div>

      {/* Main input query form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading || isListening}
            placeholder={`Type or tap mic to speak in ${selectedLang.name}...`}
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 pr-10 text-xs text-slate-200 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 resize-none placeholder:text-slate-600 font-sans min-h-[95px] leading-normal shadow-inner"
            required
          />

          {/* Micro-audio active visualizer */}
          {isListening && (
            <div className="absolute right-3 top-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              <span className="text-[9px] font-mono font-bold text-indigo-400">Listening...</span>
            </div>
          )}

          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2 rounded-lg transition-all cursor-pointer border ${
                isListening 
                  ? "bg-rose-500/25 border-rose-500/40 text-rose-300 animate-pulse" 
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-indigo-300 hover:bg-white/10"
              }`}
              title={isListening ? "Stop listening" : "Speak (Voice search)"}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Action button */}
        <button
          type="submit"
          disabled={isLoading || isListening || !query.trim()}
          className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-900 disabled:opacity-40 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/10"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" />
              <span>Querying AI Engine...</span>
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5 text-slate-900" />
              <span className="text-slate-900 font-extrabold tracking-wide">Ask Assistant / Search</span>
            </>
          )}
        </button>
      </form>

      {/* Suggested Fast Shortcuts */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono font-black text-white uppercase tracking-widest block drop-shadow-sm">
          ★ SUGGESTED COMMANDS
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleShortcut("Draft a formal leave application for today.")}
            className="text-[10px] bg-white border border-white hover:bg-slate-100 px-3 py-1.5 rounded-lg text-slate-900 hover:text-slate-900 transition-all cursor-pointer flex items-center gap-1.5 font-sans font-extrabold shadow-sm"
          >
            <Mail className="w-2.5 h-2.5 text-slate-900" />
            Draft Mail
          </button>
          <button
            type="button"
            onClick={() => handleShortcut("Explain how a search engine works in 3 simple sentences.")}
            className="text-[10px] bg-white border border-white hover:bg-slate-100 px-3 py-1.5 rounded-lg text-slate-900 hover:text-slate-900 transition-all cursor-pointer flex items-center gap-1.5 font-sans font-extrabold shadow-sm"
          >
            <Search className="w-2.5 h-2.5 text-slate-900" />
            General Search
          </button>
          <button
            type="button"
            onClick={() => handleShortcut(`Can you translate "I will complete my pending tasks today" into ${selectedLang.name}?`)}
            className="text-[10px] bg-white border border-white hover:bg-slate-100 px-3 py-1.5 rounded-lg text-slate-900 hover:text-slate-900 transition-all cursor-pointer flex items-center gap-1.5 font-sans font-extrabold shadow-sm"
          >
            <Globe className="w-2.5 h-2.5 text-slate-900" />
            Translate
          </button>
        </div>
      </div>

      {/* Error Output block */}
      {errorMsg && (
        <div className="p-3 bg-red-950/15 border border-red-500/20 text-red-300 rounded-xl text-xs flex items-start gap-2 animate-fade-in leading-relaxed">
          <HelpCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Output block */}
      {response && (
        <div className="border border-indigo-500/20 bg-slate-950/70 rounded-2xl p-4 space-y-3 relative overflow-hidden animate-fade-in shadow-inner max-h-[300px] overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3" />
              AI Assistant Response
            </span>
            <button
              onClick={copyToClipboard}
              className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-200 border border-indigo-500/20 transition-all cursor-pointer flex items-center gap-1 text-[10px]"
              title="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="prose prose-invert max-w-none text-slate-200 font-sans break-words whitespace-pre-wrap leading-relaxed">
            {renderResponseText(response)}
          </div>
        </div>
      )}
    </div>
  );
}
