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
    <main className="flex min-h-screen flex-col items-center justify-center p-0 bg-neutral-900 text-neutral-100">
      {/* The main title for the page is now handled by the ChatInterface component itself */}
      {/* and the browser tab title by the metadata object above. */}
      <ChatInterface />
      {/* Footer can be added back here if needed, e.g.: */}
      {/* <footer className="w-full text-center text-sm text-neutral-500 py-4">
        <p>Powered by Next.js and Vercel</p>
      </footer> */}
    </main>
  );
}
