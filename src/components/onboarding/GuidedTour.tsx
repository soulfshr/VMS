'use client';

import { useEffect, useRef, useCallback } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '@/styles/tour.css';
import { getTour, filterStepsForRole, type PageName } from '@/lib/tours';
import { hasSeenPageTour, markPageTourSeen } from '@/lib/onboarding';

interface GuidedTourProps {
  pageName: PageName;
  userRole: string;
  run?: boolean;
  onComplete?: () => void;
  autoStart?: boolean;
}

export default function GuidedTour({
  pageName,
  userRole,
  run = false,
  onComplete,
  autoStart = false,
}: GuidedTourProps) {
  const driverRef = useRef<Driver | null>(null);
  const hasStartedRef = useRef(false);

  const tour = getTour(pageName);
  const filteredSteps = tour ? filterStepsForRole(tour.steps, userRole) : [];

  // Convert our tour steps to driver.js format
  const driverSteps: DriveStep[] = filteredSteps.map(step => ({
    element: step.target,
    popover: {
      title: step.title,
      description: step.content,
      side: step.placement === 'left' ? 'left' :
            step.placement === 'right' ? 'right' :
            step.placement === 'top' ? 'top' : 'bottom',
      align: 'center' as const,
    },
  }));

  const startTour = useCallback(() => {
    if (driverSteps.length === 0) return;

    // Create driver instance with our configuration
    driverRef.current = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps: driverSteps,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'vms-tour-popover',
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      onDestroyStarted: () => {
        markPageTourSeen(pageName);
        onComplete?.();
        driverRef.current?.destroy();
      },
    });

    driverRef.current.drive();
  }, [driverSteps, pageName, onComplete]);

  // Handle external run trigger
  useEffect(() => {
    if (run && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [run, startTour]);

  // Handle auto-start on first visit
  useEffect(() => {
    if (autoStart && !hasSeenPageTour(pageName) && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Longer delay for auto-start to ensure page is fully loaded
      const timer = setTimeout(() => {
        startTour();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoStart, pageName, startTour]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  // Reset hasStarted when run changes to false
  useEffect(() => {
    if (!run) {
      hasStartedRef.current = false;
    }
  }, [run]);

  // This component doesn't render anything - driver.js manages its own DOM
  return null;
}
