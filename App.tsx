
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_QUESTION_TEXT, OPTION_KEYS } from './constants';
import { parseQuestions, extractExamName, generateBackupFilename } from './utils/parser';
import { QuizConfig, QuizMode, AppPhase, Question, ExamResult, QuestionOptions, SessionBackup, AIConfig, StoredSession } from './types';
import { SetupView } from './components/SetupView';
import { QuizView } from './components/QuizView';
import { HistoryView } from './components/HistoryView';
import { ReviewModal } from './components/ReviewModal';
import { Sidebar } from './components/Sidebar';

const App: React.FC = () => {
  // --- STORAGE PERSISTENCE ---
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(granted => {
        if (granted) console.log("Storage persistence granted.");
      });
    }
  }, []);

  // --- THEME MANAGEMENT ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('qm_theme');
      if (saved) return saved as 'light' | 'dark';
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('qm_theme', theme);

    // Sync theme to Android Native app using SharedPreferences
    // @ts-ignore
    if (window.AndroidBridge && window.AndroidBridge.setTheme) {
      // @ts-ignore
      window.AndroidBridge.setTheme(theme);
    }
  }, [theme]);

  // Hide the native splash screen once React has finished loading
  useEffect(() => {
    // @ts-ignore
    if (window.AndroidBridge && window.AndroidBridge.hideSplashScreen) {
      // @ts-ignore
      window.AndroidBridge.hideSplashScreen();
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // --- INITIALIZATION STATE ---
  const [isAppLoading, setIsAppLoading] = useState(true);

  // --- SESSION MANAGEMENT STATE ---
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  // Load state lazily after component mount to avoid blocking UI frame
  useEffect(() => {
    // Small timeout to let browser render first frame
    const timer = setTimeout(() => {
      let loadedSessions: StoredSession[] = [];
      const saved = localStorage.getItem('qm_sessions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as StoredSession[];
          loadedSessions = parsed.map(s => ({
            ...s,
            createdAt: s.createdAt || s.lastModified || Date.now()
          }));
        } catch (e) {
          console.error("Session parse error");
        }
      } else {
        // Backward compatibility
        const legacyInput = localStorage.getItem('qm_raw_input') || "";
        if (legacyInput) {
          const legacyHistory = localStorage.getItem('qm_history');
          const legacyConfig = localStorage.getItem('qm_config');
          const legacySerial = localStorage.getItem('qm_next_serial');
          const legacyRandom = localStorage.getItem('qm_used_random');
          
          const now = Date.now();
          loadedSessions = [{
            id: `session-${now}`,
            name: "Session 1",
            createdAt: now,
            lastModified: now,
            data: {
              rawInput: legacyInput,
              config: legacyConfig ? JSON.parse(legacyConfig) : { timeMinutes: 15, questionLimit: 25, mode: QuizMode.SERIAL, shuffleOptions: true },
              history: legacyHistory ? JSON.parse(legacyHistory) : [],
              progress: {
                nextSerialIndex: legacySerial ? parseInt(legacySerial) : 0,
                usedRandomIndices: legacyRandom ? JSON.parse(legacyRandom) : []
              }
            }
          }];
        }
      }
      
      setSessions(loadedSessions);
      
      const savedActiveId = localStorage.getItem('qm_active_session_id');
      if (savedActiveId && loadedSessions.some(s => s.id === savedActiveId)) {
        setActiveSessionId(savedActiveId);
      } else if (loadedSessions.length > 0) {
        setActiveSessionId(loadedSessions[0].id);
      }
      
      setIsAppLoading(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- ACTIVE SESSION STATE ---
  const [rawInput, setRawInput] = useState("");
  const [config, setConfig] = useState<QuizConfig>({
    timeMinutes: 15, questionLimit: 25, mode: QuizMode.SERIAL, shuffleOptions: true
  });
  const [history, setHistory] = useState<ExamResult[]>([]);
  const [aiExplanations, setAiExplanations] = useState<Record<string, any>>({});
  const [nextSerialIndex, setNextSerialIndex] = useState(0);
  const [usedRandomIndices, setUsedRandomIndices] = useState<number[]>([]);

  // Initialize Active Session if needed
  useEffect(() => {
    if (sessions.length === 0) {
      const now = Date.now();
      const newSession: StoredSession = {
        id: `session-${now}`,
        name: "Session 1",
        createdAt: now,
        lastModified: now,
        data: {
          rawInput: "",
          config: { timeMinutes: 15, questionLimit: 25, mode: QuizMode.SERIAL, shuffleOptions: true },
          history: [],
          progress: { nextSerialIndex: 0, usedRandomIndices: [] }
        }
      };
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
    } else if (!activeSessionId || !sessions.find(s => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions.length, activeSessionId]);

  // Load Active Session Data into State
  useEffect(() => {
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (currentSession) {
      setRawInput(currentSession.data.rawInput);
      setConfig(currentSession.data.config);
      setHistory(currentSession.data.history);
      setAiExplanations(currentSession.data.aiExplanations || {});
      setNextSerialIndex(currentSession.data.progress.nextSerialIndex);
      setUsedRandomIndices(currentSession.data.progress.usedRandomIndices);
    }
  }, [activeSessionId]);

  // Sync State Back to Session Storage
  const isLoadedRef = useRef(false);
  useEffect(() => {
    if (sessions.length > 0 && activeSessionId && sessions.find(s => s.id === activeSessionId)) {
        isLoadedRef.current = true;
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    if (!activeSessionId) return;

    // Debounce the state sync to prevent re-building the large session list on every keystroke
    const timer = setTimeout(() => {
      setSessions(prev => {
        return prev.map(session => {
          if (session.id === activeSessionId) {
            let newName = session.name;
            if (history.length > 0 && session.name.startsWith("Session")) {
               const firstExamName = history[0].examName || extractExamName(rawInput);
               if (firstExamName) {
                  newName = firstExamName.length > 20 ? firstExamName.substring(0, 20) + "..." : firstExamName;
               }
            }
            return {
              ...session,
              name: newName,
              lastModified: Date.now(),
              data: {
                rawInput,
                config,
                history,
                aiExplanations,
                progress: { nextSerialIndex, usedRandomIndices }
              }
            };
          }
          return session;
        });
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [rawInput, config, history, aiExplanations, nextSerialIndex, usedRandomIndices]);

  useEffect(() => {
    const timeout = setTimeout(() => {
        if (isLoadedRef.current && sessions.length > 0) {
            localStorage.setItem('qm_sessions', JSON.stringify(sessions));
            localStorage.setItem('qm_active_session_id', activeSessionId);
        }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [sessions, activeSessionId]);

  // --- HELPER FOR SESSION NUMBERING ---
  const getNextSessionNumber = (currentSessions: StoredSession[]) => {
    let maxNum = 0;
    currentSessions.forEach(s => {
      let match = s.name.match(/^Session (\d+)$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    });
    return maxNum + 1;
  };

  const getNextGroupNumber = (currentSessions: StoredSession[]) => {
    let maxNum = 0;
    const seenGroups = new Set<string>();
    currentSessions.forEach(s => {
      if (s.groupName && !seenGroups.has(s.groupName)) {
        seenGroups.add(s.groupName);
        const match = s.groupName.match(/^Session Group (\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });
    return maxNum + 1;
  };

  // --- HANDLERS ---
  const handleCreateSession = () => {
    const now = Date.now();
    const nextNum = getNextSessionNumber(sessions);
    const newSession: StoredSession = {
      id: `session-${now}`,
      name: `Session ${nextNum}`,
      createdAt: now,
      lastModified: now,
      data: {
        rawInput: "",
        config: { timeMinutes: 15, questionLimit: 25, mode: QuizMode.SERIAL, shuffleOptions: true },
        history: [],
        aiExplanations: {},
        progress: { nextSerialIndex: 0, usedRandomIndices: [] }
      }
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setPhase('SETUP');
  };

  const handleSelectSession = (id: string) => { setActiveSessionId(id); setPhase('SETUP'); };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
       const remaining = sessions.filter(s => s.id !== id);
       setActiveSessionId(remaining.length > 0 ? remaining[0].id : "");
    }
  };

  const handleRenameSession = (id: string, newName: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const handleToggleFavorite = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s));
  };

  // Group Handlers
  const handleRenameGroup = (groupId: string, newName: string) => {
    setSessions(prev => prev.map(s => s.groupId === groupId ? { ...s, groupName: newName } : s));
  };

  const handleDeleteGroup = (groupId: string) => {
    const idsToDelete = sessions.filter(s => s.groupId === groupId).map(s => s.id);
    setSessions(prev => prev.filter(s => s.groupId !== groupId));
    if (idsToDelete.includes(activeSessionId)) {
        const remaining = sessions.filter(s => s.groupId !== groupId);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : "");
    }
  };

  const handleToggleGroupFavorite = (groupId: string) => {
    setSessions(prev => {
      const groupSessions = prev.filter(s => s.groupId === groupId);
      const allFav = groupSessions.every(s => s.isFavorite);
      return prev.map(s => s.groupId === groupId ? { ...s, isFavorite: !allFav } : s);
    });
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleMoveToGroup = (sessionId: string, targetGroupId: string) => {
    setSessions(prev => {
      const targetSession = prev.find(s => s.groupId === targetGroupId);
      const groupName = targetSession?.groupName || "Unknown Group";
      return prev.map(s => s.id === sessionId ? { ...s, groupId: targetGroupId, groupName } : s);
    });
  };

  const handleMoveToRoot = (sessionId: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, groupId: undefined, groupName: undefined } : s));
  };

  const handleCreateGroup = (sourceSessionId: string, targetSessionId: string) => {
    const newGroupId = `group-${Date.now()}`;
    const nextGroupNum = getNextGroupNumber(sessions);
    const groupName = `Session Group ${nextGroupNum}`;
    setSessions(prev => prev.map(s => {
        if (s.id === sourceSessionId || s.id === targetSessionId) {
            return { ...s, groupId: newGroupId, groupName };
        }
        return s;
    }));
  };

  const handleClearAllSessions = () => {
     setSessions([]); setActiveSessionId(""); localStorage.clear();
  };

  const handleImportData = (data: any) => {
    const now = Date.now();
    if (Array.isArray(data)) {
        const validSessions = data.filter(d => d.id && d.data);
        if (validSessions.length > 0) {
           const groupId = `group-${now}`;
           const nextGroupNum = getNextGroupNumber(sessions);
           const groupName = `Session Group ${nextGroupNum}`;
           setSessions(prev => {
             const newSessions = [...prev];
             validSessions.forEach(s => {
                const newId = `session-${s.createdAt || now}-${Math.random().toString(36).substr(2, 5)}`;
                newSessions.push({ ...s, id: newId, groupId: groupId, groupName: groupName });
             });
             return newSessions.sort((a, b) => b.createdAt - a.createdAt);
           });
           alert(`${validSessions.length} sessions imported into "${groupName}".`);
        }
    } else if (data.version && (data.rawInput !== undefined || data.history)) {
         const name = extractExamName(data.rawInput) || `Imported ${new Date().toLocaleTimeString()}`;
         const newSessionData = {
            rawInput: data.rawInput || "",
            config: data.config || { timeMinutes: 15, questionLimit: 25, mode: QuizMode.SERIAL, shuffleOptions: true },
            history: data.history || [],
            progress: data.progress || { nextSerialIndex: 0, usedRandomIndices: [] }
         };
         const currentSession = sessions.find(s => s.id === activeSessionId);
         const isEmptySession = currentSession && !currentSession.data.rawInput && currentSession.data.history.length === 0;
         if (isEmptySession && activeSessionId) {
             setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, name: name, lastModified: now, data: newSessionData } : s));
             setRawInput(newSessionData.rawInput);
             setConfig(newSessionData.config);
             setHistory(newSessionData.history);
             setNextSerialIndex(newSessionData.progress.nextSerialIndex);
             setUsedRandomIndices(newSessionData.progress.usedRandomIndices);
             alert("Session imported into current active session.");
         } else {
             const newSession: StoredSession = {
                id: `session-${now}`, name: name, createdAt: now, lastModified: now, data: newSessionData
             };
             setSessions(prev => [newSession, ...prev]);
             setActiveSessionId(newSession.id);
             alert("Session imported as a new session.");
         }
    } else {
        alert("Invalid file format.");
    }
  };

  // --- AI Config ---
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(() => {
    const storedConfig = localStorage.getItem('qm_ai_config');
    if (storedConfig) { try { return JSON.parse(storedConfig); } catch (e) { console.error("AI Config parse error"); } }
    const legacyKey = localStorage.getItem('qm_user_api_key');
    if (legacyKey) { return { provider: 'gemini', apiKey: legacyKey, model: 'gemini-3-flash-preview' }; }
    return null;
  });
  
  useEffect(() => { 
    if (aiConfig) localStorage.setItem('qm_ai_config', JSON.stringify(aiConfig));
    else localStorage.removeItem('qm_ai_config');
  }, [aiConfig]);

  const handleSetAiConfig = (newConfig: AIConfig) => { setAiConfig(newConfig); localStorage.removeItem('qm_user_api_key'); };
  const handleRemoveAiConfig = () => { setAiConfig(null); localStorage.removeItem('qm_user_api_key'); };

  // State
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [parsedExamName, setParsedExamName] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAllQuestions(parseQuestions(rawInput));
      setParsedExamName(extractExamName(rawInput));
    }, 400); // Increased debounce to prevent freezing UI while typing large banks
    return () => clearTimeout(timer);
  }, [rawInput]);

  const [phase, setPhase] = useState<AppPhase>('SETUP');
  const [activeBatch, setActiveBatch] = useState<Question[]>([]);
  const [activeTimeLimit, setActiveTimeLimit] = useState(15);
  const [activeParentExamId, setActiveParentExamId] = useState<number | undefined>(undefined);
  const [activeExamName, setActiveExamName] = useState<string | undefined>(undefined);
  const [reviewItem, setReviewItem] = useState<ExamResult | null>(null);

  const examLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    const rootIdToNumber = new Map<number, number>();
    const rootIdToSubCount = new Map<number, number>();
    let nextRoot = 1;
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
    for (const exam of sortedHistory) {
        if (exam.parentExamId && rootIdToNumber.has(exam.parentExamId)) {
             const pNum = rootIdToNumber.get(exam.parentExamId)!;
             const sub = (rootIdToSubCount.get(exam.parentExamId) || 0) + 1;
             rootIdToSubCount.set(exam.parentExamId, sub);
             map.set(exam.id, `${pNum}.${sub}`);
        } else {
             const myNum = nextRoot++;
             rootIdToNumber.set(exam.id, myNum);
             rootIdToSubCount.set(exam.id, 0);
             map.set(exam.id, `${myNum}`);
        }
    }
    return map;
  }, [history]);

  const currentExamLabel = useMemo(() => {
    if (phase !== 'QUIZ') return '';
    let nextRoot = 1;
    const rootIdToNumber = new Map<number, number>();
    const rootIdToSubCount = new Map<number, number>();
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
    for (const exam of sortedHistory) {
      if (!exam.parentExamId) {
        rootIdToNumber.set(exam.id, nextRoot++);
        rootIdToSubCount.set(exam.id, 0);
      } else if (rootIdToNumber.has(exam.parentExamId)) {
        const sub = (rootIdToSubCount.get(exam.parentExamId) || 0) + 1;
        rootIdToSubCount.set(exam.parentExamId, sub);
      }
    }
    if (activeParentExamId !== undefined) {
      if (rootIdToNumber.has(activeParentExamId)) {
         const pNum = rootIdToNumber.get(activeParentExamId);
         const sub = (rootIdToSubCount.get(activeParentExamId) || 0) + 1;
         return `Exam ${pNum}.${sub}`;
      }
      return 'Retake';
    } else {
      return `Exam ${nextRoot}`;
    }
  }, [history, activeParentExamId, phase]);

  useEffect(() => {
    if (allQuestions.length === 0) {
      setConfig(prev => ({ ...prev, questionLimit: 25, timeMinutes: 15 }));
      return;
    }
    let availableCount = allQuestions.length;
    if (config.mode === QuizMode.SERIAL) {
      const remaining = Math.max(0, allQuestions.length - nextSerialIndex);
      if (remaining > 0) availableCount = remaining;
    } else if (config.mode === QuizMode.RANDOM_LIMITED) {
      const remaining = Math.max(0, allQuestions.length - usedRandomIndices.length);
      if (remaining > 0) availableCount = remaining;
    }
    const smartLimit = Math.min(25, availableCount);
    const smartTime = Math.max(1, Math.round(smartLimit * 0.6));
    setConfig(prev => ({ ...prev, questionLimit: smartLimit, timeMinutes: smartTime }));
  }, [allQuestions.length, config.mode]); 

  const stats = useMemo(() => {
    if (config.mode === QuizMode.SERIAL) {
      return { total: allQuestions.length, taken: nextSerialIndex, remaining: Math.max(0, allQuestions.length - nextSerialIndex) };
    } else if (config.mode === QuizMode.RANDOM_LIMITED) {
      return { total: allQuestions.length, taken: usedRandomIndices.length, remaining: Math.max(0, allQuestions.length - usedRandomIndices.length) };
    } else {
      return { total: allQuestions.length, taken: "N/A", remaining: "Unlimited" };
    }
  }, [config.mode, allQuestions.length, nextSerialIndex, usedRandomIndices.length]);

  const processBatchOptions = (questions: Question[], forceShuffle = false): Question[] => {
    if (!config.shuffleOptions && !forceShuffle) return questions;
    return questions.map(q => {
      const correctText = q.opt[q.a];
      const currentValues = [q.opt['ক'], q.opt['খ'], q.opt['গ'], q.opt['ঘ']];
      const shuffledValues = [...currentValues].sort(() => Math.random() - 0.5);
      const newOpt: QuestionOptions = {};
      OPTION_KEYS.forEach((key, index) => { newOpt[key] = shuffledValues[index]; });
      const newCorrectKey = OPTION_KEYS.find(key => newOpt[key] === correctText) || q.a;
      return { ...q, opt: newOpt, a: newCorrectKey };
    });
  };

  const handleStartExam = () => {
    if (allQuestions.length === 0) { window.alert("সঠিক ফরম্যাটে প্রশ্ন দিন!"); return; }
    const safeLimit = Number(config.questionLimit) || 1;
    const safeTime = Number(config.timeMinutes) || 1;
    let batch: Question[] = [];
    if (config.mode === QuizMode.SERIAL) {
      let startIndex = nextSerialIndex;
      if (startIndex >= allQuestions.length) { window.alert("সব প্রশ্ন শেষ! আবার ১ থেকে শুরু।"); startIndex = 0; setNextSerialIndex(0); }
      batch = allQuestions.slice(startIndex, startIndex + safeLimit);
      setNextSerialIndex(startIndex + batch.length);
    } 
    else if (config.mode === QuizMode.RANDOM_LIMITED) {
      let available = allQuestions.filter(q => !usedRandomIndices.includes(q.originalIndex));
      if (available.length === 0) { window.alert("র‍্যান্ডম লিমিটেড শেষ! রিসেট হচ্ছে।"); setUsedRandomIndices([]); available = [...allQuestions]; }
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      batch = shuffled.slice(0, safeLimit);
      const newUsed = batch.map(q => q.originalIndex);
      setUsedRandomIndices(prev => [...prev, ...newUsed]);
    } 
    else {
      batch = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, safeLimit);
    }
    if (batch.length === 0) { window.alert("কোনো প্রশ্ন পাওয়া যায়নি।"); return; }
    const finalBatch = processBatchOptions(batch);
    setActiveBatch(finalBatch);
    setActiveTimeLimit(safeTime);
    setActiveParentExamId(undefined);
    setActiveExamName(parsedExamName || undefined);
    setPhase('QUIZ');
    window.scrollTo(0, 0);
  };

  const handleRetake = (result: ExamResult) => {
    if (!result.questions || result.questions.length === 0) return;
    let batch = [...result.questions];
    batch.sort(() => Math.random() - 0.5);
    const finalBatch = processBatchOptions(batch, true);
    const timeLimit = Math.max(1, Math.round(finalBatch.length * 0.6));
    const rootId = result.parentExamId || result.id;
    setActiveParentExamId(rootId);
    setActiveBatch(finalBatch);
    setActiveTimeLimit(timeLimit);
    setActiveExamName(result.examName); 
    setPhase('QUIZ');
    setReviewItem(null); 
    window.scrollTo(0, 0);
  };

  const handleSubmitExam = (userAnswers: (string | null)[]) => {
    // Process results with a slight delay to allow the QuizView loading animation to show
    setTimeout(() => {
        let correct = 0, wrong = 0, skipped = 0;
        activeBatch.forEach((q, idx) => {
          const ans = userAnswers[idx];
          if (!ans) skipped++;
          else if (ans === q.a) correct++;
          else wrong++;
        });
        const result: ExamResult = {
          id: Date.now(), timestamp: Date.now(), questions: activeBatch, userChoices: userAnswers,
          stats: { correct, wrong, skipped, total: activeBatch.length }, negativeMark: 0.25, parentExamId: activeParentExamId, examName: activeExamName
        };
        setHistory(prev => [...prev, result]);
        setPhase('SETUP');
        setReviewItem(result);
    }, 50);
  };

  const handleUpdateExamResult = (updatedResult: ExamResult) => {
    setHistory(prev => prev.map(item => item.id === updatedResult.id ? updatedResult : item));
    if (reviewItem && reviewItem.id === updatedResult.id) setReviewItem(updatedResult);
  };

  const handleReset = () => {
    setNextSerialIndex(0); setUsedRandomIndices([]); setHistory([]);
    setConfig({ timeMinutes: 15, questionLimit: 25, mode: QuizMode.SERIAL, shuffleOptions: true });
    setPhase('SETUP');
  };

  const progressInfo = useMemo(() => ({ nextSerialIndex, usedRandomIndices }), [nextSerialIndex, usedRandomIndices]);

  if (isAppLoading) {
    return (
      <div className="min-h-screen dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-xs font-bold font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10 dark:bg-black transition-colors duration-200">
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onToggleFavorite={handleToggleFavorite}
        onClearAll={handleClearAllSessions}
        onImportData={handleImportData}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
        onToggleGroupFavorite={handleToggleGroupFavorite}
        onMoveToGroup={handleMoveToGroup}
        onMoveToRoot={handleMoveToRoot}
        onCreateGroup={handleCreateGroup}
      />
      <div className="w-full mx-auto px-2 sm:px-4 py-2 sm:py-4">
        {phase === 'SETUP' && (
          <div className="max-w-3xl mx-auto w-full">
            <SetupView
              rawInput={rawInput}
              setRawInput={setRawInput}
              config={config}
              setConfig={setConfig}
              stats={stats}
              history={history}
              progress={progressInfo}
              onImportData={handleImportData}
              onStart={handleStartExam}
              onReset={handleReset}
              aiConfig={aiConfig}
              onSetAiConfig={handleSetAiConfig}
              onRemoveAiConfig={handleRemoveAiConfig}
              onOpenSidebar={() => setIsSidebarOpen(true)}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
            <div className="history-section">
                <HistoryView 
                  history={history} 
                  examLabelMap={examLabelMap}
                  onReview={setReviewItem} 
                  onExport={() => {}} 
                  onImport={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try { handleImportData(JSON.parse(ev.target?.result as string)); } catch(e){}
                    };
                    reader.readAsText(file);
                    e.target.value='';
                  }}
                  onReset={handleReset}
                />
            </div>
          </div>
        )}
        {phase === 'QUIZ' && (
          <QuizView
            questions={activeBatch}
            timeLimitMinutes={activeTimeLimit}
            onSubmit={handleSubmitExam}
            examTitle={currentExamLabel}
            customExamName={activeExamName}
          />
        )}
      </div>
      <ReviewModal 
        result={reviewItem}
        examNumber={reviewItem ? examLabelMap.get(reviewItem.id) : undefined}
        onClose={() => setReviewItem(null)} 
        onRetake={() => reviewItem && handleRetake(reviewItem)}
        onUpdateResult={handleUpdateExamResult}
        aiConfig={aiConfig}
        onSetAiConfig={handleSetAiConfig}
        onRemoveAiConfig={handleRemoveAiConfig}
        savedExplanations={aiExplanations}
        onUpdateExplanation={(questionId, messages) => setAiExplanations(prev => ({ ...prev, [questionId]: messages }))}
      />
    </div>
  );
};

export default App;
