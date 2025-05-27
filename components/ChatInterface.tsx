"use client";

import React, { useState, FormEvent, useRef, useEffect } from 'react';
import { Paperclip } from 'lucide-react'; // Assuming lucide-react for icons

const COOLDOWN_DURATION = 3; // Cooldown in seconds

const ChatInterface: React.FC = () => {
  const [question, setQuestion] = useState<string>('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [response, setResponse] = useState<string>(''); // Retained for potential direct response display if needed outside conversation
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversation, setConversation] = useState<{ role: string; content: string; image?: string }[]>([]);
  const [cooldown, setCooldown] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cooldown]);

  const startCooldown = () => {
    setCooldown(COOLDOWN_DURATION);
  };

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

    if (cooldown > 0) {
      return; // Don't allow submission during cooldown
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
    startCooldown(); // Start cooldown when message is sent

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
          question: question.trim(),
          image_data: imageData,
        }),
      });

      if (!res.ok) {
        let errorPayload;
        let errorText = await res.text(); // Get raw response text first
        try {
          errorPayload = JSON.parse(errorText); // Try to parse it as JSON
        } catch (e) {
          // If JSON parsing fails, the response body might not be JSON or is malformed
          console.error("API Error: Failed to parse JSON response. Status:", res.status, "Body:", errorText);
          throw new Error(`API Error: ${res.status} ${res.statusText}. Response body not valid JSON.`);
        }
        console.error("API Error Status:", res.status);
        console.error("API Error Payload:", errorPayload); 
        throw new Error(errorPayload?.detail || `Failed to get response from API (Status: ${res.status}, Body: ${JSON.stringify(errorPayload)})`);
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
      const errorMessage = error.message.startsWith('API Error:') || error.message.startsWith('Failed to get response from API') 
        ? error.message 
        : `Error: ${error.message}`;
      console.error("handleSubmit caught error:", error); // Log the full error object
      setResponse(errorMessage);
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
    <div className="flex flex-col h-screen max-w-screen-2xl mx-auto">
      <header className="w-full py-6">
        <h1 className="text-3xl font-semibold text-center text-cyan-400">RateMate</h1>
      </header>

      <main className="flex-grow w-full overflow-y-auto bg-neutral-700 rounded-xl px-6 md:px-8 lg:px-12 py-6 space-y-4 mb-4">
        {conversation.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col p-4 rounded-xl shadow ${
              msg.role === 'user' 
                ? 'bg-cyan-600 text-white self-end ml-8 md:ml-16 lg:ml-24' 
                : 'bg-neutral-600 text-neutral-100 self-start mr-8 md:mr-16 lg:mr-24'
            }`}
            style={{ maxWidth: '90%'}}
          >
            <strong className="text-sm mb-1">{msg.role === 'user' ? 'You' : 'RateMate Assistant'}</strong>
            {msg.image && <img src={msg.image} alt="Uploaded content" className="max-w-lg max-h-48 rounded-md my-2" />}
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {isLoading && conversation.length > 0 && conversation[conversation.length -1].role === 'user' && (
          <div className="self-start p-4 rounded-xl shadow bg-neutral-600 text-neutral-100 mr-8 md:mr-16 lg:mr-24" style={{ maxWidth: '90%'}}>
            <strong className="text-sm mb-1">RateMate Assistant</strong>
            <p className="whitespace-pre-wrap">Thinking...</p>
          </div>
        )}
      </main>

      <footer className="w-full pb-6 px-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3 bg-neutral-700 p-4 rounded-xl shadow-md">
          <button
            type="button"
            onClick={triggerFileInput}
            className="p-2 text-neutral-400 hover:text-cyan-400 focus:outline-none"
            aria-label="Attach file"
            disabled={cooldown > 0}
          >
            <Paperclip size={24} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            id="image-upload"
            accept=".png, .jpg, .jpeg, .pdf, .txt, .md"
            onChange={handleImageUpload}
            className="hidden"
            disabled={cooldown > 0}
          />
          <div className="relative flex-grow">
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={1}
              placeholder={cooldown > 0 ? `Wait ${cooldown}s before sending...` : "Ask RateMate..."}
              className="flex-grow resize-none overflow-y-auto max-h-32 bg-neutral-600 text-white rounded-xl p-4 border border-neutral-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 w-full"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              disabled={cooldown > 0}
            />
            {cooldown > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
                {cooldown}s
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || cooldown > 0}
            className="p-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white focus:outline-none"
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
