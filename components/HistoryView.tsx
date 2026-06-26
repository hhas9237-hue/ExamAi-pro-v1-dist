
import React from 'react';
import { ExamResult } from '../types';
import { LucideHistory, LucideChevronRight, LucideAward, LucideRotateCcw } from 'lucide-react';

interface HistoryViewProps {
  history: ExamResult[];
  examLabelMap: Map<number, string>;
  onReview: (result: ExamResult) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = React.memo(({ 
  history, 
  examLabelMap,
  onReview,
  onExport,
  onImport,
  onReset
}) => {
  const [renderLimit, setRenderLimit] = React.useState(20);
  
  if (history.length === 0) {
    return (
      <div className="mt-6 border-t-2 border-gray-200 dark:border-gray-800 pt-4">
         <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <LucideHistory size={16} />
                    পরীক্ষার ইতিহাস
                </h3>
                <button onClick={onReset} disabled={history.length === 0} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 rounded text-[0.625rem] font-bold cursor-not-allowed shadow-none transition-colors">
                    <LucideRotateCcw size={10} /> রিসেট
                </button>
            </div>
            
            <span className="text-[0.625rem] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-800">
               পরীক্ষা সংখ্যা: 0
            </span>
         </div>
         <div className="p-4 text-center text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-800 shadow-sm text-xs">
            কোনো ইতিহাস নেই।
        </div>
      </div>
    );
  }

  const displayHistory = [...history].reverse();

  const getTruncatedName = (name: string) => {
    return name.length > 6 ? `(${name.slice(0, 6)}...)` : `(${name})`;
  };

  return (
    <div className="mt-6 border-t-2 border-gray-200 dark:border-gray-800 pt-4">
      <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <LucideHistory size={16} />
                পরীক্ষার ইতিহাস
            </h3>
            <button onClick={onReset} className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 rounded text-[0.625rem] font-bold transition-colors">
                <LucideRotateCcw size={10} /> রিসেট
            </button>
          </div>
          
          <span className="text-[0.625rem] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
             পরীক্ষা সংখ্যা: {history.length}
          </span>
      </div>
      
      <div className="space-y-2">
        {displayHistory.slice(0, renderLimit).map((res) => {
          const negMark = res.negativeMark || 0.25;
          const score = (res.stats.correct * 1) - (res.stats.wrong * negMark);
          const examLabel = examLabelMap.get(res.id) || '?';
          
          return (
            <div
              key={res.id}
              onClick={() => onReview(res)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:shadow-lg transition-all text-gray-800 dark:text-gray-200 shadow-sm group cursor-pointer relative"
            >
              <div className="flex justify-between items-center mb-1.5 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center text-xs">
                    <LucideAward size={14} className="text-amber-500 mr-1" />
                    Exam {examLabel}
                    {res.examName && (
                        <span className="text-[0.8em] text-gray-500 dark:text-gray-400 ml-1">{getTruncatedName(res.examName)}</span>
                    )}
                  </div>
                </div>

                {/* Score Badge */}
                <span className="text-[0.5625rem] text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 shadow-sm flex items-center gap-1 whitespace-nowrap mx-1">
                    Score: {score.toFixed(2)} <span className="text-[0.8em] text-gray-400 dark:text-gray-500">(-{negMark})</span>
                </span>

                {/* Date Badge */}
                <span className="text-[0.5625rem] text-gray-800 dark:text-gray-200 font-bold bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/50 whitespace-nowrap">
                  {new Date(res.timestamp).toLocaleDateString()} {new Date(res.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-xs border-t border-dashed border-gray-200 dark:border-gray-800 pt-1.5 mt-1.5">
                <div className="flex gap-2 text-[0.625rem] sm:text-xs">
                  <span className="text-green-600 dark:text-green-400 font-bold">সঠিক: {res.stats.correct}</span>
                  <span className="text-red-600 dark:text-red-400 font-bold">ভুল: {res.stats.wrong}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">বাকি: {res.stats.skipped}</span>
                </div>
                
                <div className="flex gap-1.5">
                    <button 
                      className="flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[0.625rem] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-100 dark:border-blue-900/50 shadow-sm"
                    >
                      রিভিউ <LucideChevronRight size={10} />
                    </button>
                </div>
              </div>
            </div>
          );
        })}
        {renderLimit < displayHistory.length && (
            <button
                onClick={() => setRenderLimit(prev => prev + 20)}
                className="w-full py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
                আরও দেখুন
            </button>
        )}
      </div>
    </div>
  );
});