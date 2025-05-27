'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachments?: File[];
}

const initialMessage = {
  role: 'assistant' as const,
  content: `👋 Hi! I'm RateMate, your AI mortgage assistant. I can help with:

• Mortgage rates and trends
• Loan qualifications
• Payment calculations
• Refinancing options
• Document reviews (PDF, DOC, TXT)

What would you like to know about mortgages?`
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showFileTooltip, setShowFileTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check system preference on initial load
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    // Update document class when theme changes
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Filter for supported file types
      const supportedFiles = files.filter(file => {
        const type = file.type.toLowerCase();
        return type.includes('pdf') || 
               type.includes('doc') || 
               type.includes('docx') || 
               type.includes('txt');
      });
      
      if (supportedFiles.length !== files.length) {
        alert('Some files were not added. Only PDF, DOC, DOCX, and TXT files are supported.');
      }
      
      setAttachments(prev => [...prev, ...supportedFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessageContent = input.trim();
    const currentAttachments = [...attachments]; // Keep the File objects for the message state

    setInput('');
    setAttachments([]); // Clear the separate input attachments state
    setIsLoading(true);

    // Add user message to UI, keeping original File objects in attachments
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessageContent,
      attachments: currentAttachments 
    }]);

    let image_data_b64: string | null = null;

    if (currentAttachments.length > 0) {
      // For sending to backend, process the first file into a base64 string
      // The original File object remains in the `messages` state for local UI
      const fileToProcess = currentAttachments[0]; 
      try {
        image_data_b64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileToProcess);
        });
      } catch (error) {
        console.error("Error reading file for image_data:", error);
        // Decide if you want to proceed without image_data or show an error
      }
    }

    try {
      const requestBody = {
        question: userMessageContent,
        image_data: image_data_b64, // Send base64 string
        // If you want to send conversation_history, you'll need to decide how to represent attachments there.
        // For example, you might omit them or just send file names from the `messages` state.
        // conversation_history: prevMessages.map(msg => ({ 
        //   role: msg.role,
        //   content: msg.content,
        //   // attachments: msg.attachments?.map(f => f.name) // Example: send only names
        // }))
      };

      const response = await fetch('/api/ask', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorDetail = 'Failed to get response from server';
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || JSON.stringify(errorData);
        } catch (jsonError) {
            errorDetail = await response.text() || response.statusText || 'Unknown server error';
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();
      // Add assistant message to UI
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`chat-container ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="chat-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">RateMate</h1>
            <p>Your AI mortgage assistant</p>
          </div>
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
          >
            {isDarkMode ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="avatar">
              {message.role === 'assistant' ? 'AI' : 'U'}
            </div>
            <div className="message-content">
              {message.content}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((file, fileIndex) => (
                    <div key={fileIndex} className="flex items-center gap-2 text-sm text-neutral-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span>{file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="avatar">AI</div>
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <div className="flex-1 flex flex-col gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your mortgage question here..."
              className="chat-input"
              disabled={isLoading}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 bg-neutral-800 px-3 py-1 rounded-full text-sm">
                    <span className="text-neutral-400">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-neutral-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.txt"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setShowFileTooltip(true)}
                onMouseLeave={() => setShowFileTooltip(false)}
                className="p-2 text-neutral-400 hover:text-white"
                disabled={isLoading}
                aria-label="Upload files"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              {showFileTooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-800 text-white text-sm rounded-lg shadow-lg whitespace-nowrap">
                  Upload PDF, DOC, DOCX, or TXT files
                </div>
              )}
            </div>
            <button 
              type="submit" 
              className="send-button"
              disabled={isLoading || (!input.trim() && attachments.length === 0)}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
