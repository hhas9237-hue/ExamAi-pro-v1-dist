
import React, { useState, useRef, useEffect } from 'react';
import { QuizConfig, QuizMode, SessionBackup, ExamResult, AIConfig } from '../types';
import { 
  LucidePlay, LucideRotateCcw, LucideFileText, LucideLoader2, LucideShuffle, 
  LucideX, LucideTrash2, LucideSparkles, LucideUser, LucideSave, LucideFolderOpen, 
  LucideDatabase, LucideWand2, LucideArrowUp, LucideLayout, LucidePlus, LucideImage,
  LucideDownload, LucideUpload, LucidePaperclip, LucideFile, LucideMoon, LucideSun,
  LucideUndo, LucideRedo, LucidePencil, LucideLock, LucideUnlock
} from 'lucide-react';
import { parseQuestions, extractExamName, generateBackupFilename } from '../utils/parser';
import { generateAIResponse, Message } from '../utils/aiService';
import { AISettingsModal } from './AISettingsModal';

interface VisualQuestion {
  q: string;
  opt: { ক: string; খ: string; গ: string; ঘ: string };
  a: string;
}

const VisualQuestionCard = React.memo(({ 
  vq, 
  idx, 
  onUpdate, 
  onRemove, 
  onTriggerImage 
}: { 
  vq: VisualQuestion; 
  idx: number; 
  onUpdate: (idx: number, field: string, value: string) => void;
  onRemove: (idx: number) => void;
  onTriggerImage: (idx: number, field: string) => void;
}) => {
  const [localQ, setLocalQ] = useState(vq.q);
  const [localOpt, setLocalOpt] = useState(vq.opt);
  
  // Sync changes from parent if they happen (like adding images)
  useEffect(() => { setLocalQ(vq.q); }, [vq.q]);
  useEffect(() => { setLocalOpt(vq.opt); }, [vq.opt]);

  return (
    <div className="p-2 border border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-900/10 rounded-lg relative">
      <div className="absolute -top-1.5 left-2 px-1.5 py-0 bg-blue-600 text-white text-[0.5rem] font-bold rounded">#{idx + 1}</div>
      <button 
        onClick={() => onRemove(idx)} 
        className="absolute -top-1.5 right-2 p-0.5 bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/50 text-red-500 rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30"
      >
        <LucideTrash2 size={10} />
      </button>
      
      <div className="space-y-2 pt-1">
        <div className="relative">
            <textarea 
              className="w-full p-2 pr-8 border border-gray-300 dark:border-gray-700 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-black dark:text-white min-h-[3.125rem]"
              placeholder="প্রশ্ন লিখুন..."
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              onBlur={() => onUpdate(idx, 'q', localQ)}
            />
            <button onClick={() => onTriggerImage(idx, 'q')} className="absolute right-1 top-1 p-1 text-gray-400 hover:text-blue-500"><LucideImage size={14} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {['ক', 'খ', 'গ', 'ঘ'].map((key) => (
              <div key={key} className="relative flex items-center gap-1.5">
                  <div className="w-4 h-4 shrink-0 flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[0.5rem] font-bold rounded-full">{key}</div>
                  <input 
                    type="text"
                    className="flex-1 p-1 pr-6 border border-gray-300 dark:border-gray-700 rounded text-[0.625rem] bg-white dark:bg-black dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder={`অপশন ${key}...`}
                    value={(localOpt as any)[key]}
                    onChange={(e) => setLocalOpt({ ...localOpt, [key]: e.target.value })}
                    onBlur={() => onUpdate(idx, key, (localOpt as any)[key])}
                  />
                  <button onClick={() => onTriggerImage(idx, key)} className="absolute right-0.5 top-0.5 p-1 text-gray-400 hover:text-blue-500"><LucideImage size={12} /></button>
              </div>
            ))}
        </div>

        <div className="flex items-center gap-2 border-t border-blue-50 dark:border-blue-900/30 pt-1.5">
            <span className="text-[0.5rem] font-bold text-gray-400 uppercase tracking-widest">সঠিক উত্তর:</span>
            <div className="flex gap-1">
              {['ক', 'খ', 'গ', 'ঘ'].map(key => (
                  <button 
                    key={key}
                    onClick={() => onUpdate(idx, 'a', key)}
                    className={`w-6 h-6 flex items-center justify-center rounded border font-bold text-[0.625rem] transition-all ${vq.a === key ? 'bg-green-600 text-white border-green-700 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                  >
                    {key}
                  </button>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
});

interface SetupViewProps {
  rawInput: string;
  setRawInput: React.Dispatch<React.SetStateAction<string>>;
  config: QuizConfig;
  setConfig: React.Dispatch<React.SetStateAction<QuizConfig>>;
  stats: { total: number; taken: number | string; remaining: number | string };
  history: ExamResult[];
  progress: { nextSerialIndex: number; usedRandomIndices: number[] };
  onImportData: (data: any) => void;
  onStart: () => void;
  onReset: () => void;
  aiConfig: AIConfig | null;
  onSetAiConfig: (config: AIConfig) => void;
  onRemoveAiConfig: () => void;
  onOpenSidebar: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const AIPromptInput = ({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) => {
    const [localVal, setLocalVal] = useState(value);
    
    useEffect(() => { setLocalVal(value); }, [value]);

    return (
        <textarea 
            className="w-full flex-1 p-2 text-xs focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none leading-relaxed placeholder-gray-400 dark:placeholder-gray-500" 
            placeholder="বিষয় লিখুন (যেমন: বাংলাদেশের নদী)..." 
            value={localVal} 
            onChange={(e) => {
                const val = e.target.value;
                setLocalVal(val);
                // Update parent immediately if transitioning between empty/non-empty to fix button state, otherwise debounce heavily or just let the local state handle the visual typing immediately
                if ((!val.trim() && value.trim()) || (val.trim() && !value.trim())) {
                  onChange(val);
                } else {
                  if ((window as any)._promptTimeout) clearTimeout((window as any)._promptTimeout);
                  (window as any)._promptTimeout = setTimeout(() => onChange(val), 500);
                }
            }}
            onBlur={() => onChange(localVal)}
            disabled={disabled}
        />
    );
};

const AIRecentInput = ({ value, onChange, onFocus, onEnter, disabled }: { value: string, onChange: (v: string) => void, onFocus: () => void, onEnter: () => void, disabled: boolean }) => {
    const [localVal, setLocalVal] = useState(value);
    
    useEffect(() => { setLocalVal(value); }, [value]);

    return (
        <input 
            type="text" 
            className="flex-1 h-10 px-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs focus:outline-none focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" 
            placeholder="বিষয় লিখুন..." 
            value={localVal} 
            onChange={(e) => {
                const val = e.target.value;
                setLocalVal(val);
                if ((!val.trim() && value.trim()) || (val.trim() && !value.trim())) {
                  onChange(val);
                } else {
                  if ((window as any)._recentTimeout) clearTimeout((window as any)._recentTimeout);
                  (window as any)._recentTimeout = setTimeout(() => onChange(val), 500);
                }
            }} 
            onBlur={() => onChange(localVal)}
            onFocus={onFocus}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onChange(localVal); // Make sure parent state is synced before generating
                    setTimeout(() => onEnter(), 50);
                }
            }} 
            disabled={disabled} 
        />
    );
};

const EditorModal = ({
    initialText, 
    onSave, 
    onClose 
}: { 
    initialText: string; 
    onSave: (val: string) => void; 
    onClose: () => void; 
}) => {
    const [editorText, setEditorText] = useState(initialText);
    const [isEditorLocked, setIsEditorLocked] = useState(true);
    const [undoStack, setUndoStack] = useState<string[]>([]);
    const [redoStack, setRedoStack] = useState<string[]>([]);

    const typingTimeoutRef = useRef<any>(null);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const currentText = editorText;
        
        setEditorText(val);
        setRedoStack([]);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        } else {
            // First keystroke in a new batch: save current state to undo stack
            setUndoStack(prev => [...prev, currentText].slice(-30));
        }

        typingTimeoutRef.current = setTimeout(() => {
            typingTimeoutRef.current = null; // end of typing batch
        }, 500);
    };

    const handleUndo = () => {
        if (undoStack.length > 0) {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            const prev = undoStack[undoStack.length - 1];
            setRedoStack(prevStack => [...prevStack, editorText].slice(-30));
            setUndoStack(prevStack => prevStack.slice(0, -1));
            setEditorText(prev);
        }
    };
    
    const handleRedo = () => {
        if (redoStack.length > 0) {
             if (typingTimeoutRef.current) {
                 clearTimeout(typingTimeoutRef.current);
                 typingTimeoutRef.current = null;
             }
             const next = redoStack[redoStack.length - 1];
             setUndoStack(prevStack => [...prevStack, editorText].slice(-30));
             setRedoStack(prevStack => prevStack.slice(0, -1));
             setEditorText(next);
        }
    };
    
    const handleClearEditor = () => {
        if (!editorText) return;
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        setUndoStack(prev => [...prev, editorText].slice(-30));
        setRedoStack([]);
        setEditorText("");
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 shadow-sm relative z-20">
              <h2 className="text-base font-extrabold select-none">প্রশ্ন বক্স</h2>
              <div className="flex gap-2">
                  <button onClick={() => setIsEditorLocked(!isEditorLocked)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" title={isEditorLocked ? "সম্পাদনা করুন" : "লক করুন"}>
                      {isEditorLocked ? <LucideLock size={18} className="text-gray-500" /> : <LucideUnlock size={18} className="text-amber-600 dark:text-amber-500" />}
                  </button>
                  <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <LucideX size={18} className="text-gray-600 dark:text-gray-400" />
                  </button>
              </div>
          </div>
          <div className="flex-1 relative flex flex-col bg-gray-50 dark:bg-gray-950">
              <div className="flex-1 w-full relative flex flex-col min-h-0">
                  <textarea 
                      className={`flex-1 w-full p-4 bg-transparent border-none focus:ring-0 text-sm font-mono resize-none outline-none relative z-10 text-gray-900 dark:text-gray-100 ${isEditorLocked ? 'cursor-not-allowed opacity-90' : ''}`}
                      value={editorText}
                      onChange={handleTextChange}
                      placeholder=""
                      readOnly={isEditorLocked}
                  />
                  {!editorText && (
                      <div className="absolute inset-0 p-4 pointer-events-none text-gray-500 dark:text-gray-400 font-mono text-sm z-0 opacity-50">
                          <div className="text-[1.1em]">সঠিক ফরমেটে প্রশ্ন লিখুন বা পেস্ট করুন...</div>
                          <div className="mt-2 leading-relaxed whitespace-pre-wrap">
{`উদাহরণ:
জাপানের মুদ্রা? | ইয়েন | রিয়াল | ডলার | টাকা | ক ###
বাংলাদেশের রাজধানী? | ঢাকা | খুলনা | রাজশাহী | বরিশাল | ক ###`}
                          </div>
                          <div className="mt-6 pt-4 border-t border-gray-400 dark:border-gray-500 font-bold">
                              N.B. ছবি বা সিম্বল যোগ করতে প্রশ্ন বা অপশনের শেষে [img:url] বা [icon:info] লিখুন অথবা প্রশ্ন ফর্ম ব্যবহার করুন।
                          </div>
                      </div>
                  )}
              </div>
              {!isEditorLocked && (
                          <>
                              <div className="absolute top-3 right-3 z-30">
                                  <button onClick={handleClearEditor} disabled={!editorText.trim()} className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border transition-colors ${!editorText.trim() ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed shadow-none' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 border-gray-200 dark:border-gray-700'}`} title="মুছে ফেলুন">
                                      <LucideTrash2 size={16} />
                                  </button>
                              </div>
                              <div className="absolute bottom-4 right-4 z-30 flex gap-2">
                                  <button onClick={handleUndo} disabled={undoStack.length === 0} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 shadow-sm disabled:opacity-40 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-gray-700"><LucideUndo size={16} /></button>
                                  <button onClick={handleRedo} disabled={redoStack.length === 0} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 shadow-sm disabled:opacity-40 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-gray-700"><LucideRedo size={16} /></button>
                              </div>
                          </>
              )}
          </div>
          <div className="p-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex gap-2 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button onClick={() => onSave(editorText)} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold border border-indigo-800 text-xs shadow-sm flex items-center justify-center gap-1">যোগ করুন</button>
              <button onClick={onClose} className="flex-1 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-bold border border-gray-300 dark:border-gray-600 text-xs shadow-sm">বন্ধ করুন</button>
          </div>
        </div>
    );
};
export const SetupView: React.FC<SetupViewProps> = React.memo(({
  rawInput,
  setRawInput,
  config,
  setConfig,
  stats,
  history,
  progress,
  onImportData,
  onStart,
  onReset,
  aiConfig,
  onSetAiConfig,
  onRemoveAiConfig,
  onOpenSidebar,
  theme,
  onToggleTheme
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInterface, setShowAiInterface] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [forceRecentStructure, setForceRecentStructure] = useState(false);

  // Visual Form State
  const [showVisualForm, setShowVisualForm] = useState(false);
  const [visualQuestions, setVisualQuestions] = useState<VisualQuestion[]>([{
    q: '',
    opt: { ক: '', খ: '', গ: '', ঘ: '' },
    a: 'ক'
  }]);
  const [examName, setExamName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionInputRef = useRef<HTMLInputElement>(null);
  const fieldImageInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const activeFieldRef = useRef<{ idx: number; field: string } | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [showEditorScreen, setShowEditorScreen] = useState(false);
  const [isOpeningEditor, setIsOpeningEditor] = useState(false);
  const [visualFormFullscreen, setVisualFormFullscreen] = useState(false);
  const [renderLimit, setRenderLimit] = useState(20);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartWithLoading = () => {
    setIsStarting(true);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            onStart();
            setIsStarting(false);
        });
    });
  };

  const openEditor = () => {
      setIsOpeningEditor(true);
      requestAnimationFrame(() => {
          requestAnimationFrame(() => {
              setShowEditorScreen(true);
              setIsOpeningEditor(false);
          });
      });
  };
  
  const saveEditor = (val: string) => {
      setRawInput(val);
      setShowEditorScreen(false);
  };

  useEffect(() => {
    if (selectedFiles.length > 0) {
      setForceRecentStructure(true);
    }
  }, [selectedFiles.length]);

  const handleChange = (field: keyof QuizConfig, value: string | number | boolean) => {
    const newConfig = { ...config, [field]: value };
    if (field === 'questionLimit') {
      const numValue = Number(value);
      if (value !== '' && !isNaN(numValue)) {
        newConfig.timeMinutes = Math.max(1, Math.round(numValue * 0.6));
      }
    }
    setConfig(newConfig);
  };

  const handleExportSession = () => {
    if (!rawInput.trim() && history.length === 0) {
      alert("ব্যাকআপ করার মতো কোনো ডাটা নেই।");
      return;
    }
    const currentName = extractExamName(rawInput);
    const backup: SessionBackup = {
      version: 1,
      timestamp: Date.now(),
      rawInput,
      config,
      progress: progress,
      history: history
    };
    const dataStr = JSON.stringify(backup, null, 2);
    if ((window as any).Android && (window as any).Android.saveFile) {
        (window as any).Android.saveFile(generateBackupFilename(currentName), dataStr);
        return;
    }
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = generateBackupFilename(currentName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onImportData(json);
      } catch (err) {
        alert("ফাইল রিড করতে সমস্যা হয়েছে।");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openAiGenerator = () => {
    if (!aiConfig) {
      setShowSettingsModal(true);
      return;
    }
    setShowAiInterface(true);
    setForceRecentStructure(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAiGeneratorFields = () => {
    setSelectedFiles([]);
    setCustomPrompt("");
  };

  const handleGenerate = async () => {
    if (selectedFiles.length === 0 && !customPrompt.trim()) {
        alert("অনুগ্রহ করে ফাইল যোগ করুন অথবা বিষয় লিখুন।");
        return;
    }
    if (!aiConfig) {
        setShowSettingsModal(true);
        return;
    }
    setIsGenerating(true);
    try {
      const contentParts: any[] = [];
      for (const file of selectedFiles) {
          if (file.type.startsWith('image/')) {
              const base64Data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              contentParts.push({ inlineData: { mimeType: file.type, data: base64Data } });
          } else if (file.type === 'application/pdf') {
              const base64Data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              contentParts.push({ inlineData: { mimeType: 'application/pdf', data: base64Data } });
          } else {
              const textData = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target?.result as string);
                  reader.onerror = reject;
                  reader.readAsText(file);
              });
              contentParts.push({ text: `\n\n--- File: ${file.name} ---\n${textData}\n` });
          }
      }

      const userInstruction = customPrompt.trim();
      const shouldGenerateTitle = rawInput.trim().length === 0;

      const fullPrompt = `
      TASK: Generate Multiple Choice Questions (MCQs) in Bengali based on the provided content.
      USER PROMPT: ${userInstruction ? userInstruction : "Analyze input and generate questions."}
      
      VISUAL RULES:
      1. ONLY use [icon:IconName] or [img:Source] if analyzing provided images or logic requires it.
      2. DO NOT add decorative icons to standard text.
      
      STRICT FORMAT:
      ${shouldGenerateTitle ? "1. The VERY FIRST line MUST be Exam Name wrapped in triple asterisks. Example: ***History***\n      2. Then list questions:" : "List questions:"}
      Question | Opt A | Opt B | Opt C | Opt D | CorrectKey ###
      CorrectKey: ক, খ, গ, or ঘ.
      `;
      
      contentParts.push({ text: fullPrompt });
      const messages: Message[] = [{ role: 'user', parts: contentParts }];
      const responseText = await generateAIResponse(aiConfig, messages);
      
      if (responseText) {
        setRawInput(prev => (prev.trim() ? prev + '\n' : '') + responseText.trim());
        setShowAiInterface(false);
      }
    } catch (err: any) {
      console.error("AI API Error:", err);
      alert(`AI জেনারেশন ব্যর্থ হয়েছে।\nError: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputInteraction = () => {
    if (selectedFiles.length === 0) setForceRecentStructure(false);
  };

  const handleOpenVisualForm = () => {
    if (rawInput.trim()) {
        const parsed = parseQuestions(rawInput);
        const extractedName = extractExamName(rawInput);
        if (extractedName) setExamName(extractedName);
        if (parsed.length > 0) {
            setVisualQuestions(parsed.map(p => ({
                q: p.q,
                opt: p.opt as { ক: string; খ: string; গ: string; ঘ: string },
                a: p.a
            })));
        } else {
             setVisualQuestions([{ q: '', opt: { ক: '', খ: '', গ: '', ঘ: '' }, a: 'ক' }]);
        }
    } else {
        setVisualQuestions([{ q: '', opt: { ক: '', খ: '', গ: '', ঘ: '' }, a: 'ক' }]);
        setExamName("");
    }
    setShowVisualForm(true);
  };

  const addVisualQuestion = () => {
    setVisualQuestions([...visualQuestions, { q: '', opt: { ক: '', খ: '', গ: '', ঘ: '' }, a: 'ক' }]);
  };

  const updateVisualQuestion = React.useCallback((idx: number, field: string, value: string) => {
    setVisualQuestions(prev => {
      const updated = [...prev];
      const item = { ...updated[idx] };
      if (field === 'q' || field === 'a') {
          (item as any)[field] = value;
      } else {
          item.opt = { ...item.opt, [field]: value };
      }
      updated[idx] = item;
      return updated;
    });
  }, []);

  const triggerFieldImage = React.useCallback((idx: number, field: string) => {
    activeFieldRef.current = { idx, field };
    fieldImageInputRef.current?.click();
  }, []);

  const removeVisualQuestion = React.useCallback((idx: number) => {
    setVisualQuestions(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleFieldImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFieldRef.current) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const { idx, field } = activeFieldRef.current!;
      const currentVal = field === 'q' ? visualQuestions[idx].q : (visualQuestions[idx].opt as any)[field];
      updateVisualQuestion(idx, field, currentVal + ` [img:${base64}]`);
      activeFieldRef.current = null;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveVisualQuestions = () => {
    const formatted = visualQuestions
      .filter(vq => vq.q.trim())
      .map(vq => `${vq.q} | ${vq.opt.ক} | ${vq.opt.খ} | ${vq.opt.গ} | ${vq.opt.ঘ} | ${vq.a}`)
      .join(' ### ');
    if (formatted) {
      const finalOutput = (examName ? `***${examName}***\n` : '') + formatted + ' ###';
      setRawInput(finalOutput);
    }
    setVisualFormFullscreen(false);
    setShowVisualForm(false);
    setVisualQuestions([{ q: '', opt: { ক: '', খ: '', গ: '', ঘ: '' }, a: 'ক' }]);
    setExamName("");
  };

  const handleModalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        let newQuestions: VisualQuestion[] = [];
        let detectedName = "";
        
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
              json.forEach((s: any) => {
                  const ri = s.data?.rawInput || s.rawInput;
                  if (ri && typeof ri === 'string') {
                      const parsed = parseQuestions(ri);
                      if (parsed.length > 0) {
                          newQuestions.push(...parsed.map(p => ({
                              q: p.q, 
                              opt: p.opt as { ক: string; খ: string; গ: string; ঘ: string }, 
                              a: p.a
                          })));
                      }
                      if (!detectedName) detectedName = extractExamName(ri) || "";
                  }
              });
          } else {
              const ri = json.data?.rawInput || json.rawInput;
              if (ri && typeof ri === 'string') {
                   const parsed = parseQuestions(ri);
                   newQuestions = parsed.map(p => ({
                        q: p.q, 
                        opt: p.opt as { ক: string; খ: string; গ: string; ঘ: string }, 
                        a: p.a
                   }));
                   detectedName = extractExamName(ri) || "";
              }
          }
        } catch (e) {
            const parsed = parseQuestions(text);
            newQuestions = parsed.map(p => ({
                q: p.q, 
                opt: p.opt as { ক: string; খ: string; গ: string; ঘ: string }, 
                a: p.a
            }));
            detectedName = extractExamName(text) || "";
        }

        if (detectedName) setExamName(detectedName);
        if (newQuestions.length > 0) {
            setVisualQuestions(prev => [...prev, ...newQuestions]);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleModalExport = () => {
    const formatted = visualQuestions
      .filter(vq => vq.q.trim())
      .map(vq => `${vq.q} | ${vq.opt.ক} | ${vq.opt.খ} | ${vq.opt.গ} | ${vq.opt.ঘ} | ${vq.a}`)
      .join(' ### ');
    if (!formatted) { alert("এক্সপোর্ট করার মতো প্রশ্ন নেই"); return; }
    const generatedRawInput = (examName ? `***${examName}***\n` : '') + formatted + ' ###';
    const backup: SessionBackup = {
      version: 1, timestamp: Date.now(), rawInput: generatedRawInput, config: config, progress: progress, history: history
    };
    const dataStr = JSON.stringify(backup, null, 2);
    if ((window as any).Android && (window as any).Android.saveFile) {
        (window as any).Android.saveFile(generateBackupFilename(examName || "questions"), dataStr);
        return;
    }
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = generateBackupFilename(examName || "questions");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasAiInput = selectedFiles.length > 0 || customPrompt.trim() !== "";
  const isShowingRecentStructure = forceRecentStructure || selectedFiles.length > 0;

  return (
    <div className="bg-white dark:bg-gray-900 dark:border-gray-800 rounded-xl shadow-lg p-2 sm:p-4 mb-3 sm:mb-6 border border-gray-200 text-gray-800 dark:text-gray-100 relative flex flex-col h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-4rem)] min-h-[600px] sm:min-h-[40rem] transition-colors duration-200">
      <input type="file" ref={fieldImageInputRef} onChange={handleFieldImageChange} accept="image/*" className="hidden" />

      {/* Visual Form Modal */}
      {showVisualForm && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm transition-all ${visualFormFullscreen ? 'p-0 bg-black/80' : 'p-2 sm:p-4 bg-black/60'}`}>
          <div className={`bg-white dark:bg-gray-900 w-full ${visualFormFullscreen ? 'h-full max-w-full rounded-none border-none' : 'max-w-2xl h-[85vh] rounded-xl'} shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 relative transition-all`}>
            <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80" onClick={() => setVisualFormFullscreen(!visualFormFullscreen)}>
                    <LucideLayout size={16} className="text-blue-600 dark:text-blue-500" />
                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight flex items-baseline gap-1 select-none">
                      প্রশ্ন ফর্ম <span className="text-gray-400 dark:text-gray-500 font-normal text-[0.75em]">| প্রশ্ন সংখ্যা: {visualQuestions.length}</span>
                    </h2>
                </div>
                
                <div className="flex items-center gap-1 ml-2 border-l pl-2 border-gray-200 dark:border-gray-700">
                    <input type="file" ref={modalFileInputRef} onChange={handleModalImport} accept=".json,.txt" className="hidden" />
                    <button onClick={() => modalFileInputRef.current?.click()} className="flex items-center gap-1 px-1.5 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[0.625rem] font-bold border border-gray-200 dark:border-gray-700">
                        <LucideUpload size={12} /> ইমপোর্ট
                    </button>
                    <button onClick={handleModalExport} className="flex items-center gap-1 px-1.5 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[0.625rem] font-bold border border-gray-200 dark:border-gray-700">
                        <LucideDownload size={12} /> এক্সপোর্ট
                    </button>
                </div>
              </div>
              <button onClick={() => { setVisualFormFullscreen(false); setShowVisualForm(false); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full shrink-0">
                <LucideX size={16} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">পরীক্ষার নাম (ঐচ্ছিক) :</span>
              <input 
                type="text" 
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="পরীক্ষার নাম..."
                className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div 
              className="flex-1 overflow-y-auto p-3 space-y-4 bg-white dark:bg-gray-900"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop - clientHeight < 400) {
                  if (renderLimit < visualQuestions.length) {
                    setRenderLimit(prev => Math.min(prev + 20, visualQuestions.length));
                  }
                }
              }}
            >
              {visualQuestions.slice(0, renderLimit).map((vq, idx) => (
                <VisualQuestionCard
                  key={idx}
                  vq={vq}
                  idx={idx}
                  onUpdate={updateVisualQuestion}
                  onRemove={removeVisualQuestion}
                  onTriggerImage={triggerFieldImage}
                />
              ))}
              {renderLimit >= visualQuestions.length && (
                <button 
                  onClick={addVisualQuestion} 
                  className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex flex-col items-center justify-center gap-0.5 bg-gray-50 dark:bg-gray-800 shadow-sm"
                >
                  <LucidePlus size={16} />
                  <span className="text-[0.5rem] font-bold uppercase tracking-widest">নতুন প্রশ্ন</span>
                </button>
              )}
            </div>

            <div className="p-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex gap-2">
              <button onClick={handleSaveVisualQuestions} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold border border-indigo-800 text-xs shadow-sm flex items-center justify-center gap-1">যোগ করুন</button>
              <button onClick={() => { setVisualFormFullscreen(false); setShowVisualForm(false); }} className="flex-1 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-bold border border-gray-300 dark:border-gray-600 text-xs shadow-sm">বন্ধ করুন</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Main Screen Modal */}
      {showEditorScreen && (
        <EditorModal 
          initialText={rawInput} 
          onSave={saveEditor} 
          onClose={() => setShowEditorScreen(false)} 
        />
      )}

      {showSettingsModal && (
        <AISettingsModal
          currentConfig={aiConfig}
          onSave={onSetAiConfig}
          onClose={() => setShowSettingsModal(false)}
          onRemove={onRemoveAiConfig}
        />
      )}

      {/* Header Section with Balanced Negative Space */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-800 shrink-0 mt-0">
        <div className="flex items-center gap-1.5">
            <button 
              onClick={onOpenSidebar} 
              className="bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 p-1.5 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
            >
              <LucideFileText size={16} />
            </button>
            <h2 className="text-base font-bold text-blue-600 dark:text-blue-400">প্রশ্ন ব্যাংক সেটআপ</h2>
        </div>
        <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button 
                onClick={onToggleTheme} 
                className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
                {theme === 'dark' ? <LucideSun size={16} /> : <LucideMoon size={16} />}
            </button>

            {/* AI/User Button */}
            <button onClick={() => setShowSettingsModal(true)} className={`relative w-8 h-8 rounded-full flex items-center justify-center shadow-sm border ${aiConfig ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'}`}>
                {aiConfig ? <LucideSparkles size={14} /> : <LucideUser size={16} />}
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${aiConfig ? 'bg-green-500' : 'bg-red-400'}`}></span>
            </button>
        </div>
      </div>

      <div className="mb-2 flex-1 min-h-[180px] flex flex-col">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.pdf,text/plain,.txt,.csv,.json,.md" multiple className="hidden" />
        {showAiInterface ? (
           <div className="w-full flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden relative">
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
                  {hasAiInput && (
                    <button onClick={clearAiGeneratorFields} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-red-500 rounded-full shadow-sm border border-gray-200 dark:border-gray-700" title="মুছে ফেলুন"><LucideTrash2 size={12} /></button>
                  )}
                  <button onClick={() => setShowAiInterface(false)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-red-500 rounded-full shadow-sm border border-gray-200 dark:border-gray-700" title="বন্ধ করুন"><LucideX size={12} /></button>
              </div>
              <div className="p-2 flex flex-col h-full">
                <h3 className="shrink-0 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 px-1 mb-1.5"><LucideSparkles size={14} className="text-indigo-500" /> AI প্রশ্ন জেনারেটর</h3>
                
                {!isShowingRecentStructure ? (
                  <div className="flex-1 flex gap-2 px-1 pb-1">
                    <div className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm overflow-hidden flex flex-col">
                        <AIPromptInput 
                            value={customPrompt}
                            onChange={setCustomPrompt}
                            disabled={isGenerating}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 justify-end">
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="w-10 h-10 border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 rounded-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm active:scale-95 bg-white dark:bg-gray-800"
                            title="ফাইল যোগ করুন"
                        >
                            <LucidePaperclip size={18} />
                        </button>
                        <button 
                            onClick={handleGenerate} 
                            disabled={isGenerating || (selectedFiles.length === 0 && !customPrompt.trim())} 
                            className={`w-10 h-10 rounded-lg flex items-center justify-center relative overflow-hidden transition-colors shadow-sm active:scale-95 ${
                                (selectedFiles.length > 0 || customPrompt.trim() !== "")
                                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                  : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            <span className={`flex items-center justify-center transition-opacity ${isGenerating ? 'opacity-0' : 'opacity-100'}`}>
                                <LucideArrowUp size={18} />
                            </span>
                            {isGenerating && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></span>
                                </span>
                            )}
                        </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto py-0.5 px-1">
                        <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 flex-shrink-0 bg-white dark:bg-gray-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-indigo-500"><LucidePaperclip size={24} /></button>
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="relative w-16 h-16 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm group">
                             {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover rounded" />
                             ) : (
           <div className="w-full flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-700 rounded p-0.5">
                                    <LucideFile size={18} className="text-gray-400 mb-0.5" />
                                    <span className="text-[0.5rem] text-gray-500 dark:text-gray-300 text-center break-all leading-tight line-clamp-2">{file.name}</span>
                                </div>
                             )}
                             <button onClick={() => removeFile(idx)} className="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-800 text-red-500 border border-red-100 dark:border-red-900 p-0.5 rounded-full shadow-md hover:bg-red-50 dark:hover:bg-red-900/50 z-10"><LucideX size={10} /></button>
                          </div>
                        ))}
                    </div>
                    <div className="shrink-0 flex gap-2 mt-1.5 px-1 pb-1">
                        <AIRecentInput 
                            value={customPrompt} 
                            onChange={setCustomPrompt} 
                            onFocus={handleInputInteraction}
                            onEnter={handleGenerate} 
                            disabled={isGenerating} 
                        />
                        <button onClick={handleGenerate} disabled={isGenerating || (selectedFiles.length === 0 && !customPrompt.trim())} className={`h-10 w-10 rounded-lg flex items-center justify-center relative overflow-hidden transition-colors shadow-sm active:scale-95 ${
                          isGenerating 
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500' 
                            : (selectedFiles.length > 0 || customPrompt.trim() !== "")
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-400'
                        }`}>
                            <span className={`flex items-center justify-center transition-opacity ${isGenerating ? 'opacity-0' : 'opacity-100'}`}>
                                <LucideArrowUp size={18} />
                            </span>
                            {isGenerating && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></span>
                                </span>
                            )}
                        </button>
                    </div>
                  </>
                )}
              </div>
           </div>
        ) : (
           <div className="w-full flex-1 flex flex-col">
              <div className="shrink-0 flex justify-between items-center mb-1.5 gap-1.5">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 leading-tight">
                    প্রশ্ন ব্যাংক <span className="text-gray-400 dark:text-gray-500 font-normal text-[0.5rem] block sm:inline">(ফরম্যাট: প্রশ্ন | ক | খ | গ | ঘ | সঠিক ###)</span>
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={handleOpenVisualForm} 
                      className="flex items-center gap-1 px-2 py-1.5 rounded font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-[0.625rem] whitespace-nowrap shadow-sm transition-colors"
                    >
                      <LucideLayout size={12} /> প্রশ্ন ফর্ম
                    </button>
                    <button 
                        onClick={openAiGenerator} 
                        className="flex items-center gap-1 px-2 py-1.5 rounded font-bold text-white bg-indigo-500 hover:bg-indigo-600 text-[0.625rem] whitespace-nowrap shadow-sm border border-transparent"
                    >
                        <LucideWand2 size={12} /> AI জেনারেটর
                    </button>
                  </div>
              </div>
              <div className="flex-1 relative bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                <textarea 
                  className="w-full h-full p-2 bg-transparent border-none focus:ring-0 text-xs font-mono resize-none text-gray-900 dark:text-gray-200 relative z-10 cursor-not-allowed opacity-90" 
                  value={rawInput} 
                  readOnly 
                />
                {!rawInput && (
                  <div className="absolute inset-0 p-2 pointer-events-none text-gray-500 dark:text-gray-400 font-mono text-[0.625rem] z-0 opacity-50">
                    <div className="text-[1.1em]">সঠিক ফরমেটে প্রশ্ন লিখুন বা পেস্ট করুন...</div>
                    <div className="mt-1 leading-relaxed whitespace-pre-wrap">
{`উদাহরণ:
জাপানের মুদ্রা? | ইয়েন | রিয়াল | ডলার | টাকা | ক ###
বাংলাদেশের রাজধানী? | ঢাকা | খুলনা | রাজশাহী | বরিশাল | ক ###`}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-400 dark:border-gray-500 font-bold">
                        N.B. ছবি বা সিম্বল যোগ করতে প্রশ্ন বা অপশনের শেষে [img:url] বা [icon:info] লিখুন অথবা প্রশ্ন ফর্ম ব্যবহার করুন।
                    </div>
                  </div>
                )}
                <div className="absolute top-1.5 right-1.5 flex gap-1 z-20">
                    <button onClick={openEditor} disabled={isOpeningEditor} className="p-1.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-500 rounded shadow-md border border-gray-200 dark:border-gray-700 transition-colors tooltip disabled:opacity-50 flex items-center justify-center">
                        {isOpeningEditor ? <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></span> : <LucidePencil size={14} />}
                    </button>
                </div>
              </div>
           </div>
        )}
      </div>

      <div className="shrink-0 space-y-3">
        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
            <div className="grid grid-cols-3 gap-2 mb-3">
            <div><label className="block text-[0.625rem] font-bold text-gray-500 dark:text-gray-400 mb-0.5">সময় (মিনিট)</label><input type="number" min="1" className="w-full h-8 px-1.5 border border-gray-300 dark:border-gray-700 rounded text-center font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs" value={config.timeMinutes} onChange={(e) => handleChange('timeMinutes', e.target.value === '' ? '' : parseInt(e.target.value))} /></div>
            <div><label className="block text-[0.625rem] font-bold text-gray-500 dark:text-gray-400 mb-0.5">লিমিট (প্রশ্ন)</label><input type="number" min="1" className="w-full h-8 px-1.5 border border-gray-300 dark:border-gray-700 rounded text-center font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs" value={config.questionLimit} onChange={(e) => handleChange('questionLimit', e.target.value === '' ? '' : parseInt(e.target.value))} /></div>
            <div><label className="block text-[0.625rem] font-bold text-gray-500 dark:text-gray-400 mb-0.5">অপশন শাফল</label><button type="button" onClick={() => handleChange('shuffleOptions', !config.shuffleOptions)} className={`w-full h-8 px-1.5 rounded border flex items-center justify-center gap-1 font-bold ${config.shuffleOptions ? 'bg-blue-600 text-white border-transparent' : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-700'}`}><LucideShuffle size={12} /><span className="text-[0.625rem]">{config.shuffleOptions ? 'চালু' : 'বন্ধ'}</span></button></div>
            </div>
            <div><label className="block text-[0.625rem] font-bold text-gray-500 dark:text-gray-400 mb-0.5">মোড</label><div className="relative"><select className="w-full h-8 px-1.5 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white font-bold" value={config.mode} onChange={(e) => handleChange('mode', e.target.value as QuizMode)}><option value={QuizMode.SERIAL}>সিরিয়াল</option><option value={QuizMode.RANDOM_LIMITED}>র‍্যান্ডম লিমিটেড</option><option value={QuizMode.RANDOM_UNLIMITED}>র‍্যান্ডম আনলিমিটেড</option></select></div></div>
        </div>
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 py-1 px-2 rounded-lg border border-blue-100 dark:border-blue-900/30 text-[0.625rem]">
            <div className="flex items-center gap-1"><LucideDatabase size={12} /><span className="font-bold">স্ট্যাটাস:</span></div>
            <div className="font-bold space-x-2"><span>মোট: {stats.total}</span><span>হয়েছে: {stats.taken}</span><span>বাকি: {stats.remaining}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <input type="file" ref={sessionInputRef} onChange={handleImportSession} accept=".json" className="hidden" />
            <button onClick={() => sessionInputRef.current?.click()} className="flex items-center justify-center gap-1.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-[0.625rem] font-bold"><LucideFolderOpen size={12} /> লোড সেশন</button>
            <button onClick={handleExportSession} className="flex items-center justify-center gap-1.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-[0.625rem] font-bold"><LucideSave size={12} /> সেভ সেশন</button>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
            <button onClick={handleStartWithLoading} disabled={stats.total === 0 || isStarting} className={`relative flex items-center justify-center gap-1.5 w-full py-3.5 font-bold rounded-lg shadow-sm text-sm transition-all overflow-hidden ${stats.total === 0 ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed shadow-none' : 'bg-green-600 hover:bg-green-700 text-white active:scale-[0.98] disabled:opacity-80'}`}>
                <span className="flex items-center gap-1.5">
                    {isStarting ? (
                        <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin"></span>
                    ) : (
                        <LucidePlay size={18} className="fill-current" />
                    )} 
                    পরীক্ষা শুরু করুন
                </span>
            </button>
        </div>
      </div>
    </div>
  );
});