import React, { useState, useRef, useEffect } from "react";
import { 
  X, Sparkles, Plus, Loader2, Calendar, AlertCircle, 
  Mic, MicOff, Upload, Music, Trash2, HelpCircle
} from "lucide-react";
import { Priority, Task } from "../types";
import { extractTasksWithAI_API, addTaskAPI, transcribeAudioAPI } from "../utils/api";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTasksAdded: (newTasks: Task[]) => void;
}

export default function AddTaskModal({ isOpen, onClose, onTasksAdded }: AddTaskModalProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("ai");
  
  // Text & Dictation States
  const [messyText, setMessyText] = useState("");
  const [isAiExtracting, setIsAiExtracting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Option A: Web Speech API States
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [voiceInlineError, setVoiceInlineError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const initialTextRef = useRef("");

  // Option B: Audio File Upload States
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadInlineError, setUploadInlineError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form States
  const [manualTitle, setManualTitle] = useState("");
  const [manualDeadlineDate, setManualDeadlineDate] = useState("");
  const [manualDeadlineTime, setManualDeadlineTime] = useState("");
  const [manualAlarmTime, setManualAlarmTime] = useState("");
  const [manualPriority, setManualPriority] = useState<Priority>("Medium");
  const [manualEstMinutes, setManualEstMinutes] = useState(30);
  const [isManualSaving, setIsManualSaving] = useState(false);

  // Feature-detect Web Speech API support on mount
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechSupported(!!SpeechRecognitionAPI);
  }, []);

  // Sync audioFileUrl when selectedAudioFile changes
  useEffect(() => {
    if (selectedAudioFile) {
      const url = URL.createObjectURL(selectedAudioFile);
      setAudioFileUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setAudioFileUrl(null);
    }
  }, [selectedAudioFile]);

  // Clean up recognition instance on component unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  if (!isOpen) return null;

  // --- Core Task Extraction Pipeline (Shared) ---
  async function extractTasksFromText(textToExtract: string) {
    setIsAiExtracting(true);
    setAiError(null);
    try {
      const extracted = await extractTasksWithAI_API(textToExtract);
      onTasksAdded(extracted);
      setMessyText("");
      setSelectedAudioFile(null);
      setUploadInlineError(null);
      setVoiceInlineError(null);
      onClose();
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Failed to parse text. Please check your spelling or API configuration.");
    } finally {
      setIsAiExtracting(false);
    }
  }

  // --- Option A: Web Speech API Live Dictation ---
  function startListening() {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    setVoiceInlineError(null);
    setUploadInlineError(null);
    setAiError(null);
    initialTextRef.current = messyText;

    try {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let finalTranscriptOfSession = "";
        let interimTranscriptOfSession = "";
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptOfSession += event.results[i][0].transcript + " ";
          } else {
            interimTranscriptOfSession += event.results[i][0].transcript;
          }
        }
        const base = initialTextRef.current.trim();
        const combined = base + (base ? " " : "") + finalTranscriptOfSession + interimTranscriptOfSession;
        setMessyText(combined);
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error Event:", event);
        const errType = event.error;
        if (errType === "no-speech") {
          setVoiceInlineError("Didn't catch that — try again or type instead");
        } else if (errType === "audio-capture") {
          setVoiceInlineError("No microphone found");
        } else if (errType === "not-allowed") {
          setVoiceInlineError("Microphone access was blocked — check your browser permissions");
        } else {
          setVoiceInlineError("Voice input hit a snag — you can keep typing instead");
        }
        stopListening();
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err: any) {
      console.error(err);
      setVoiceInlineError("Voice input hit a snag — you can keep typing instead");
      setIsListening(false);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // --- Option B: Audio File Upload Validation & Transcription ---
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadInlineError(null);
    setVoiceInlineError(null);
    setAiError(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ["mp3", "wav", "m4a"];
    if (!allowedExtensions.includes(ext || "")) {
      setUploadInlineError("Unsupported file format. Only .mp3, .wav, and .m4a files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadInlineError("Audio file exceeds the 20MB limit. Please upload a smaller file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedAudioFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleTranscribeAndExtract() {
    if (!selectedAudioFile) return;
    setIsTranscribing(true);
    setUploadInlineError(null);
    setAiError(null);

    const reader = new FileReader();
    reader.readAsDataURL(selectedAudioFile);
    reader.onloadend = async () => {
      try {
        const base64data = reader.result as string;
        const base64Content = base64data.split(",")[1];
        
        // Phase 1: Transcribe using Gemini API via backend
        const transcript = await transcribeAudioAPI(base64Content, selectedAudioFile.type);
        if (!transcript.trim()) {
          setUploadInlineError("Couldn't make out any speech in that file — try a clearer recording");
          setIsTranscribing(false);
          return;
        }

        // Phase 2: Insert into same text area visibly
        setMessyText(transcript);

        // Phase 3: Run directly through same extraction pipeline
        await extractTasksFromText(transcript);
      } catch (err: any) {
        console.error(err);
        setUploadInlineError("Transcription failed — you can try again or type your tasks instead");
      } finally {
        setIsTranscribing(false);
      }
    };
    reader.onerror = () => {
      setUploadInlineError("Failed to read audio file. Try a different file.");
      setIsTranscribing(false);
    };
  }

  // --- Standard Event Handlers ---
  async function handleAiExtractSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!messyText.trim()) return;
    await extractTasksFromText(messyText);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    setIsManualSaving(true);

    let deadline = "no deadline";
    if (manualDeadlineDate) {
      const timeStr = manualDeadlineTime || "12:00";
      deadline = new Date(`${manualDeadlineDate}T${timeStr}:00`).toISOString();
    }
    
    let alarmTime: string | undefined = undefined;
    if (manualAlarmTime && manualDeadlineDate) {
      alarmTime = new Date(`${manualDeadlineDate}T${manualAlarmTime}:00`).toISOString();
    }

    try {
      const newTask = await addTaskAPI({
        title: manualTitle,
        deadline,
        alarmTime,
        priority: manualPriority,
        estimatedMinutes: manualEstMinutes,
        source: "manual"
      });
      onTasksAdded([newTask]);
      setManualTitle("");
      setManualDeadlineDate("");
      setManualDeadlineTime("");
      setManualPriority("Medium");
      setManualEstMinutes(30);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsManualSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in" id="add-task-modal-container">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
        id="add-task-modal-card"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950/40">
          <div>
            <h3 className="text-lg font-semibold text-white font-display tracking-tight flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Add Task to the Life Saver
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Capture your commitments using voice, upload transcripts, or typing</p>
          </div>
          <button 
            onClick={() => {
              stopListening();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            onClick={() => {
              stopListening();
              setActiveTab("ai");
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "ai"
                ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Smart Capture
          </button>
          <button
            onClick={() => {
              stopListening();
              setActiveTab("manual");
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "manual"
                ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Manual Standard Entry
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "ai" ? (
            <div className="space-y-4">
              <form onSubmit={handleAiExtractSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                      Describe what you need to do
                    </label>
                    
                    {/* Toolbar with Microphone & Upload Side by Side */}
                    <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-white/5">
                      {isSpeechSupported && (
                        <button
                          type="button"
                          onClick={toggleListening}
                          className={`p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative ${
                            isListening 
                              ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20" 
                              : "bg-slate-800 hover:bg-slate-750 text-slate-300"
                          }`}
                          title={isListening ? "Stop live dictation" : "Start live dictation"}
                        >
                          <Mic className={`w-3.5 h-3.5 ${isListening ? "animate-pulse" : ""}`} />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 transition-all flex items-center justify-center cursor-pointer"
                        title="Upload audio file (.mp3, .wav, .m4a)"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      
                      {/* Hidden File Input */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".mp3,.wav,.m4a"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>
                  
                  {/* Glowing border text area if listening */}
                  <div className="relative">
                    <textarea
                      value={messyText}
                      onChange={(e) => setMessyText(e.target.value)}
                      placeholder={
                        isListening 
                          ? "Listening... Speak naturally to narrate your task details..." 
                          : "e.g. 'I need to finalize the quarterly slides by tomorrow afternoon, also remember to buy groceries tonight (high priority) and call Mom sometime next week which should take about 15 minutes.'"
                      }
                      rows={5}
                      className={`w-full rounded-xl bg-slate-950/50 border px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none font-sans ${
                        isListening 
                          ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] focus:border-red-500" 
                          : "border-white/10"
                      }`}
                      required
                    />
                    
                    {isListening && (
                      <div className="absolute right-3 bottom-3 flex items-center gap-1.5 bg-slate-900/90 border border-red-500/20 px-2 py-1 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                        <span className="text-[9px] text-red-400 font-mono tracking-wider font-semibold">LISTENING</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Microphone / Dictation Inline Feedback Errors */}
                {voiceInlineError && (
                  <div className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Dictation Error</span>
                      {voiceInlineError}
                    </div>
                  </div>
                )}

                {/* Option B: Selected Audio File Player Panel */}
                {selectedAudioFile && (
                  <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">
                            {selectedAudioFile.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {(selectedAudioFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAudioFile(null);
                          setUploadInlineError(null);
                        }}
                        className="p-1 text-slate-500 hover:text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
                        title="Remove selected audio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Remove</span>
                      </button>
                    </div>
                    
                    {/* Native player preview */}
                    {audioFileUrl && (
                      <div className="pt-1">
                        <audio src={audioFileUrl} controls className="w-full h-8 rounded-lg" />
                      </div>
                    )}
                    
                    <button
                      type="button"
                      disabled={isTranscribing}
                      onClick={handleTranscribeAndExtract}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Transcribing your audio...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Transcribe & Extract Tasks
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Option B: Audio Upload Inline Errors */}
                {uploadInlineError && (
                  <div className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Audio File Issue</span>
                      {uploadInlineError}
                    </div>
                  </div>
                )}

                {/* Global AI Pipeline Error */}
                {aiError && (
                  <div className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Extraction Warning</span>
                      {aiError}
                    </div>
                  </div>
                )}

                {/* Action submit button */}
                <button
                  type="submit"
                  disabled={isAiExtracting || isListening || !messyText.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-xl hover:shadow-indigo-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-95 disabled:opacity-45 disabled:scale-100"
                >
                  {isAiExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Extracting & Parsing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Extract Tasks with AI
                    </>
                  )}
                </button>
              </form>

              <div className="bg-slate-950/20 border border-white/5 rounded-2xl p-3 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <strong>Permanent Typable Fallback</strong>: Manual typing remains active at all times. Use the top toolbar to overlay voice dictation or file transcripts directly into the compiler.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Task Title</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Review engineering document..."
                  className="w-full rounded-xl bg-slate-950/50 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Deadline Date</label>
                  <input
                    type="date"
                    value={manualDeadlineDate}
                    onChange={(e) => setManualDeadlineDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-950/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Time</label>
                  <input
                    type="time"
                    value={manualDeadlineTime}
                    onChange={(e) => setManualDeadlineTime(e.target.value)}
                    className="w-full rounded-xl bg-slate-950/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Alarm Time (Optional)</label>
                  <input
                    type="time"
                    value={manualAlarmTime}
                    onChange={(e) => setManualAlarmTime(e.target.value)}
                    className="w-full rounded-xl bg-slate-950/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Estimate (Minutes)</label>
                  <input
                    type="number"
                    value={manualEstMinutes}
                    onChange={(e) => setManualEstMinutes(Math.max(5, parseInt(e.target.value) || 0))}
                    className="w-full rounded-xl bg-slate-950/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    min={5}
                    step={5}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Priority</label>
                <select
                  value={manualPriority}
                  onChange={(e) => setManualPriority(e.target.value as Priority)}
                  className="w-full rounded-xl bg-slate-950/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors [&>option]:bg-slate-900"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isManualSaving || !manualTitle.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-xl hover:shadow-indigo-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 hover:scale-[1.01] active:scale-95 disabled:opacity-40"
              >
                {isManualSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Save Task
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
