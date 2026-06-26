
import React, { useState, useRef, useMemo } from 'react';
import { StoredSession } from '../types';
import { 
  LucideFileText, LucideX, LucideSearch, LucidePlus, LucideStar, 
  LucideDownload, LucidePencil, LucideTrash2, LucideCheck, LucideAlertTriangle,
  LucideUpload, LucideSave, LucideFolder, LucideFolderOpen, LucideChevronDown, LucideChevronRight
} from 'lucide-react';
import { generateBackupFilename } from '../utils/parser';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: StoredSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newName: string) => void;
  onToggleFavorite: (id: string) => void;
  onClearAll: () => void;
  onImportData: (data: any) => void;
  onRenameGroup?: (groupId: string, newName: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupFavorite?: (groupId: string) => void;
  onMoveToGroup?: (sessionId: string, targetGroupId: string) => void;
  onMoveToRoot?: (sessionId: string) => void;
  onCreateGroup?: (sourceSessionId: string, targetSessionId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onToggleFavorite,
  onClearAll,
  onImportData,
  onRenameGroup,
  onDeleteGroup,
  onToggleGroupFavorite,
  onMoveToGroup,
  onMoveToRoot,
  onCreateGroup
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [renderLimit, setRenderLimit] = useState(30);
  
  // Group editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const importInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Filter Sessions
  const filteredSessions = sessions
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(s => showFavorites ? s.isFavorite : true)
    .sort((a, b) => b.createdAt - a.createdAt);

  const getDateKey = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'আজ (TODAY)';
    if (date.toDateString() === yesterday.toDateString()) return 'গতকাল (YESTERDAY)';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const sessionGroups: Record<string, StoredSession[]> = {};
  const standaloneSessions: StoredSession[] = [];

  filteredSessions.forEach(s => {
    if (s.groupId) {
      if (!sessionGroups[s.groupId]) sessionGroups[s.groupId] = [];
      sessionGroups[s.groupId].push(s);
    } else {
      standaloneSessions.push(s);
    }
  });

  interface DisplayItem {
    type: 'SESSION' | 'GROUP';
    id: string; // sessionId or groupId
    sortTime: number;
    data: StoredSession | StoredSession[];
  }

  const displayItems: DisplayItem[] = [];

  standaloneSessions.forEach(s => {
    displayItems.push({ type: 'SESSION', id: s.id, sortTime: s.createdAt, data: s });
  });

  Object.keys(sessionGroups).forEach(groupId => {
    const groupItems = sessionGroups[groupId];
    if (groupItems.length === 0) return;
    groupItems.sort((a, b) => b.createdAt - a.createdAt);
    const latestTime = groupItems[0].createdAt;
    displayItems.push({ type: 'GROUP', id: groupId, sortTime: latestTime, data: groupItems });
  });

  displayItems.sort((a, b) => b.sortTime - a.sortTime);

  const dateCategorized: Record<string, DisplayItem[]> = {};
  displayItems.slice(0, renderLimit).forEach(item => {
    const key = getDateKey(item.sortTime);
    if (!dateCategorized[key]) dateCategorized[key] = [];
    dateCategorized[key].push(item);
  });

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }).toUpperCase();
  };

  const truncateText = (text: string, limit: number) => {
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '...';
  };

  // Actions
  const startEditingSession = (e: React.MouseEvent, session: StoredSession) => {
    e.stopPropagation(); setEditingId(session.id); setEditName(session.name);
  };
  const saveEditingSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId && editName.trim()) { onRenameSession(editingId, editName.trim()); setEditingId(null); }
  };
  const handleToggleFav = (e: React.MouseEvent, id: string) => { e.stopPropagation(); onToggleFavorite(id); };
  const handleDeleteSession = (e: React.MouseEvent, id: string) => { e.stopPropagation(); onDeleteSession(id); };
  const handleDownloadSession = (e: React.MouseEvent, session: StoredSession) => {
    e.stopPropagation();
    const backupData = {
       version: 1, timestamp: session.createdAt, rawInput: session.data.rawInput,
       config: session.data.config, progress: session.data.progress, history: session.data.history
    };
    downloadJSON(backupData, generateBackupFilename(session.name));
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };
  const startEditingGroup = (e: React.MouseEvent, groupId: string, currentName: string) => {
    e.stopPropagation(); setEditingGroupId(groupId); setEditGroupName(currentName);
  };
  const saveEditingGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingGroupId && editGroupName.trim() && onRenameGroup) {
       onRenameGroup(editingGroupId, editGroupName.trim());
       setEditingGroupId(null);
    }
  };
  
  const handleExportGroup = (e: React.MouseEvent, sessions: StoredSession[], groupName: string) => {
    e.stopPropagation();
    downloadJSON(sessions, `GroupBackup_${groupName.replace(/\s+/g, '_')}.json`);
  };
  const handleToggleGroupFav = (e: React.MouseEvent, groupId: string) => {
      e.stopPropagation();
      if (onToggleGroupFavorite) onToggleGroupFavorite(groupId);
  };

  const downloadJSON = (data: any, filename: string) => {
    const JSONString = JSON.stringify(data, null, 2);
    if ((window as any).Android && (window as any).Android.saveFile) {
        (window as any).Android.saveFile(filename, JSONString);
        return;
    }
    const blob = new Blob([JSONString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchExport = () => {
    downloadJSON(sessions, `ExamAi_Backup_${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleBatchImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try { onImportData(JSON.parse(event.target?.result as string)); } 
      catch (err) { alert("ফাইল রিড করতে সমস্যা হয়েছে।"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmClear = () => {
    onClearAll();
    setIsConfirmingClear(false);
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.setData('text/plain', sessionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSession = (e: React.DragEvent, targetSession: StoredSession) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetSession.id) return;

    if (targetSession.groupId) {
        // Target is in a group -> Add dragged to that group
        if (onMoveToGroup) onMoveToGroup(draggedId, targetSession.groupId);
    } else {
        // Target is standalone -> Create new group
        if (onCreateGroup) onCreateGroup(draggedId, targetSession.id);
    }
  };

  const handleDropOnGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    if (onMoveToGroup) onMoveToGroup(draggedId, groupId);
  };

  const handleDropOnRoot = (e: React.DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId) return;
      if (onMoveToRoot) onMoveToRoot(draggedId);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 z-[70] w-[85%] max-w-[20rem] bg-[#f0f2f5] dark:bg-gray-900 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-1.5"><LucideFileText className="text-blue-600 dark:text-blue-500" size={20} /><h2 className="text-base font-bold text-gray-800 dark:text-white">মেনু</h2></div>
          <div className="flex items-center gap-1">
             <input type="file" ref={importInputRef} onChange={handleBatchImport} accept=".json" className="hidden" />
             <button onClick={() => importInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-400" title="ইমপোর্ট"><LucideUpload size={16} /></button>
             <button onClick={handleBatchExport} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-400" title="এক্সপোর্ট সব"><LucideSave size={16} /></button>
             <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-red-500 transition-colors ml-1"><LucideX size={20} /></button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 space-y-2">
          <div className="relative">
            <LucideSearch className="absolute left-3 top-2.5 text-gray-400" size={14} />
            <input type="text" placeholder="সেশন খুঁজুন..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 pl-8 pr-3 py-1.5 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 border-none text-gray-700 dark:text-gray-200 font-medium placeholder-gray-400 dark:placeholder-gray-600" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { onCreateSession(); onClose(); }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform"><LucidePlus size={14} /> নতুন সেশন</button>
            <button onClick={() => setShowFavorites(!showFavorites)} className={`flex-1 border py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-colors ${showFavorites ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><LucideStar size={14} className={showFavorites ? 'fill-current' : ''} /> প্রিয় তালিকা</button>
          </div>
        </div>

        {/* List */}
        <div 
            className="flex-1 overflow-y-auto p-3 space-y-4 bg-[#f0f2f5] dark:bg-gray-950"
            onDragOver={handleDragOver}
            onDrop={handleDropOnRoot}
            onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop - clientHeight < 100) {
                    if (renderLimit < displayItems.length) {
                        setRenderLimit(prev => Math.min(prev + 20, displayItems.length));
                    }
                }
            }}
        >
           {Object.keys(dateCategorized).map((dateKey) => (
               <div key={dateKey}>
                 <h3 className="text-[0.625rem] font-bold text-gray-400 dark:text-gray-600 uppercase mb-2 pl-1">{dateKey}</h3>
                 <div className="space-y-2">
                   {dateCategorized[dateKey].map((item) => {
                     
                     // RENDER GROUP
                     if (item.type === 'GROUP') {
                        const groupSessions = item.data as StoredSession[];
                        const groupId = item.id;
                        const groupName = groupSessions[0].groupName || "Unnamed Group";
                        const isExpanded = expandedGroups[groupId];
                        const isEditing = editingGroupId === groupId;
                        const groupLatestTime = item.sortTime;
                        const allFav = groupSessions.every(s => s.isFavorite);
                        const isChildActive = groupSessions.some(s => s.id === activeSessionId);
                        
                        return (
                           <div 
                                key={groupId} 
                                className="mb-2"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDropOnGroup(e, groupId)}
                           >
                              {/* Group Box - Active style applied if child is active */}
                              <div 
                                onClick={() => toggleGroup(groupId)}
                                className={`relative group rounded-lg p-2.5 border transition-all cursor-pointer ${
                                    isChildActive 
                                    ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-400 dark:border-blue-700 shadow-sm' 
                                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-200 dark:hover:border-gray-700 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                                            <input 
                                              type="text" value={editGroupName} 
                                              onChange={e => setEditGroupName(e.target.value)} 
                                              className="w-full text-xs font-bold p-1 border border-blue-300 dark:border-blue-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" 
                                              autoFocus 
                                            />
                                            <button onClick={saveEditingGroup} className="p-1 bg-blue-600 text-white rounded"><LucideCheck size={12} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                {isExpanded ? <LucideFolderOpen size={14} className="text-indigo-500" /> : <LucideFolder size={14} className="text-amber-400" />}
                                                <span className={`text-xs font-bold ${isChildActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`} title={groupName}>{truncateText(groupName, 30)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[0.5625rem] text-gray-600 dark:text-gray-500 font-mono font-medium flex items-center gap-1">
                                                    <LucideFileText size={9} />
                                                    {formatTime(groupLatestTime)}
                                                </span>
                                                {isChildActive && <span className="text-[0.5rem] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1 rounded-full font-bold">Active Inside</span>}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-0.5 text-gray-400">
                                         {!isEditing && (
                                            <>
                                                <button onClick={(e) => handleToggleGroupFav(e, groupId)} className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${allFav ? 'text-amber-400' : 'hover:text-amber-400'}`}><LucideStar size={14} fill={allFav ? "currentColor" : "none"} /></button>
                                                <button onClick={(e) => handleExportGroup(e, groupSessions, groupName)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><LucideDownload size={14} /></button>
                                                <button onClick={(e) => startEditingGroup(e, groupId, groupName)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 transition-colors"><LucidePencil size={14} /></button>
                                            </>
                                         )}
                                         <button onClick={(e) => { e.stopPropagation(); toggleGroup(groupId); }} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 transition-colors">
                                            {isExpanded ? <LucideChevronDown size={14} /> : <LucideChevronRight size={14} />}
                                         </button>
                                    </div>
                                </div>
                              </div>
                              
                              {/* Expanded Content - Identical styling to root sessions, just indented */}
                              {isExpanded && (
                                 <div className="pl-3 mt-2 space-y-2 border-l-2 border-gray-100 dark:border-gray-800 ml-2">
                                    {groupSessions.map(session => {
                                       const isActive = session.id === activeSessionId;
                                       const isEditingSession = editingId === session.id;
                                       const isDeletingSession = deletingId === session.id;

                                       return (
                                           <div 
                                             key={session.id}
                                             onClick={() => { if (!isEditingSession && !isDeletingSession) { onSelectSession(session.id); onClose(); } }}
                                             className={`relative group rounded-lg p-2.5 border transition-all cursor-pointer ${isActive ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-400 dark:border-blue-700 shadow-sm' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-200 dark:hover:border-gray-700 hover:shadow-sm'}`}
                                             draggable={!isEditingSession}
                                             onDragStart={(e) => handleDragStart(e, session.id)}
                                           >
                                             {isDeletingSession ? (
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-bold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`} title={session.name}>{truncateText(session.name, 22)}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                      <span className="text-[0.5625rem] text-gray-600 dark:text-gray-500 font-mono font-medium flex items-center gap-1"><LucideFileText size={9} />{formatTime(session.createdAt)}</span>
                                                      {isActive && <span className="text-[0.5rem] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1 rounded-full font-bold">Active</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-red-400">
                                                        <LucideAlertTriangle size={10} className="shrink-0" />
                                                        <span className="text-[0.625rem] font-bold leading-tight">"{truncateText(session.name, 15)}" মুছে ফেলতে চান?</span>
                                                    </div>
                                                    <div className="flex gap-2 mt-1">
                                                      <button onClick={(e) => { e.stopPropagation(); setDeletingId(null); }} className="flex-1 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-[0.625rem] font-bold hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm">না</button>
                                                      <button onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); setDeletingId(null); }} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-[0.625rem] font-bold hover:bg-red-700 shadow-sm">হ্যাঁ, মুছুন</button>
                                                    </div>
                                                </div>
                                             ) : (
                                                <div className="flex items-center justify-between xl-1 mb-1">
                                                  {isEditingSession ? (
                                                     <div className="flex items-center gap-1 flex-1 mr-2" onClick={(e) => e.stopPropagation()}>
                                                       <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full text-xs font-bold p-1 border border-blue-300 dark:border-blue-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" autoFocus />
                                                       <button onClick={saveEditingSession} className="p-1 bg-blue-600 text-white rounded"><LucideCheck size={12} /></button>
                                                     </div>
                                                  ) : (
                                                     <div className="flex flex-col">
                                                       <span className={`text-xs font-bold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`} title={session.name}>{truncateText(session.name, 22)}</span>
                                                       <div className="flex items-center gap-2 mt-0.5">
                                                         <span className="text-[0.5625rem] text-gray-600 dark:text-gray-500 font-mono font-medium flex items-center gap-1"><LucideFileText size={9} />{formatTime(session.createdAt)}</span>
                                                         {isActive && <span className="text-[0.5rem] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1 rounded-full font-bold">Active</span>}
                                                       </div>
                                                     </div>
                                                  )}
                                                  <div className="flex items-center gap-0.5 text-gray-400">
                                                     <button onClick={(e) => handleToggleFav(e, session.id)} className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${session.isFavorite ? 'text-amber-400' : 'hover:text-amber-400'}`}><LucideStar size={14} fill={session.isFavorite ? "currentColor" : "none"} /></button>
                                                     <button onClick={(e) => handleDownloadSession(e, session)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><LucideDownload size={14} /></button>
                                                     <button onClick={(e) => startEditingSession(e, session)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 transition-colors"><LucidePencil size={14} /></button>
                                                     <button onClick={(e) => { e.stopPropagation(); setDeletingId(session.id); }} className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors z-10" title="মুছে ফেলুন"><LucideTrash2 size={14} /></button>
                                                  </div>
                                                </div>
                                             )}
                                           </div>
                                       );
                                    })}
                                 </div>
                              )}
                           </div>
                        );
                     }

                     // RENDER SINGLE SESSION
                     const session = item.data as StoredSession;
                     const isActive = session.id === activeSessionId;
                     const isEditing = editingId === session.id;
                     const isDeleting = deletingId === session.id;
                     
                     return (
                       <div 
                         key={session.id}
                         onClick={() => { if (!isEditing && !isDeleting) { onSelectSession(session.id); onClose(); } }}
                         className={`relative group rounded-lg p-2.5 border transition-all cursor-pointer ${isActive ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-400 dark:border-blue-700 shadow-sm' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-200 dark:hover:border-gray-700 hover:shadow-sm'}`}
                         draggable={!isEditing}
                         onDragStart={(e) => handleDragStart(e, session.id)}
                         onDragOver={handleDragOver}
                         onDrop={(e) => handleDropOnSession(e, session)}
                       >
                         {isDeleting ? (
                            <div className="flex flex-col">
                                <span className={`text-xs font-bold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`} title={session.name}>{truncateText(session.name, 22)}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[0.5625rem] text-gray-600 dark:text-gray-500 font-mono font-medium flex items-center gap-1"><LucideFileText size={9} />{formatTime(session.createdAt)}</span>
                                  {isActive && <span className="text-[0.5rem] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1 rounded-full font-bold">Active</span>}
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-red-400">
                                    <LucideAlertTriangle size={10} className="shrink-0" />
                                    <span className="text-[0.625rem] font-bold leading-tight">"{truncateText(session.name, 15)}" মুছে ফেলতে চান?</span>
                                </div>
                                <div className="flex gap-2 mt-1">
                                  <button onClick={(e) => { e.stopPropagation(); setDeletingId(null); }} className="flex-1 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-[0.625rem] font-bold hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm">না</button>
                                  <button onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); setDeletingId(null); }} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-[0.625rem] font-bold hover:bg-red-700 shadow-sm">হ্যাঁ, মুছুন</button>
                                </div>
                            </div>
                         ) : (
                            <div className="flex items-center justify-between mb-1">
                              {isEditing ? (
                                 <div className="flex items-center gap-1 flex-1 mr-2" onClick={(e) => e.stopPropagation()}>
                                   <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full text-xs font-bold p-1 border border-blue-300 dark:border-blue-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" autoFocus />
                                   <button onClick={saveEditingSession} className="p-1 bg-blue-600 text-white rounded"><LucideCheck size={12} /></button>
                                 </div>
                              ) : (
                                 <div className="flex flex-col">
                                   <span className={`text-xs font-bold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`} title={session.name}>{truncateText(session.name, 22)}</span>
                                   <div className="flex items-center gap-2 mt-0.5">
                                     <span className="text-[0.5625rem] text-gray-600 dark:text-gray-500 font-mono font-medium flex items-center gap-1"><LucideFileText size={9} />{formatTime(session.createdAt)}</span>
                                     {isActive && <span className="text-[0.5rem] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1 rounded-full font-bold">Active</span>}
                                   </div>
                                 </div>
                              )}
                              <div className="flex items-center gap-0.5 text-gray-400">
                                 <button onClick={(e) => handleToggleFav(e, session.id)} className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${session.isFavorite ? 'text-amber-400' : 'hover:text-amber-400'}`}><LucideStar size={14} fill={session.isFavorite ? "currentColor" : "none"} /></button>
                                 <button onClick={(e) => handleDownloadSession(e, session)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><LucideDownload size={14} /></button>
                                 <button onClick={(e) => startEditingSession(e, session)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 transition-colors"><LucidePencil size={14} /></button>
                                 <button onClick={(e) => { e.stopPropagation(); setDeletingId(session.id); }} className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors z-10" title="মুছে ফেলুন"><LucideTrash2 size={14} /></button>
                              </div>
                            </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </div>
           ))}
           {Object.keys(dateCategorized).length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-600 py-8 text-xs">{showFavorites ? 'কোনো প্রিয় সেশন নেই' : 'কোনো সেশন পাওয়া যায়নি'}</div>
           )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
           {!isConfirmingClear ? (
             <button onClick={() => setIsConfirmingClear(true)} className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 py-2.5 rounded-xl font-bold text-xs border border-red-100 dark:border-red-900/50 transition-colors"><LucideTrash2 size={16} /> সব ইতিহাস মুছুন</button>
           ) : (
             <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-2.5 border border-red-100 dark:border-red-900/30 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 justify-center mb-2"><LucideAlertTriangle size={14} /><span className="text-xs font-bold">আপনি কি নিশ্চিত?</span></div>
                <div className="flex gap-2">
                   <button onClick={() => setIsConfirmingClear(false)} className="flex-1 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-[0.625rem] font-bold hover:bg-gray-50 dark:hover:bg-gray-700">না</button>
                   <button onClick={handleConfirmClear} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-[0.625rem] font-bold hover:bg-red-700 shadow-sm">হ্যাঁ, সব মুছুন</button>
                </div>
             </div>
           )}
        </div>
      </div>
    </>
  );
};