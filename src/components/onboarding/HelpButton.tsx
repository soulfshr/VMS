'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import HelpDrawer from './HelpDrawer';

interface HelpButtonProps {
  userRole: string;
  onRestartWelcome: () => void;
  onStartTour?: () => void;
}

function getPageName(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/') return 'dashboard';
  if (pathname.startsWith('/shifts')) return 'shifts';
  if (pathname.startsWith('/schedule')) return 'schedule';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/volunteers')) return 'volunteers';
  if (pathname.startsWith('/trainings')) return 'trainings';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'default';
}

export default function HelpButton({ userRole, onRestartWelcome, onStartTour }: HelpButtonProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();
  const currentPage = getPageName(pathname);

  return (
    <>
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Help"
        title="Help"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <HelpDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentPage={currentPage}
        userRole={userRole}
        onStartTour={onStartTour}
        onRestartWelcome={onRestartWelcome}
      />
    </>
  );
}
