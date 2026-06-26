
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Question } from '../types';
import { LucideClock } from 'lucide-react';
import { RichText } from './RichText';

interface QuizViewProps {
  questions: Question[];
  timeLimitMinutes: number;
  examTitle: string;
  customExamName?: string;
  onSubmit: (answers: (string | null)[]) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ questions, timeLimitMinutes, examTitle, customExamName, onSubmit }) => {
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>(new Array(questions.length).fill(null));
  const [renderLimit, setRenderLimit] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
            setRenderLimit(prev => Math.min(prev + 30, questions.length));
        }
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [questions.length]);

  const handleTimeUp = useCallback(() => {
    setIsSubmitting(true);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            onSubmit(userAnswers);
        });
    });
  }, [onSubmit, userAnswers]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleTimeUp]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleOptionSelect = (qIndex: number, value: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[qIndex] = value;
    setUserAnswers(newAnswers);
  };

  const answeredCount = userAnswers.filter(a => a !== null).length;

  return (
    <div className="pt-20 pb-4">
      
      {/* Top Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 shadow-md border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
        <div className="max-w-5xl mx-auto py-3 px-4 flex items-center justify-between gap-2 sm:gap-4">
            
            <div className="flex flex-col justify-center min-w-[3.75rem]">
                 <span className="text-[0.5625rem] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider leading-none mb-1">পরীক্ষা</span>
                 <span className="text-base font-black text-gray-800 dark:text-gray-100 leading-none whitespace-nowrap">{examTitle}</span>
                 {customExamName && (
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 leading-none mt-0.5 whitespace-nowrap">
                        {customExamName.length > 10 ? `${customExamName.slice(0, 10)}...` : customExamName}
                    </span>
                 )}
            </div>

            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/30 shrink-0 shadow-sm">
                    <LucideClock size={16} />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[0.5625rem] text-gray-500 dark:text-gray-400 font-bold mb-0.5">সময় বাকি</span>
                    <span className={`text-base font-bold tabular-nums ${timeLeft < 60 ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-900 dark:text-gray-100'}`}>
                        {formatTime(timeLeft)}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-center leading-none px-2 min-w-[3.125rem]">
                 <span className="text-[0.5625rem] text-gray-500 dark:text-gray-400 font-bold mb-0.5">উত্তর</span>
                 <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {answeredCount}<span className="text-gray-400 dark:text-gray-600 text-xs font-semibold">/{questions.length}</span>
                 </div>
            </div>

            <button 
                onClick={() => {
                   setIsSubmitting(true);
                   // Give browser a quick frame to show loading, without artificial delay
                   requestAnimationFrame(() => {
                       requestAnimationFrame(() => {
                           onSubmit(userAnswers);
                       });
                   });
                }}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-95 text-white px-5 py-2 rounded-lg font-bold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden"
            >
                <span className={`flex items-center justify-center gap-1 transition-opacity ${isSubmitting ? 'opacity-0' : 'opacity-100'}`}>
                    সাবমিট
                </span>
                {isSubmitting && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    </span>
                )}
            </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="max-w-5xl mx-auto space-y-2 px-3 sm:px-0">
        {questions.slice(0, renderLimit).map((qOriginal, renderIdx) => {
          const idx = questions.indexOf(qOriginal);
          const q = qOriginal;
          return (
          <div key={q.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
            
            <div className="flex items-start gap-2 mb-2.5">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shadow-sm mt-0.5">
                {idx + 1}
              </span>
               <div className="text-gray-800 dark:text-gray-100 font-bold text-base leading-relaxed pt-0.5 pb-0.5">
                <RichText text={q.q} />
              </div>
            </div>
            
            <div className="space-y-1.5">
              {Object.entries(q.opt).map(([key, val]) => {
                const isSelected = userAnswers[idx] === key;
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={key}
                      checked={isSelected}
                      onChange={() => handleOptionSelect(idx, key)}
                      className="hidden"
                    />
                    
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border ${
                       isSelected 
                         ? 'bg-blue-600 text-white border-blue-600' 
                         : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                    }`}>
                      {key}
                    </div>
                    
                    <div className={`font-bold text-sm leading-relaxed py-0.5 ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      <RichText text={val} isOption />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )})}
        {renderLimit < questions.length && (
            <div ref={observerRef} className="h-20 flex items-center justify-center text-gray-400 text-xs italic">আরও প্রশ্ন লোড হচ্ছে...</div>
        )}
      </div>
    </div>
  );
};