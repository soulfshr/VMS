'use client';

import { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import Header from './Header';
import Footer from './Footer';
import FeedbackWidget from '@/components/FeedbackWidget';

interface LayoutClientProps {
  children: ReactNode;
}

export default function LayoutClient({ children }: LayoutClientProps) {
  return (
    <Providers>
      {/* Skip to main content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-cyan-500 focus:text-cyan-700 focus:font-medium"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-grow" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <FeedbackWidget />
    </Providers>
  );
}
