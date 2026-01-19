import React, { ChangeEvent, useState } from 'react';
import { StudyMaterial } from '../types';
import { UploadIcon, FileTextIcon, TrashIcon, SparklesIcon, SearchIcon, XIcon } from './Icons';
import { summarizeMaterial } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface StudyMaterialsProps {
  materials: StudyMaterial[];
  setMaterials: React.Dispatch<React.SetStateAction<StudyMaterial[]>>;
}

// Helper for environments where crypto.randomUUID might not be available (e.g. non-secure contexts)
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const StudyMaterials: React.FC<StudyMaterialsProps> = ({ materials, setMaterials }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter materials based on search query
  const filteredMaterials = materials.filter(m => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = m.name?.toLowerCase().includes(query) || false;
    // For text materials, searching content is useful.
    const contentMatch = m.type === 'text' && m.content.toLowerCase().includes(query);
    const summaryMatch = m.summary?.toLowerCase().includes(query) || false;

    return nameMatch || contentMatch || summaryMatch;
  });

  const notesMaterial = filteredMaterials.find(m => m.type === 'text');
  const pdfMaterials = filteredMaterials.filter(m => m.type === 'pdf');
  
  // Determine if we should show the notes section.
  // Show if there is no search query (default view) OR if the notes matched the search.
  // If we search and notes don't match, we hide it to properly "filter".
  const showNotes = !searchQuery.trim() || !!notesMaterial;
  
  // To allow editing even when searching, we need the actual reference from state if it exists,
  // but if we are filtering, we might only have the filtered one. 
  // However, handleNotesChange updates the global state, so we just need the content to display.
  // If filtered out, showNotes is false, so we don't render.
  
  const handleNotesChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setMaterials(prev => {
      const others = prev.filter(m => m.type !== 'text');
      const existing = prev.find(m => m.type === 'text');
      return [...others, { 
        type: 'text', 
        content: newText, 
        id: existing?.id || generateId(),
        summary: existing?.summary 
      }];
    });
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      const newPdf: StudyMaterial = {
        id: generateId(),
        type: 'pdf',
        content: base64String,
        name: file.name,
        mimeType: 'application/pdf'
      };
      setMaterials(prev => [...prev, newPdf]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removePdf = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleSummarize = async (material: StudyMaterial) => {
    setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, isSummarizing: true } : m));
    
    try {
      const summary = await summarizeMaterial(material);
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, summary, isSummarizing: false } : m));
    } catch (error) {
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, isSummarizing: false } : m));
      alert("Failed to summarize content.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <FileTextIcon className="w-5 h-5 text-indigo-500" />
            Study Materials
            </h2>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
            <input 
                type="text" 
                placeholder="Search materials..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white placeholder-gray-400"
            />
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery && (
                <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full"
                >
                    <XIcon className="w-3 h-3" />
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* PDF Upload Section */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">PDF Documents</h3>
            <label className="cursor-pointer flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              <UploadIcon className="w-3 h-3" />
              Upload PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          
          <div className="space-y-4">
            {pdfMaterials.length === 0 && (
              <div className="text-sm text-gray-400 italic text-center py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                {searchQuery ? 'No matching PDFs found.' : 'No PDFs uploaded yet.'}
              </div>
            )}
            {pdfMaterials.map((pdf) => (
              <div key={pdf.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                      <FileTextIcon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[150px]">{pdf.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleSummarize(pdf)}
                      disabled={pdf.isSummarizing}
                      className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                      <SparklesIcon className="w-3 h-3" />
                      {pdf.isSummarizing ? 'Thinking...' : 'Summarize'}
                    </button>
                    <button 
                      onClick={() => removePdf(pdf.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {pdf.summary && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-md text-xs text-gray-700 dark:text-gray-300 border border-indigo-100 dark:border-indigo-800">
                      <div className="font-semibold mb-1 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" /> AI Summary
                      </div>
                      <div className="prose prose-xs dark:prose-invert max-w-none">
                        <ReactMarkdown>
                          {pdf.summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Notes Section */}
        {showNotes && (
            <section className="flex flex-col h-[60%]">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Notes / Scratchpad</h3>
                {notesMaterial?.content && (
                    <button 
                    onClick={() => handleSummarize(notesMaterial)}
                    disabled={notesMaterial.isSummarizing}
                    className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                    <SparklesIcon className="w-3 h-3" />
                    {notesMaterial.isSummarizing ? 'Thinking...' : 'Summarize'}
                    </button>
                )}
            </div>
            
            <div className="flex-1 flex flex-col gap-2">
                <textarea
                className="flex-1 w-full p-4 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-all dark:text-gray-200 placeholder-gray-400"
                placeholder="Paste your study notes here..."
                // Use the content from the filtered material (if found) OR fallback to empty string.
                // Note: If showNotes is true but notesMaterial is undefined (happens if no search query AND no notes exist yet),
                // we pass empty string so user can start typing.
                value={notesMaterial?.content || ''}
                onChange={handleNotesChange}
                />
                {notesMaterial?.summary && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-xs text-gray-700 dark:text-gray-300 border border-indigo-100 dark:border-indigo-800 max-h-[150px] overflow-y-auto">
                    <div className="font-semibold mb-1 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" /> AI Summary
                    </div>
                    <div className="prose prose-xs dark:prose-invert max-w-none">
                        <ReactMarkdown>
                            {notesMaterial.summary}
                        </ReactMarkdown>
                    </div>
                    </div>
                )}
            </div>
            </section>
        )}
      </div>
    </div>
  );
};

export default StudyMaterials;