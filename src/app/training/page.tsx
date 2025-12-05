'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';
import GuidedTour from '@/components/onboarding/GuidedTour';

const SAMPLE_TRAININGS = [
  {
    id: '1',
    name: 'Volunteer Orientation',
    description: 'Introduction to the organization mission, policies, and procedures',
    duration: '45 min',
    status: 'COMPLETED',
    completedAt: 'Nov 15, 2025',
  },
  {
    id: '2',
    name: 'Safety & De-escalation',
    description: 'Personal safety protocols and de-escalation techniques',
    duration: '60 min',
    status: 'COMPLETED',
    completedAt: 'Nov 18, 2025',
  },
  {
    id: '3',
    name: 'Documentation & Reporting',
    description: 'How to properly document and report incidents',
    duration: '30 min',
    status: 'COMPLETED',
    completedAt: 'Nov 20, 2025',
  },
  {
    id: '4',
    name: 'Know Your Rights',
    description: 'Legal rights and resources for community members',
    duration: '45 min',
    status: 'COMPLETED',
    completedAt: 'Nov 22, 2025',
  },
  {
    id: '5',
    name: 'Advanced Field Operations',
    description: 'Advanced techniques for experienced volunteers',
    duration: '90 min',
    status: 'NOT_STARTED',
    isOptional: true,
  },
];

export default function TrainingPage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else {
          setUser(data.user);
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const completedCount = SAMPLE_TRAININGS.filter(t => t.status === 'COMPLETED').length;
  const requiredCount = SAMPLE_TRAININGS.filter(t => !('isOptional' in t) || !t.isOptional).length;

  return (
    <>
      {/* Guided Tour */}
      {user && (
        <GuidedTour
          pageName="trainings"
          userRole={user.role}
          autoStart={true}
        />
      )}

    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training</h1>
          <p className="text-gray-600">Complete required training modules to become an active volunteer</p>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8" data-tour="training-progress">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Your Progress</h2>
            <span className="text-2xl font-bold text-teal-600">
              {completedCount}/{requiredCount}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / requiredCount) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {completedCount === requiredCount
              ? 'All required training completed!'
              : `${requiredCount - completedCount} required modules remaining`}
          </p>
        </div>

        {/* Training Modules */}
        <div className="space-y-4" data-tour="training-list">
          {SAMPLE_TRAININGS.map((training) => (
            <div
              key={training.id}
              className={`bg-white rounded-xl border p-5 ${
                training.status === 'COMPLETED'
                  ? 'border-teal-200'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    training.status === 'COMPLETED'
                      ? 'bg-teal-100 text-teal-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {training.status === 'COMPLETED' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{training.name}</h3>
                      {'isOptional' in training && training.isOptional && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{training.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Duration: {training.duration}</span>
                      {'completedAt' in training && training.completedAt && (
                        <span>Completed: {training.completedAt}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="flex-shrink-0">
                  {training.status === 'COMPLETED' ? (
                    <span className="text-teal-600 text-sm font-medium">Completed</span>
                  ) : (
                    <button className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors">
                      Start
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Development Notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">
            <strong>Development Preview:</strong> Training modules are displayed with sample data. Full training functionality will be implemented in a future phase.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
