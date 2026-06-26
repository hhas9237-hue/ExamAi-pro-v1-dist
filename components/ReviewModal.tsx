
import React, { useEffect, useState, useRef } from 'react';
import { ExamResult, AIConfig } from '../types';
import { 
  LucideX, LucideCheck, LucideXCircle, LucideSparkles, LucideSettings2, LucideArrowLeft, LucideRefreshCw, LucideBot,
  LucideMessageSquare, LucideBookOpen, LucidePencil, LucideSend
} from 'lucide-react';
import { RichText } from './RichText';
import { generateAIResponse, Message } from '../utils/aiService';
import { AISettingsModal } from './AISettingsModal';

interface ReviewModalProps {
  result: ExamResult | null;
  onClose: () => void;
  aiConfig: AIConfig | null;
  onSetAiConfig: (config: AIConfig) => void;
  onRemoveAiConfig: () => void;
  onRetake: () => void;
  onUpdateResult: (updated: ExamResult) => void;
  examNumber?: string;
  savedExplanations?: Record<string, ChatMessage[]>;
  onUpdateExplanation?: (questionId: string, messages: ChatMessage[]) => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isInitial?: boolean;
}

type ChatCache = Record<string, ChatMessage[]>;

export const ReviewModal: React.FC<ReviewModalProps> = ({ 
  result, onClose, aiConfig, onSetAiConfig, onRemoveAiConfig, onRetake, onUpdateResult, examNumber, savedExplanations = {}, onUpdateExplanation
}) => {
  const [showDual, setShowDual] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<'LIST' | 'CHAT'>('LIST');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CORRECT' | 'WRONG' | 'SKIPPED'>('ALL');
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listScrollPos = useRef(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'CHAT'; index: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);

  // Renaming States
  const [isNameExpanded, setIsNameExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [renderLimit, setRenderLimit] = useState(20);

  useEffect(() => {
    setFilterMode('ALL'); setView('LIST'); setActiveIndex(null); setInputText(""); setIsNameExpanded(false); setIsRenaming(false); setIsFullscreen(false); setRenderLimit(20);
  }, [result?.id]);

  useEffect(() => {
    if (result) { document.body.style.overflow = 'hidden'; setNewName(result.examName || ""); } else { document.body.style.overflow = 'auto'; }
    return () => { document.body.style.overflow = 'auto'; };
  }, [result]);

  useEffect(() => {
    if (view === 'CHAT' && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    if (view === 'LIST' && listContainerRef.current) listContainerRef.current.scrollTop = listScrollPos.current;
  }, [savedExplanations, view, activeIndex, isGenerating]);

  useEffect(() => {
    if (aiConfig && pendingAction) {
        if (pendingAction.type === 'CHAT') handleTriggerAI(pendingAction.index);
        setPendingAction(null);
    }
  }, [aiConfig, pendingAction]);

  if (!result) return null;

  const currentNegMark = result.negativeMark || 0.25;
  const calculateScore = (neg: number) => parseFloat(((result.stats.correct * 1) - (result.stats.wrong * neg)).toFixed(2));
  const currentScore = calculateScore(currentNegMark);
  const altNeg = currentNegMark === 0.25 ? 0.50 : 0.25;
  const altScore = calculateScore(altNeg);
  const getCacheKey = (index: number) => result.questions[index].id;

  const getSystemPrompt = (qIndex: number) => {
    const q = result.questions[qIndex];
    const userAns = result.userChoices[qIndex];
    const userAnsText = userAns ? q.opt[userAns] : 'Skipped';
    const correctAnsText = q.opt[q.a];
    return `CONTEXT: Question: "${q.q}", Options: ${JSON.stringify(q.opt)}, Correct: "${q.a}" (${correctAnsText}), User: "${userAns || 'None'}" (${userAnsText}). ROLE: Expert Tutor. LANGUAGE: Bengali. FORMAT: No headers, use bold for keys, LaTeX math in single dollar signs.`;
  };

  const initChat = async (index: number, forceReset = false) => {
    const cacheKey = getCacheKey(index);
    if (!forceReset && savedExplanations[cacheKey] && savedExplanations[cacheKey].length > 0) return;
    if (!aiConfig) { setShowSettingsModal(true); return; }
    setIsGenerating(true);
    onUpdateExplanation?.(cacheKey, []);
    try {
      const messages: Message[] = [{ role: 'user', parts: [{ text: getSystemPrompt(index) + "\n\nProvide detailed explanation." }] }];
      const text = await generateAIResponse(aiConfig, messages);
      onUpdateExplanation?.(cacheKey, [{ role: 'model', text: text || "দুঃখিত, ব্যাখ্যা সম্ভব হয়নি।", isInitial: true }]);
    } catch (error: any) { alert(`AI Error: ${error.message}`); } finally { setIsGenerating(false); }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || activeIndex === null) return;
    const cacheKey = getCacheKey(activeIndex);
    const currentHistory = savedExplanations[cacheKey] || [];
    const userMsg = inputText.trim();
    setInputText("");
    const newHistory: ChatMessage[] = [...currentHistory, { role: 'user', text: userMsg }];
    onUpdateExplanation?.(cacheKey, newHistory);
    setIsGenerating(true);
    if (!aiConfig) return;
    try {
      const messages: Message[] = [{ role: 'user', parts: [{ text: getSystemPrompt(activeIndex) }] }, ...currentHistory.map((m): Message => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: userMsg }] }];
      const aiText = await generateAIResponse(aiConfig, messages);
      onUpdateExplanation?.(cacheKey, [...newHistory, { role: 'model', text: aiText || "দুঃখিত।" }]);
    } catch (error) { onUpdateExplanation?.(cacheKey, [...newHistory, { role: 'model', text: "নেটওয়ার্ক ত্রুটি।" }]); } finally { setIsGenerating(false); }
  };

  const handleTriggerAI = (index: number) => {
    if (listContainerRef.current) listScrollPos.current = listContainerRef.current.scrollTop;
    if (!aiConfig) { setPendingAction({ type: 'CHAT', index }); setShowSettingsModal(true); } 
    else { setActiveIndex(index); setView('CHAT'); initChat(index); }
  };

  const toggleFilter = (mode: 'CORRECT' | 'WRONG' | 'SKIPPED') => setFilterMode(prev => prev === mode ? 'ALL' : mode);
  const handleNameClick = () => { setIsNameExpanded(!isNameExpanded); setIsRenaming(false); };
  
  const handleTitleBarClick = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
    } else {
      handleNameClick();
    }
  };

  const startRenaming = (e: React.MouseEvent) => { e.stopPropagation(); setIsRenaming(true); setIsNameExpanded(true); setNewName(result.examName || ""); };
  const saveNewName = () => { onUpdateResult({ ...result, examName: newName.trim() || undefined }); setIsRenaming(false); setIsNameExpanded(false); };
  const getTruncatedName = (name: string) => isNameExpanded ? `(${name})` : name.length > 6 ? `(${name.slice(0, 6)}...)` : `(${name})`;

  const handleRetakeWithLoading = () => {
    setIsRetaking(true);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            onRetake();
            setIsRetaking(false);
        });
    });
  };

  const renderListView = () => {
    const filteredQuestions = result.questions.filter((q, idx) => {
        const userAns = result.userChoices[idx];
        if (filterMode === 'CORRECT') return userAns === q.a;
        if (filterMode === 'WRONG') return userAns !== null && userAns !== q.a;
        if (filterMode === 'SKIPPED') return userAns === null;
        return true;
    });
    const hasName = result.examName && result.examName.trim().length > 0;
    const displayName = hasName ? getTruncatedName(result.examName!) : '';
    
    return (
        <>
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="p-3 flex items-stretch justify-between gap-2 h-[3.75rem]">
                <div className={`flex flex-col justify-center cursor-pointer transition-all min-w-0 ${isNameExpanded ? 'flex-1' : ''}`} onClick={handleTitleBarClick}>
                    {isRenaming ? (
                        <div className="flex items-center gap-1.5 h-full w-full">
                            <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100 whitespace-nowrap shrink-0">ফলাফল | Exam {examNumber || `#${result.id}`}</span>
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0 px-1.5 py-0.5 border border-blue-300 dark:border-blue-700 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none" placeholder="Exam Name" autoFocus />
                            <button onClick={(e) => { e.stopPropagation(); saveNewName(); }} className="bg-blue-600 text-white p-0.5 rounded hover:bg-blue-700 shrink-0"><LucideCheck size={14} /></button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 leading-tight flex items-baseline min-w-0">
                                <span className="shrink-0">ফলাফল | Exam {examNumber || `#${result.id}`}</span>
                                {hasName && <span className="ml-1 text-[0.75em] text-gray-500 dark:text-gray-400 truncate">{displayName}</span>}
                            </h2>
                            <div className="text-[0.5625rem] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mt-0.5 whitespace-nowrap truncate">{new Date(result.timestamp).toLocaleDateString('en-GB')} {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </>
                    )}
                </div>
                {!isNameExpanded && (
                    <div className="relative z-20 flex-1 flex justify-center px-1 items-center min-w-0">
                        <div onClick={() => setShowSettings(!showSettings)} className={`h-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm bg-[#f8f9fb] dark:bg-gray-800 transition-all overflow-hidden ${hasName ? 'w-full' : 'w-full max-w-[8.75rem]'}`}>
                            <div className="flex flex-col justify-center min-w-0">
                                <span className="text-[0.5rem] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest leading-none mb-0.5 truncate">Score</span>
                                <div className="flex items-baseline gap-1"><span className="text-lg font-black text-slate-800 dark:text-slate-200 tabular-nums leading-none">{currentScore}</span>{showDual && <span className="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold leading-none">/ {altScore}</span>}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="h-5 w-px bg-gray-200 dark:bg-gray-700"></div>
                                <div className="flex flex-col items-center"><LucideSettings2 size={14} className="text-gray-400" /><span className="text-[0.375rem] font-bold text-gray-400 mt-0.5">-{currentNegMark}</span></div>
                            </div>
                        </div>
                        {showSettings && (
                            <div className="absolute top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 origin-top w-48 right-1 z-30">
                                <div className="flex justify-between items-center mb-2"><span className="text-[0.625rem] font-bold text-gray-500 dark:text-gray-400 uppercase">নেগেটিভ মার্কিং</span><button onClick={(e) => { e.stopPropagation(); setShowSettings(false); }} className="text-gray-400 hover:text-red-500"><LucideX size={12} /></button></div>
                                <div className="flex gap-1.5 mb-3">
                                    <button onClick={(e) => { e.stopPropagation(); onUpdateResult({ ...result, negativeMark: 0.25 }); }} className={`flex-1 py-1.5 text-[0.625rem] font-bold rounded border ${currentNegMark === 0.25 ? 'bg-slate-100 dark:bg-slate-700 border-slate-500 text-slate-700 dark:text-slate-200' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>0.25</button>
                                    <button onClick={(e) => { e.stopPropagation(); onUpdateResult({ ...result, negativeMark: 0.50 }); }} className={`flex-1 py-1.5 text-[0.625rem] font-bold rounded border ${currentNegMark === 0.50 ? 'bg-slate-100 dark:bg-slate-700 border-slate-500 text-slate-700 dark:text-slate-200' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>0.50</button>
                                </div>
                                <label onClick={(e) => { e.stopPropagation(); setShowDual(!showDual); }} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-50 dark:hover:bg-gray-900 rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-700"><div className={`w-3 h-3 rounded border flex items-center justify-center ${showDual ? 'bg-slate-600 border-slate-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}>{showDual && <LucideCheck size={8} className="text-white" />}</div><span className="text-xs font-medium text-gray-700 dark:text-gray-300">দুটি স্কোর</span></label>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                    {isNameExpanded && !isRenaming && <button onClick={startRenaming} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-full bg-blue-50 border border-blue-200"><LucidePencil size={14} /></button>}
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full shrink-0 h-8 w-8 flex items-center justify-center"><LucideX size={18} className="text-gray-500 dark:text-gray-400" /></button>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                <button onClick={() => toggleFilter('CORRECT')} className={`text-green-800 dark:text-green-300 py-1 px-1.5 rounded-lg text-center border transition-all flex flex-col items-center justify-center active:scale-95 ${filterMode === 'CORRECT' ? 'bg-green-200 dark:bg-green-900/40 border-green-500' : 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-900/30'}`}><div className="text-[0.5rem] font-bold opacity-70 uppercase">সঠিক</div><div className="text-sm font-extrabold leading-none">{result.stats.correct}</div></button>
                <button onClick={() => toggleFilter('WRONG')} className={`text-red-800 dark:text-red-300 py-1 px-1.5 rounded-lg text-center border transition-all flex flex-col items-center justify-center active:scale-95 ${filterMode === 'WRONG' ? 'bg-red-200 dark:bg-red-900/40 border-red-500' : 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-900/30'}`}><div className="text-[0.5rem] font-bold opacity-70 uppercase">ভুল</div><div className="text-sm font-extrabold leading-none">{result.stats.wrong}</div></button>
                <button onClick={() => toggleFilter('SKIPPED')} className={`text-amber-800 dark:text-amber-300 py-1 px-1.5 rounded-lg text-center border transition-all flex flex-col items-center justify-center active:scale-95 ${filterMode === 'SKIPPED' ? 'bg-amber-200 dark:bg-amber-900/40 border-amber-500' : 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30'}`}><div className="text-[0.5rem] font-bold opacity-70 uppercase">বাকি</div><div className="text-sm font-extrabold leading-none">{result.stats.skipped}</div></button>
            </div>
        </div>
        <div 
            ref={listContainerRef} 
            className="overflow-y-auto p-2 space-y-2 bg-white dark:bg-gray-900 flex-1"
            onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop - clientHeight < 400) {
                    if (renderLimit < result.questions.length) {
                        setRenderLimit(prev => Math.min(prev + 20, result.questions.length));
                    }
                }
            }}
        >
            {filteredQuestions.length === 0 && <div className="py-10 text-center text-gray-400 italic text-xs">এই ক্যাটাগরিতে কোনো প্রশ্ন নেই।</div>}
            {result.questions.slice(0, renderLimit).map((q, idxOriginal) => {
            const idx = result.questions.indexOf(q); // Find real index since slice(0, limit) doesn't change index but map index does
            const userAns = result.userChoices[idx];
            const isSkipped = userAns === null;
            const isCorrectAnswer = userAns === q.a;
            if (filterMode === 'CORRECT' && !isCorrectAnswer) return null;
            if (filterMode === 'WRONG' && (isSkipped || isCorrectAnswer)) return null;
            if (filterMode === 'SKIPPED' && !isSkipped) return null;
            let cardStyles = !isSkipped ? (isCorrectAnswer ? "bg-white dark:bg-gray-800 border-green-500 dark:border-green-500/75" : "bg-white dark:bg-gray-800 border-red-300 dark:border-red-700/75") : "bg-amber-50/50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-800/80";
            return (
                <div key={idx} className={`p-2.5 rounded-lg shadow-sm border ${cardStyles} relative overflow-hidden text-gray-900 dark:text-gray-100 transition-colors`}>
                <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="font-bold text-gray-800 dark:text-gray-200 flex gap-1.5 text-xs leading-relaxed flex-1">
                        <span className="text-gray-400 dark:text-gray-500 text-[0.625rem] mt-0.5 min-w-[1rem]">{idx + 1}.</span> 
                        <div className="py-0.5"><RichText text={q.q} /></div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleTriggerAI(idx); }} className="shrink-0 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[0.5625rem] font-bold rounded border border-blue-200 dark:border-blue-800 flex items-center gap-0.5 active:scale-95 shadow-sm"><LucideSparkles size={10} className="text-amber-500" /> AI ব্যাখ্যা</button>
                </div>
                <div className="space-y-1">
                    {Object.entries(q.opt).map(([key, val]) => {
                    const isCorrectOpt = key === q.a;
                    const isUserSelected = key === userAns;
                    let styles = isSkipped ? "bg-amber-50/70 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300";
                    if (isCorrectOpt) styles = isUserSelected ? "bg-green-100 dark:bg-green-900/30 border-green-600 text-green-900 dark:text-green-200 font-bold" : "bg-green-50 dark:bg-green-900/15 border-green-500 text-green-800 dark:text-green-300 font-bold";
                    else if (isUserSelected) styles = "bg-red-50/80 dark:bg-red-900/15 border-red-500 text-red-800 dark:text-red-300 font-bold";
                    return (
                        <div key={key} className={`flex items-center justify-between p-1.5 px-2 rounded border text-[0.625rem] ${styles} ${isCorrectOpt || isUserSelected ? 'border' : ''}`}>
                        <div className="flex items-center gap-1.5">
                            <span className={`font-bold w-4 h-4 rounded-full border flex items-center justify-center text-[0.5625rem] ${isCorrectOpt || isUserSelected ? 'border-current opacity-100' : 'border-gray-300 dark:border-gray-600 opacity-70'}`}>{key}</span> 
                            <div className="leading-relaxed py-0.5"><RichText text={val} isOption /></div>
                        </div>
                        <div className="flex items-center gap-1">
                            {isUserSelected && <span className="text-[0.5rem] uppercase tracking-wide opacity-100 font-extrabold hidden sm:inline">(আপনার উত্তর)</span>}
                            {isCorrectOpt ? <LucideCheck size={14} className={isUserSelected ? "text-green-800 dark:text-green-300" : "text-green-600 dark:text-green-500"} /> : isUserSelected && <LucideXCircle size={12} className="text-red-600 dark:text-red-400" />}
                        </div>
                        </div>
                    );})}
                </div></div>
            );})}
        </div>
        <div className="p-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex gap-2">
            <button onClick={onClose} className="flex-1 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-bold border border-gray-300 dark:border-gray-700 text-xs shadow-sm">বন্ধ করুন</button>
            <button onClick={handleRetakeWithLoading} disabled={isRetaking} className="relative overflow-hidden flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold border border-indigo-800 text-xs shadow-sm flex items-center justify-center gap-1 disabled:opacity-80">
                <span className={`flex items-center justify-center gap-1 transition-opacity ${isRetaking ? 'opacity-0' : 'opacity-100'}`}>
                    <LucideRefreshCw size={12} /> আবার পরীক্ষা দিন
                </span>
                {isRetaking && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    </span>
                )}
            </button>
        </div>
        </>
    );
  };

  const renderChatView = () => {
    if (activeIndex === null) return null;
    const cacheKey = getCacheKey(activeIndex);
    const history = savedExplanations[cacheKey] || [];
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-gray-900 relative">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2.5 flex items-center justify-between shrink-0 shadow-sm z-10">
           <div className="flex items-center gap-1.5">
              <button onClick={() => { setView('LIST'); setActiveIndex(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400"><LucideArrowLeft size={16} /></button>
              <div><h2 className="text-xs font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1"><LucideSparkles className="text-amber-500 fill-amber-500" size={12} /> AI টিউটর</h2><div className="text-[0.5625rem] text-gray-500 dark:text-gray-500 leading-none">প্রশ্ন #{activeIndex + 1}</div></div>
           </div>
           <button onClick={() => initChat(activeIndex, true)} disabled={isGenerating} className="relative overflow-hidden flex items-center justify-center px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[0.5625rem] font-bold border border-blue-200 dark:border-blue-900/40">
               <span className={`flex items-center gap-1 transition-opacity ${isGenerating ? 'opacity-0' : 'opacity-100'}`}>
                   <LucideRefreshCw size={10} /> অন্য ব্যাখ্যা
               </span>
               {isGenerating && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-3 h-3 border-2 border-blue-600/30 dark:border-blue-300/30 border-t-current rounded-full animate-spin"></span>
                    </span>
               )}
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
           {history.length === 0 && isGenerating && <div className="flex justify-center py-8"><div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600"><LucideBot size={24} className="text-blue-500 animate-bounce" /><span className="text-[0.625rem] font-medium">ব্যাখ্যা তৈরি হচ্ছে...</span></div></div>}
           {history.map((msg, idx) => {
             if (msg.role === 'model' && msg.isInitial) return (
                 <div key={idx}><div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-900/50 shadow-sm overflow-hidden"><div className="bg-slate-50 dark:bg-gray-900 px-3 py-1.5 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-1.5"><LucideBookOpen size={14} className="text-blue-600 dark:text-blue-400" /><span className="text-[0.625rem] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">বিষয় বিশ্লেষণ</span></div><div className="p-3 text-xs leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap"><RichText text={msg.text} /></div></div></div>
               );
             return (
               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-2.5 rounded-xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>{msg.role === 'model' && <div className="flex items-center gap-1 mb-0.5 text-[0.5rem] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider"><LucideBot size={10} /> AI</div>}<div className="whitespace-pre-wrap"><RichText text={msg.text} /></div></div></div>
             );
           })}
           <div ref={chatEndRef} />
        </div>
        <div className="p-2.5 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0"><div className="flex items-center gap-1.5"><div className="relative flex-1"><input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="আপনার প্রশ্ন লিখুন..." className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 text-xs text-gray-900 dark:text-gray-100" disabled={isGenerating} /><LucideMessageSquare size={14} className="absolute right-2 top-2.5 text-gray-400" /></div><button onClick={handleSendMessage} disabled={!inputText.trim() || isGenerating} className="relative overflow-hidden p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm active:scale-95">
    <span className={`flex justify-center flex-col items-center transition-opacity ${isGenerating ? 'opacity-0' : 'opacity-100'}`}>
        <LucideSend size={16} />
    </span>
    {isGenerating && (
         <span className="absolute inset-0 flex items-center justify-center">
             <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
         </span>
    )}
</button></div></div>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
      <div className={`bg-white dark:bg-gray-900 w-full ${isFullscreen ? 'h-full max-w-full rounded-none border-none' : 'max-w-2xl h-[85vh] rounded-xl'} shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 relative transition-all`}>
        {showSettingsModal && <AISettingsModal currentConfig={aiConfig} onSave={onSetAiConfig} onClose={() => setShowSettingsModal(false)} onRemove={onRemoveAiConfig} />}
        {view === 'LIST' ? renderListView() : renderChatView()}
      </div>
    </div>
  );
};
