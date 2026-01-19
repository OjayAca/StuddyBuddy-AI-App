import React, { useState } from 'react';
import { UserProfile } from '../types';
import { XIcon, UsersIcon, Volume2Icon, BrainCircuitIcon } from './Icons';

interface SettingsModalProps {
  onClose: () => void;
  userProfile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, userProfile, onSave }) => {
  const [formData, setFormData] = useState<UserProfile>(userProfile);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    setTimeout(() => {
        setSaved(false);
        onClose();
    }, 800);
  };

  const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  const learningStyles = ['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic'];
  const difficulties = ['Beginner', 'Intermediate', 'Advanced'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-800 overflow-hidden transform transition-all scale-100">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-indigo-500" />
            Profile & Settings
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Display Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
              placeholder="Your name"
            />
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Volume2Icon className="w-4 h-4 text-indigo-500" />
              AI Tutor Voice
            </label>
            <div className="grid grid-cols-3 gap-2">
              {voices.map(voice => (
                <button
                  type="button"
                  key={voice}
                  onClick={() => setFormData({...formData, voice: voice as any})}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                    formData.voice === voice
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                  }`}
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>

          {/* Learning Preferences */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <BrainCircuitIcon className="w-4 h-4" />
              Learning Preferences
            </h3>
            
            <div className="space-y-2">
               <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Preferred Learning Style</label>
               <select
                 value={formData.learningStyle}
                 onChange={e => setFormData({...formData, learningStyle: e.target.value as any})}
                 className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none dark:text-white"
               >
                 {learningStyles.map(style => <option key={style} value={style}>{style}</option>)}
               </select>
            </div>

            <div className="space-y-2">
               <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Explanation Difficulty</label>
               <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                 {difficulties.map(level => (
                   <button
                     type="button"
                     key={level}
                     onClick={() => setFormData({...formData, difficultyLevel: level as any})}
                     className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                       formData.difficultyLevel === level
                         ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                         : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                     }`}
                   >
                     {level}
                   </button>
                 ))}
               </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between pt-2">
             <span className="text-sm text-gray-700 dark:text-gray-300">Enable Notifications</span>
             <button
               type="button"
               onClick={() => setFormData({...formData, notifications: !formData.notifications})}
               className={`w-11 h-6 flex items-center rounded-full transition-colors duration-200 focus:outline-none ${
                 formData.notifications ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
               }`}
             >
               <span
                 className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${
                   formData.notifications ? 'translate-x-6' : 'translate-x-1'
                 }`}
               />
             </button>
          </div>

          <button
            type="submit"
            className={`w-full py-2.5 rounded-xl font-medium text-white transition-all transform active:scale-95 ${
                saved ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-900 dark:bg-white dark:text-gray-900 hover:opacity-90'
            }`}
          >
            {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;