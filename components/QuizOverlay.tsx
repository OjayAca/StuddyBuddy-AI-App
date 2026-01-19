import React, { useState, useEffect } from 'react';
import { QuizData, StudyMaterial, QuizResult } from '../types';
import { generateQuizFromMaterials } from '../services/geminiService';
import { XIcon, BrainCircuitIcon, SparklesIcon, FileTextIcon } from './Icons';
import confetti from 'canvas-confetti';

interface QuizOverlayProps {
  onClose: () => void;
  materials: StudyMaterial[];
}

const COMMON_SUBJECTS = [
  'General / Any',
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 
  'Literature', 'Computer Science', 'Economics', 'Psychology', 
  'Art History', 'Geography', 'Philosophy', 'Political Science',
  'Law', 'Medicine', 'Engineering', 'Business'
];

const QuizOverlay: React.FC<QuizOverlayProps> = ({ onClose, materials }) => {
  // Setup State
  const [step, setStep] = useState<'setup' | 'loading' | 'quiz'>('setup');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set(materials.map(m => m.id)));
  
  const [selectedSubject, setSelectedSubject] = useState(COMMON_SUBJECTS[0]);
  const [focusTopic, setFocusTopic] = useState('');
  
  const [includeWeakTopics, setIncludeWeakTopics] = useState(false);
  const [availableWeakTopics, setAvailableWeakTopics] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Quiz State
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({}); 
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const weakTopicsJson = localStorage.getItem('studyBuddy_weakTopics');
    if (weakTopicsJson) {
      try {
        setAvailableWeakTopics(JSON.parse(weakTopicsJson));
      } catch (e) {
        console.error("Failed to parse weak topics", e);
      }
    }
  }, []);

  // Combine common subjects with weak topics for suggestions
  const allSuggestions = Array.from(new Set([...availableWeakTopics, ...COMMON_SUBJECTS.filter(s => s !== 'General / Any')])).sort();

  const toggleMaterial = (id: string) => {
    const newSet = new Set(selectedMaterialIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMaterialIds(newSet);
  };

  const handleStartQuiz = async () => {
    if (selectedMaterialIds.size === 0) {
      setError("Please select at least one study material.");
      return;
    }

    setStep('loading');
    setError(null);

    try {
      const filteredMaterials = materials.filter(m => selectedMaterialIds.has(m.id));
      const data = await generateQuizFromMaterials(
        filteredMaterials, 
        includeWeakTopics ? availableWeakTopics : [],
        focusTopic,
        selectedSubject
      );
      setQuizData(data);
      setStep('quiz');
    } catch (err: any) {
      setError(err.message || "Failed to generate quiz");
      setStep('setup'); // Return to setup to try again
    }
  };

  const handleOptionSelect = (qId: number, optionIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const handleSubmit = () => {
    if (!quizData) return;
    let correctCount = 0;
    
    // Spaced Repetition Logic: Track Topic Mastery
    const currentMastery = JSON.parse(localStorage.getItem('studyBuddy_topic_mastery') || '{}');
    const weakTopicsSet = new Set<string>(JSON.parse(localStorage.getItem('studyBuddy_weakTopics') || '[]'));

    quizData.questions.forEach(q => {
      const isCorrect = answers[q.id] === q.correctAnswerIndex;
      if (isCorrect) {
        correctCount++;
        // If correct, remove from weak topics if present
        if (weakTopicsSet.has(q.topic)) {
          weakTopicsSet.delete(q.topic);
        }
        // Increment mastery score (simple counter for now)
        currentMastery[q.topic] = (currentMastery[q.topic] || 0) + 1;
      } else {
        // If wrong, add to weak topics
        weakTopicsSet.add(q.topic);
        // Reset or decrement mastery
        currentMastery[q.topic] = Math.max(0, (currentMastery[q.topic] || 0) - 1);
      }
    });

    localStorage.setItem('studyBuddy_topic_mastery', JSON.stringify(currentMastery));
    localStorage.setItem('studyBuddy_weakTopics', JSON.stringify(Array.from(weakTopicsSet)));

    // Save Quiz Result to History
    let topicDisplay = focusTopic;
    if (!topicDisplay && selectedSubject !== 'General / Any') {
        topicDisplay = selectedSubject;
    }
    if (!topicDisplay) {
        topicDisplay = 'General';
    }

    const result: QuizResult = {
      id: Date.now().toString(),
      title: quizData.title,
      score: correctCount,
      totalQuestions: quizData.questions.length,
      date: Date.now(),
      topic: topicDisplay
    };
    
    const existingHistory = JSON.parse(localStorage.getItem('studyBuddy_quizHistory') || '[]');
    localStorage.setItem('studyBuddy_quizHistory', JSON.stringify([...existingHistory, result]));

    setScore(correctCount);
    setSubmitted(true);
    
    if (correctCount === quizData.questions.length) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  if (step === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
        <BrainCircuitIcon className="w-16 h-16 text-indigo-500 animate-pulse mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
           Generating Quiz...
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm text-center">
           {includeWeakTopics ? 'Focusing on your weak topics and selected materials.' : 'Analyzing your selected study materials to create questions.'}
        </p>
      </div>
    );
  }

  // Render Setup Screen
  if (step === 'setup') {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
             <div>
               <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <BrainCircuitIcon className="w-6 h-6 text-indigo-500" />
                 Configure Quiz
               </h2>
               <p className="text-sm text-gray-500 dark:text-gray-400">Customize what you want to review</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
               <XIcon className="w-6 h-6" />
             </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1">
             {/* Error Message */}
             {error && (
               <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-800">
                 {error}
               </div>
             )}

             {/* Material Selection */}
             <div>
               <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                 1. Select Content Sources
               </h3>
               {materials.length === 0 ? (
                 <div className="text-sm text-gray-500 italic p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                   No study materials found. Please upload PDFs or add notes first.
                 </div>
               ) : (
                 <div className="space-y-2">
                   {materials.map(mat => (
                     <label key={mat.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                       selectedMaterialIds.has(mat.id) 
                         ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                         : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                     }`}>
                       <input 
                         type="checkbox" 
                         checked={selectedMaterialIds.has(mat.id)} 
                         onChange={() => toggleMaterial(mat.id)}
                         className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                       />
                       <div className="flex-1 overflow-hidden">
                         <div className="flex items-center gap-2">
                           {mat.type === 'pdf' ? <FileTextIcon className="w-4 h-4 text-red-500" /> : <FileTextIcon className="w-4 h-4 text-gray-500" />}
                           <span className="font-medium text-gray-800 dark:text-gray-200 truncate block">
                             {mat.name || (mat.type === 'text' ? 'My Study Notes' : 'Document')}
                           </span>
                         </div>
                       </div>
                     </label>
                   ))}
                 </div>
               )}
             </div>

             {/* Subject & Topic Filtering */}
             <div className="relative z-10">
               <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                 2. Target Subject & Topic
               </h3>
               
               <div className="space-y-4">
                   {/* Subject Dropdown */}
                   <div>
                       <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">Subject</label>
                       <div className="relative">
                            <select 
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                className="w-full pl-4 pr-8 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all appearance-none"
                            >
                                {COMMON_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                       </div>
                   </div>

                   {/* Topic Input */}
                   <div className="relative group">
                       <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">Specific Topic (Optional)</label>
                        <div className="relative z-20">
                            <input
                                type="text"
                                value={focusTopic}
                                onChange={(e) => {
                                setFocusTopic(e.target.value);
                                setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                placeholder="e.g. Thermodynamics, WW2, Algebra..."
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                            />
                            <SparklesIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Click outside listener */}
                        {showSuggestions && (
                            <div className="fixed inset-0 z-10 cursor-default" onClick={() => setShowSuggestions(false)} />
                        )}
                        
                        {showSuggestions && (
                            <div className="absolute z-30 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                {allSuggestions.filter(s => s.toLowerCase().includes(focusTopic.toLowerCase())).length > 0 ? (
                                    allSuggestions
                                        .filter(s => s.toLowerCase().includes(focusTopic.toLowerCase()))
                                        .map(s => (
                                        <button
                                            key={s}
                                            onClick={() => {
                                                setFocusTopic(s);
                                                setShowSuggestions(false);
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-200 flex items-center justify-between border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors"
                                        >
                                            <span>{s}</span>
                                            {availableWeakTopics.includes(s) && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                                                    Weak Spot
                                                </span>
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic">
                                        Use custom topic: "{focusTopic}"
                                    </div>
                                )}
                            </div>
                        )}
                   </div>
               </div>
             </div>

             {/* Spaced Repetition */}
             {availableWeakTopics.length > 0 && (
               <div className="relative z-0">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                    3. Spaced Repetition
                  </h3>
                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                     includeWeakTopics
                       ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                       : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}>
                    <div className="mt-0.5">
                      <input 
                        type="checkbox"
                        checked={includeWeakTopics}
                        onChange={() => setIncludeWeakTopics(!includeWeakTopics)}
                        className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-gray-300"
                      />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">Focus on Weak Areas</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Prioritize questions about topics you've missed previously: {availableWeakTopics.slice(0, 3).join(', ')}...
                      </p>
                    </div>
                  </label>
               </div>
             )}
          </div>

          <div className="p-6 border-t border-gray-100 dark:border-gray-800 shrink-0 relative z-10">
            <button
              onClick={handleStartQuiz}
              disabled={materials.length === 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              <BrainCircuitIcon className="w-5 h-5" />
              Generate Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Quiz Interface
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="max-w-3xl mx-auto min-h-screen p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md py-4 border-b border-gray-200 dark:border-gray-800 z-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
               {quizData?.title}
               {includeWeakTopics && (
                 <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                   Spaced Repetition
                 </span>
               )}
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {selectedSubject !== 'General / Any' && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{selectedSubject}</span>
              )}
              {focusTopic && (
                  <span>/ {focusTopic}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <XIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Questions */}
        <div className="flex-1 space-y-8 pb-20">
          {quizData?.questions.map((q, idx) => {
            const isCorrect = submitted && answers[q.id] === q.correctAnswerIndex;
            
            return (
              <div key={q.id} className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-start gap-4 mb-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400">{q.topic}</span>
                     </div>
                     <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mt-1">{q.question}</h3>
                  </div>
                </div>

                <div className="space-y-3 pl-12">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = answers[q.id] === optIdx;
                    let optionClass = "border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer";
                    
                    if (submitted) {
                      if (optIdx === q.correctAnswerIndex) {
                         optionClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
                      } else if (isSelected && optIdx !== q.correctAnswerIndex) {
                         optionClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
                      } else {
                         optionClass = "opacity-50 border-gray-200 dark:border-gray-700";
                      }
                    } else if (isSelected) {
                      optionClass = "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-600";
                    }

                    return (
                      <div 
                        key={optIdx}
                        onClick={() => handleOptionSelect(q.id, optIdx)}
                        className={`p-4 rounded-xl border-2 transition-all ${optionClass}`}
                      >
                         {opt}
                      </div>
                    );
                  })}
                </div>

                {submitted && (
                  <div className="mt-4 ml-12 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700">
                    <span className="font-semibold block mb-1">Explanation:</span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
             {submitted ? (
               <div className="flex items-center gap-4">
                 <div className="text-xl font-bold dark:text-white">
                   Score: <span className={score === quizData?.questions.length ? "text-green-500" : "text-indigo-500"}>{score} / {quizData?.questions.length}</span>
                 </div>
                 <button 
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:shadow-lg transition-all"
                 >
                   Return to Dashboard
                 </button>
               </div>
             ) : (
               <div className="w-full flex justify-end">
                 <button 
                   onClick={handleSubmit}
                   disabled={Object.keys(answers).length !== quizData?.questions.length}
                   className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95"
                 >
                   Submit Answers
                 </button>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizOverlay;