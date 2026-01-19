import { GoogleGenAI, Type, Content, Modality } from "@google/genai";
import { Message, QuizData, StudyMaterial, UserProfile } from "../types";

// Initialize Gemini AI
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Sends a message to the Gemini model.
 */
export const sendMessageToTutor = async (
  history: Message[],
  newMessage: string,
  materials: StudyMaterial[],
  context: 'personal' | 'group' = 'personal',
  subjectName: string = 'General',
  isVoiceMode: boolean = false,
  userProfile?: UserProfile
): Promise<string> => {
  try {
    const contents: Content[] = [];

    let systemPrompt = context === 'personal' 
      ? `You are a helpful and knowledgeable Study Tutor specializing in ${subjectName}. Use the provided study materials to answer the student's questions regarding ${subjectName}.`
      : `You are a collaborative AI Tutor in a Study Group named "${subjectName}". Facilitate discussion, answer questions for the group, and encourage peer learning.`;

    if (userProfile) {
      systemPrompt += `\n\nStudent Profile Context:
      - Name: ${userProfile.name}
      - Preferred Learning Style: ${userProfile.learningStyle}
      - Difficulty Level: ${userProfile.difficultyLevel}
      
      Please adapt your explanations to match this profile. For ${userProfile.learningStyle} learners, describe concepts accordingly (e.g., visual analogies for Visual learners). Adjust complexity to the ${userProfile.difficultyLevel} level.`;
    }

    if (isVoiceMode) {
      systemPrompt += " The user is communicating via voice. Keep your responses concise, conversational, and easy to listen to. Use shorter sentences and avoid complex formatting like markdown tables or long lists. Focus on clarity and spoken comprehension.";
    }

    const contextParts: any[] = [{ text: systemPrompt }];

    materials.forEach(mat => {
      if (mat.type === 'text' && mat.content.trim()) {
        contextParts.push({ text: `\n[Study Notes]:\n${mat.content}\n` });
      } else if (mat.type === 'pdf' && mat.content) {
        contextParts.push({ text: `\n[Reference PDF: ${mat.name}]\n` });
        contextParts.push({
          inlineData: {
            mimeType: mat.mimeType || 'application/pdf',
            data: mat.content
          }
        });
      }
    });

    const historyContents: Content[] = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    
    const currentParts: any[] = [];
    
    if (materials.length > 0) {
      currentParts.push({ text: "Here are my current study materials/context:\n" });
      currentParts.push(...contextParts);
      currentParts.push({ text: "\nMy Question/Message:\n" });
    }
    
    currentParts.push({ text: newMessage });

    const finalContents = [
      ...historyContents,
      { role: 'user', parts: currentParts }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: finalContents,
      config: {
        systemInstruction: "You are an expert tutor. Be concise, encouraging, and clear.",
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw new Error("Failed to get response from Tutor.");
  }
};

/**
 * Generates speech from text using Gemini TTS.
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("No audio data received from Gemini TTS.");
    }
    return audioData;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw new Error("Failed to generate speech.");
  }
};

/**
 * Generates a summary for a study material.
 */
export const summarizeMaterial = async (material: StudyMaterial): Promise<string> => {
  try {
    const parts: any[] = [
      { text: "Please provide a concise, bulleted summary of the following study material. Capture the key concepts and important details." }
    ];

    if (material.type === 'text') {
      parts.push({ text: material.content });
    } else {
      parts.push({
        inlineData: {
          mimeType: material.mimeType || 'application/pdf',
          data: material.content
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts }],
    });

    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Summarization Error:", error);
    throw new Error("Failed to generate summary.");
  }
};

/**
 * Generates a quiz based on materials, optionally focusing on weak topics or specific subjects.
 */
export const generateQuizFromMaterials = async (
  materials: StudyMaterial[], 
  weakTopics: string[] = [],
  focusTopic?: string,
  subject?: string
): Promise<QuizData> => {
  try {
    if (materials.length === 0 || (materials.every(m => !m.content))) {
       throw new Error("Please add some notes or upload a PDF to generate a quiz.");
    }

    let promptText = "Generate a quiz with 5 multiple-choice questions based strictly on the following study materials.";
    
    if (subject && subject !== 'General' && subject !== 'General / Any') {
      promptText += `\nIMPORTANT: The questions must be within the subject/field of: "${subject}".`;
    }

    if (focusTopic && focusTopic.trim()) {
      promptText += `\nIMPORTANT: Focus specifically on the sub-topic or concept: "${focusTopic}". Ensure all questions relate to this.`;
    }

    if (weakTopics.length > 0) {
      promptText += `\nIMPORTANT: The student is struggling with the following topics: ${weakTopics.join(', ')}. Please prioritize questions related to these topics to help with spaced repetition learning.`;
    }

    const parts: any[] = [{ text: promptText }];

    materials.forEach(mat => {
      if (mat.type === 'text' && mat.content.trim()) {
        parts.push({ text: `\n[Notes]: ${mat.content}\n` });
      } else if (mat.type === 'pdf' && mat.content) {
        parts.push({
          inlineData: {
            mimeType: mat.mimeType || 'application/pdf',
            data: mat.content
          }
        });
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A creative title for the quiz" },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswerIndex: { type: Type.INTEGER, description: "Zero-based index of the correct option" },
                  explanation: { type: Type.STRING, description: "Brief explanation of why the answer is correct" },
                  topic: { type: Type.STRING, description: "The specific topic or concept this question tests (e.g., 'Thermodynamics', 'Variables')" }
                },
                required: ["id", "question", "options", "correctAnswerIndex", "explanation", "topic"]
              }
            }
          },
          required: ["title", "questions"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data returned");
    
    return JSON.parse(text) as QuizData;

  } catch (error) {
    console.error("Gemini Quiz Error:", error);
    throw error;
  }
};
