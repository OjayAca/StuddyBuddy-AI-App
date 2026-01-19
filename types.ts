
export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  topic: string; // New field for Spaced Repetition
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

export interface QuizResult {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  date: number;
  topic?: string;
}

export interface StudyMaterial {
  id: string; // Added ID for easier updates
  type: 'text' | 'pdf';
  content: string; // Text content or base64 string
  name?: string;
  mimeType?: string;
  summary?: string; // New field for Summarization
  isSummarizing?: boolean; // UI state
}

export interface ChatSession {
  id: string;
  name: string;
  type: 'personal' | 'group';
  members?: number;
}

export interface ChatState {
  history: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface UserProfile {
  name: string;
  learningStyle: 'Visual' | 'Auditory' | 'Reading/Writing' | 'Kinesthetic';
  difficultyLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  notifications: boolean;
}
