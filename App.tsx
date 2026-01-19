import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import StudyMaterials from './components/StudyMaterials';
import QuizOverlay from './components/QuizOverlay';
import SettingsModal from './components/SettingsModal';
import QuizHistoryModal from './components/QuizHistoryModal';
import { StudyMaterial, UserProfile } from './types';
import { SunIcon, MoonIcon, BrainCircuitIcon, SettingsIcon, HistoryIcon } from './components/Icons';

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);

  // Default User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Student',
    learningStyle: 'Visual',
    difficultyLevel: 'Intermediate',
    voice: 'Kore',
    notifications: true
  });

  // Initialize theme based on system pref
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Load profile from local storage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('studyBuddy_profile');
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error("Failed to parse user profile");
      }
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleSaveProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    localStorage.setItem('studyBuddy_profile', JSON.stringify(newProfile));
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-16 shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <BrainCircuitIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
            StudyBuddy
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowQuiz(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-lg font-medium shadow-md shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
          >
            <BrainCircuitIcon className="w-4 h-4" />
            Quiz Mode
          </button>
          
          <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
            <button
                onClick={() => setShowHistory(true)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                title="Quiz History"
            >
                <HistoryIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Toggle Theme"
            >
              {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-4 gap-4 bg-gray-50 dark:bg-gray-950">
        {/* Left: Chat */}
        <div className="flex-1 min-h-[400px]">
          <ChatInterface materials={materials} userProfile={userProfile} />
        </div>

        {/* Right: Materials */}
        <div className="w-full md:w-[400px] xl:w-[450px] shrink-0 min-h-[300px]">
          <StudyMaterials materials={materials} setMaterials={setMaterials} />
        </div>
      </main>
      
      {/* Mobile Floating Action Button for Quiz (visible only on small screens) */}
      <button
        onClick={() => setShowQuiz(true)}
        className="md:hidden fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-600/40 z-40 hover:scale-105 transition-transform"
      >
        <BrainCircuitIcon className="w-6 h-6" />
      </button>

      {/* Quiz Overlay */}
      {showQuiz && (
        <QuizOverlay 
          onClose={() => setShowQuiz(false)} 
          materials={materials} 
        />
      )}

      {/* Quiz History Modal */}
      {showHistory && (
          <QuizHistoryModal onClose={() => setShowHistory(false)} />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          userProfile={userProfile}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
};

export default App;