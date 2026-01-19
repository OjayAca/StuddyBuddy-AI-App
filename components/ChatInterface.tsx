import React, { useState, useRef, useEffect } from 'react';
import { Message, StudyMaterial, ChatSession, UserProfile } from '../types';
import { sendMessageToTutor, generateSpeech } from '../services/geminiService';
import { SendIcon, BookOpenIcon, UsersIcon, MicIcon, Volume2Icon, StopCircleIcon, TrashIcon, EditIcon, PlusIcon, XIcon } from './Icons';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  materials: StudyMaterial[];
  userProfile: UserProfile;
}

const DEFAULT_SESSIONS: ChatSession[] = [
  { id: 'general', name: 'General', type: 'personal' },
  { id: 'g1', name: 'Physics 101 Study Group', type: 'group', members: 4 },
  { id: 'g2', name: 'Calculus Finals Prep', type: 'group', members: 8 },
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ materials, userProfile }) => {
  // --- Persistence Logic ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('studyBuddy_sessions');
    return saved ? JSON.parse(saved) : DEFAULT_SESSIONS;
  });

  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('studyBuddy_messages');
    if (saved) return JSON.parse(saved);
    return {
      'general': [{ role: 'model', text: `Hello ${userProfile.name}! I am your General StudyBuddy. How can I help you today?`, timestamp: Date.now() }],
      'g1': [{ role: 'model', text: 'Welcome to Physics 101! I am here to help the group with physics problems.', timestamp: Date.now() }],
      'g2': [{ role: 'model', text: 'Let’s crush Calculus! Ask me anything about limits, derivatives, or integrals.', timestamp: Date.now() }],
    };
  });

  useEffect(() => {
    localStorage.setItem('studyBuddy_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('studyBuddy_messages', JSON.stringify(messagesMap));
  }, [messagesMap]);

  const [activeSessionId, setActiveSessionId] = useState<string>('general');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Creation Mode State (Modal)
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'personal' | 'group'>('personal');
  const [newItemName, setNewItemName] = useState('');

  // Voice Mode State
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const currentMessages = messagesMap[activeSessionId] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, activeSessionId]);

  // Cleanup audio/speech on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const stopAudio = () => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
      currentSourceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const playAudio = async (base64Audio: string) => {
    stopAudio();
    try {
      if (!audioContextRef.current) {
        // Using standard AudioContext
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioCtx = audioContextRef.current;
      
      // Critical: Resume context if suspended (common browser policy issue)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // decodeAudioData method as recommended in prompt context for raw PCM
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const numChannels = 1;
      const sampleRate = 24000;
      
      const frameCount = dataInt16.length / numChannels;
      const buffer = audioCtx.createBuffer(numChannels, frameCount, sampleRate);
      
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
          // Int16 to Float32 normalization
          channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlayingAudio(false);
      
      currentSourceRef.current = source;
      source.start();
      setIsPlayingAudio(true);
    } catch (e) {
      console.error("Audio playback error:", e);
      setIsPlayingAudio(false);
      setMicError("Audio playback failed");
    }
  };

  const toggleListening = () => {
    setMicError(null);
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Initialize SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError("Browser not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event: any) => {
      setIsListening(false);
      // Suppress console errors for common issues to keep logs clean
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      
      console.warn("Speech recognition warning:", event.error);
      
      switch (event.error) {
        case 'not-allowed':
          setMicError("Mic permission denied");
          break;
        case 'network':
          setMicError("Network error");
          break;
        case 'audio-capture':
          setMicError("No mic found");
          break;
        default:
          setMicError("Voice input failed");
          break;
      }
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInputText(transcript);
        // Let's trigger send immediately for a fluid "Voice Mode" experience
        setTimeout(() => triggerSend(transcript), 100);
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setIsListening(false);
      setMicError("Mic busy, try again");
    }
  };

  const triggerSend = (text: string) => {
    // Helper to send message directly from voice input
    // We need to pass the text because state update might be async
    handleSendMessage(text);
  };

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim() || isLoading) return;

    // Stop any current audio
    stopAudio();

    const userMsg: Message = { role: 'user', text: textToSend, timestamp: Date.now() };
    
    setMessagesMap(prev => ({
      ...prev,
      [activeSessionId]: [...(prev[activeSessionId] || []), userMsg]
    }));
    
    setInputText('');
    setIsLoading(true);

    try {
      const responseText = await sendMessageToTutor(
        currentMessages,
        textToSend, 
        materials,
        activeSession.type,
        activeSession.name,
        isVoiceMode, // Pass voice mode flag
        userProfile // Pass user profile for personalization
      );
      
      const modelMsg: Message = { role: 'model', text: responseText, timestamp: Date.now() };
      setMessagesMap(prev => ({
        ...prev,
        [activeSessionId]: [...(prev[activeSessionId] || []), modelMsg]
      }));

      // If in voice mode, generate and play speech
      if (isVoiceMode) {
        try {
          const audioBase64 = await generateSpeech(responseText, userProfile.voice);
          playAudio(audioBase64);
        } catch (audioErr) {
          console.error("TTS generation failed:", audioErr);
          // Show a non-interrupting error for audio, but keep the text chat successful
          setMicError("Voice playback failed");
        }
      }

    } catch (error) {
      console.error("Message handling error:", error);
      setMessagesMap(prev => ({
        ...prev,
        [activeSessionId]: [...(prev[activeSessionId] || []), { role: 'model', text: "Sorry, I encountered an error. Please try again.", timestamp: Date.now() }]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Creation Logic ---

  const openCreateModal = (type: 'personal' | 'group') => {
    setCreateType(type);
    setNewItemName('');
    setIsCreating(true);
  };

  const submitCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newItemName.trim()) return;

    const name = newItemName.trim();
    if (createType === 'personal') {
      const newId = `s-${Date.now()}`;
      const newSession: ChatSession = { id: newId, name, type: 'personal' };
      setSessions(prev => [...prev, newSession]);
      setMessagesMap(prev => ({
        ...prev,
        [newId]: [{ role: 'model', text: `I am your ${name} tutor. What specifically in ${name} are we studying today?`, timestamp: Date.now() }]
      }));
      setActiveSessionId(newId);
    } else {
      const newId = `g-${Date.now()}`;
      const newSession: ChatSession = { id: newId, name, type: 'group', members: 1 };
      setSessions(prev => [...prev, newSession]);
      setMessagesMap(prev => ({
        ...prev,
        [newId]: [{ role: 'model', text: `Welcome to the ${name} group chat!`, timestamp: Date.now() }]
      }));
      setActiveSessionId(newId);
    }
    setIsCreating(false);
    setNewItemName('');
  };

  const handleRenameSession = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    // Keep using simple prompt for rename for now, or could implement inline edit similarly
    const newName = prompt("Rename subject:", session.name);
    if (newName && newName.trim()) {
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, name: newName.trim() } : s));
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (sessionId === 'general') {
      alert("Cannot delete the General session.");
      return;
    }
    
    if (confirm("Are you sure you want to delete this chat history? This cannot be undone.")) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setMessagesMap(prev => {
        const newMap = { ...prev };
        delete newMap[sessionId];
        return newMap;
      });
      if (activeSessionId === sessionId) {
        setActiveSessionId('general');
      }
    }
  };

  const personalSessions = sessions.filter(s => s.type === 'personal');
  const groupSessions = sessions.filter(s => s.type === 'group');

  return (
    <div className="flex h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative">
      
      {/* Create Modal */}
      {isCreating && (
        <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submitCreate} className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-gray-800 dark:text-white">
                 New {createType === 'personal' ? 'Subject' : 'Group'}
               </h3>
               <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
               >
                 <XIcon className="w-5 h-5" />
               </button>
            </div>
            <input
              autoFocus
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white mb-4"
              placeholder={createType === 'personal' ? "e.g., Biology 101" : "e.g., Exam Study Group"}
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={!newItemName.trim()}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sidebar / Group Selector */}
      <div className="w-16 sm:w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex flex-col">
         <div className="p-4 border-b border-gray-200 dark:border-gray-700">
           <h2 className="hidden sm:block font-bold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">Sessions</h2>
           <UsersIcon className="sm:hidden w-6 h-6 text-gray-500 mx-auto" />
         </div>
         <div className="flex-1 overflow-y-auto py-2 space-y-1">
            {/* Subjects Section */}
            <div className="mt-2 px-4 pb-1 hidden sm:block text-xs font-semibold text-gray-400 uppercase">Subjects</div>
            {personalSessions.map(session => (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer group relative ${activeSessionId === session.id ? 'bg-white dark:bg-gray-800 border-l-4 border-indigo-500 shadow-sm' : ''}`}
              >
                <div className={`p-1.5 rounded-lg ${activeSessionId === session.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                  <BookOpenIcon className="w-4 h-4" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1">{session.name}</span>
                
                {/* Actions: Always visible if active, otherwise hover */}
                {session.id !== 'general' && (
                    <div className={`hidden sm:flex items-center gap-1 transition-opacity ${activeSessionId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button 
                            onClick={(e) => handleRenameSession(e, session)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                            title="Rename"
                        >
                            <EditIcon className="w-3 h-3" />
                        </button>
                        <button 
                            onClick={(e) => handleDeleteSession(e, session.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-500 hover:text-red-500"
                            title="Delete"
                        >
                            <TrashIcon className="w-3 h-3" />
                        </button>
                    </div>
                )}
              </div>
            ))}
            
            {/* New Subject Button (Desktop & Mobile) */}
            <button 
              onClick={() => openCreateModal('personal')} 
              className="w-full px-4 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline hidden sm:block text-left mb-4"
            >
              + New Subject
            </button>
            <button 
              onClick={() => openCreateModal('personal')} 
              className="sm:hidden w-full flex justify-center py-2 text-indigo-600 dark:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="New Subject"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
            
            {/* Groups Section */}
            <div className="px-4 pb-1 hidden sm:block text-xs font-semibold text-gray-400 uppercase">Study Groups</div>
            {groupSessions.map(session => (
               <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer group relative ${activeSessionId === session.id ? 'bg-white dark:bg-gray-800 border-l-4 border-indigo-500 shadow-sm' : ''}`}
              >
                <div className={`p-1.5 rounded-lg ${activeSessionId === session.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                  <UsersIcon className="w-4 h-4" />
                </div>
                <div className="hidden sm:block text-left overflow-hidden flex-1">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{session.name}</div>
                  <div className="text-xs text-gray-400">{session.members} members</div>
                </div>

                {/* Actions */}
                <div className={`hidden sm:flex items-center gap-1 transition-opacity ${activeSessionId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button 
                        onClick={(e) => handleRenameSession(e, session)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                        title="Rename"
                    >
                        <EditIcon className="w-3 h-3" />
                    </button>
                    <button 
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-500 hover:text-red-500"
                        title="Delete"
                    >
                        <TrashIcon className="w-3 h-3" />
                    </button>
                </div>
              </div>
            ))}

            {/* New Group Button (Desktop & Mobile) */}
            <button 
                onClick={() => openCreateModal('group')} 
                className="w-full px-4 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline hidden sm:block text-left"
              >
                + New Group
            </button>
            <button 
              onClick={() => openCreateModal('group')} 
              className="sm:hidden w-full flex justify-center py-2 text-indigo-600 dark:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="New Group"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
         </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
             {activeSession.type === 'personal' ? <BookOpenIcon className="w-5 h-5 text-indigo-500" /> : <UsersIcon className="w-5 h-5 text-indigo-500" />}
             <div className="flex flex-col">
               <h2 className="font-semibold text-gray-800 dark:text-white truncate">
                 {activeSession.name}
               </h2>
               <div className="flex items-center gap-2">
                  {activeSession.type === 'personal' && <span className="text-xs text-gray-500 dark:text-gray-400">Personal Tutor</span>}
                  {isPlayingAudio && (
                    <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium animate-pulse">
                      <Volume2Icon className="w-3 h-3" /> Speaking...
                    </span>
                  )}
               </div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             {/* Voice Mode Toggle */}
             <button 
               onClick={() => {
                 setIsVoiceMode(!isVoiceMode);
                 // If turning off, stop any audio
                 if (isVoiceMode) stopAudio();
               }}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                 isVoiceMode 
                   ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900' 
                   : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
               }`}
             >
               {isVoiceMode ? <MicIcon className="w-3 h-3" /> : <Volume2Icon className="w-3 h-3 opacity-50" />}
               <span className="hidden sm:inline">Voice Mode {isVoiceMode ? 'ON' : 'OFF'}</span>
               <span className="sm:hidden">Voice</span>
             </button>
             <span className="hidden sm:inline-block text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
               ● {activeSession.type === 'personal' ? 'Online' : `${activeSession.members} Online`}
             </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                {msg.role === 'model' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                     <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className={`flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg border ${micError ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'} px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all relative`}>
            {/* Inline Error Message Tooltip */}
            {micError && (
              <div className="absolute -top-10 left-0 bg-red-100 dark:bg-red-900/80 text-red-600 dark:text-red-200 text-xs px-2 py-1 rounded shadow-sm animate-bounce">
                {micError}
                <div className="absolute bottom-[-4px] left-4 w-2 h-2 bg-red-100 dark:bg-red-900/80 rotate-45"></div>
              </div>
            )}
            
            <button
               onClick={toggleListening}
               className={`p-2 rounded-full transition-colors ${
                 isListening 
                   ? 'bg-red-500 text-white animate-pulse' 
                   : micError 
                     ? 'text-red-500 hover:text-red-600'
                     : 'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
               }`}
               title="Use Microphone"
            >
              <MicIcon className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (micError) setMicError(null); // Clear error on typing
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening 
                  ? "Listening..." 
                  : activeSession.type === 'personal' ? `Ask a question about ${activeSession.name}...` : `Message the ${activeSession.name} group...`
              }
              className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
              disabled={isLoading}
            />
            {isPlayingAudio && (
              <button 
                onClick={stopAudio}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                title="Stop Audio"
              >
                <StopCircleIcon className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-md transition-colors"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;