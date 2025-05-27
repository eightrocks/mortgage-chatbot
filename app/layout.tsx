import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RateMate - AI Mortgage Assistant",
  description: "Your AI assistant for mortgage-related questions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans text-base bg-neutral-950 antialiased`}
      >
        <main className="min-h-screen flex flex-col items-center p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
