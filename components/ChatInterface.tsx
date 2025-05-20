"use client";

import React, { useState, FormEvent, useRef } from 'react';
import { Paperclip } from 'lucide-react'; // Assuming lucide-react for icons

const ChatInterface: React.FC = () => {
  const [question, setQuestion] = useState<string>('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [response, setResponse] = useState<string>(''); // Retained for potential direct response display if needed outside conversation
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversation, setConversation] = useState<{ role: string; content: string; image?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageData(reader.result as string);
        // Optionally, add image preview to conversation or a temporary display
        // For now, we'll send it with the next message
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event?: FormEvent) => { // Made event optional for programmatic submission
    if (event) {
      event.preventDefault();
    }
    if (!question.trim() && !imageData) {
      // Allow sending just an image
      if(imageData && !question.trim()){
        // Create a generic message if only image is sent
        setConversation(prev => [...prev, { role: 'user', content: 'Uploaded an image', image: imageData }]);
      } else {
        alert('Please enter a question or upload an image.');
        return;
      }
    }

    setIsLoading(true);
    // Add user message to conversation
    const userMessageContent = question.trim() || (imageData ? "Uploaded an image" : "Empty message");
    const newConversationEntry: { role: string; content: string; image?: string } = { role: 'user', content: userMessageContent };
    if (imageData) {
      newConversationEntry.image = imageData;
    }
    setConversation(prev => [...prev, newConversationEntry]);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(), // Send trimmed question
          image_data: imageData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to get response');
      }

      const data = await res.json();
      setResponse(data.answer); // Retained, though primary display is conversation
      setConversation(prev => [...prev, { role: 'assistant', content: data.answer }]);
      setQuestion(''); 
      setImageData(null); 
      if(fileInputRef.current) { // Clear file input
        fileInputRef.current.value = "";
      }

    } catch (error: any) {
      const errorMessage = `Error: ${error.message}`;
      setResponse(errorMessage); // Retained
      setConversation(prev => [...prev, { role: 'assistant', content: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Allow Enter key to submit, Shift+Enter for new line
  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-800 text-white items-center p-4">
      <header className="w-full max-w-5xl mb-4">
        <h1 className="text-3xl font-semibold text-center text-cyan-400">RateMate</h1>
      </header>

      <main className="flex-grow w-full max-w-5xl overflow-y-auto bg-neutral-700 rounded-xl p-4 space-y-4 mb-4">
        {conversation.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col p-3 rounded-xl shadow ${
              msg.role === 'user' 
                ? 'bg-cyan-600 text-white self-end ml-10' 
                : 'bg-neutral-600 text-neutral-100 self-start mr-10'
            }`}
            style={{ maxWidth: '80%'}}
          >
            <strong className="text-sm mb-1">{msg.role === 'user' ? 'You' : 'RateMate Assistant'}</strong>
            {msg.image && <img src={msg.image} alt="Uploaded content" className="max-w-xs max-h-48 rounded-md my-2" />}
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {isLoading && conversation.length > 0 && conversation[conversation.length -1].role === 'user' && (
          <div className="self-start p-3 rounded-xl shadow bg-neutral-600 text-neutral-100 mr-10" style={{ maxWidth: '80%'}}>
            <strong className="text-sm mb-1">RateMate Assistant</strong>
            <p className="whitespace-pre-wrap">Thinking...</p>
          </div>
        )}
      </main>

      <footer className="w-full max-w-5xl p-1">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 bg-neutral-700 p-3 rounded-xl shadow-md">
          <button
            type="button"
            onClick={triggerFileInput}
            className="p-2 text-neutral-400 hover:text-cyan-400 focus:outline-none"
            aria-label="Attach file"
          >
            <Paperclip size={24} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            id="image-upload"
            accept=".png, .jpg, .jpeg, .pdf, .txt, .md" // Expanded accepted file types
            onChange={handleImageUpload}
            className="hidden" // Hidden, triggered by the button
          />
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={1} // Start with 1 row, expands automatically
            placeholder="Ask RateMate..."
            className="flex-grow resize-none overflow-y-auto max-h-28 bg-neutral-600 text-white rounded-xl p-3 border border-neutral-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide scrollbar
          />
          <button
            type="submit"
            disabled={isLoading || (!question.trim() && !imageData)}
            className="p-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-500 disabled:cursor-not-allowed text-white focus:outline-none"
            aria-label="Send message"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send-horizontal"><path d="m3 3 3 9-3 9 19-9Z"/><path d="M6 12h16"/></svg>
            )}
          </button>
        </form>
        {imageData && (
          <div className="mt-2 text-sm text-neutral-400">
            Image selected: {fileInputRef.current?.files?.[0]?.name}. It will be sent with your next message.
          </div>
        )}
      </footer>
    </div>
  );
};

export default ChatInterface; 