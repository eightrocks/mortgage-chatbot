import React from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Metadata } from 'next';

// Metadata for the page (replaces next/head)
export const metadata: Metadata = {
  title: 'RateMate',
  description: 'AI Assistant for mortgage-related questions',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-neutral-900 text-neutral-100">
      <div className="w-full h-full px-4">
        <ChatInterface />
      </div>
    </div>
  );
}
