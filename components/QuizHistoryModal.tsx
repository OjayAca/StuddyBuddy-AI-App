import React, { useEffect, useState } from 'react';
import { QuizResult } from '../types';
import { XIcon, HistoryIcon, TrashIcon, BrainCircuitIcon } from './Icons';

interface QuizHistoryModalProps {
  onClose: () => void;
}

const QuizHistoryModal: React.FC<QuizHistoryModalProps> = ({ onClose }) => {
  const [history, setHistory] = useState<QuizResult[]>([]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('studyBuddy_quizHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Sort by date descending
        setHistory(parsed.sort((a: QuizResult, b: QuizResult) => b.date - a.date));
      } catch (e) {
        console.error("Failed to load quiz history");
      }
    }
  }, []);

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your quiz history?")) {
      localStorage.removeItem('studyBuddy_quizHistory');
      setHistory([]);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-indigo-500" />
            Quiz History
          </h2>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
                <button 
                    onClick={clearHistory} 
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    title="Clear History"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
                <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <BrainCircuitIcon className="w-12 h-12 mb-3 opacity-20" />
              <p>No quizzes taken yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((result) => (
                <div key={result.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{result.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>{formatDate(result.date)}</span>
                      {result.topic && (
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs">
                          {result.topic}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className={`text-xl font-bold ${
                         (result.score / result.totalQuestions) >= 0.8 ? 'text-green-500' :
                         (result.score / result.totalQuestions) >= 0.5 ? 'text-amber-500' : 'text-red-500'
                     }`}>
                       {result.score}/{result.totalQuestions}
                     </span>
                     <span className="text-xs text-gray-400">Score</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizHistoryModal;
