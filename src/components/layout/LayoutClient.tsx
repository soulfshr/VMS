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
      <Header />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
      <FeedbackWidget />
    </Providers>
  );
}
