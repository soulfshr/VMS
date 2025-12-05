'use client';

import { useState, useEffect } from 'react';
import { markWelcomeSeen, hasSeenWelcome } from '@/lib/onboarding';

interface WelcomeScreenProps {
  userName: string;
  userRole: 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR';
  onComplete: () => void;
}

interface Slide {
  title: string;
  description: string;
  icon: React.ReactNode;
  features?: string[];
}

const volunteerSlides: Slide[] = [
  {
    title: 'Welcome to RippleVMS!',
    description: 'Thank you for joining our volunteer community. Together, we make a difference through organized response and coordination.',
    icon: (
      <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center">
        <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
    ),
  },
  {
    title: 'Your Dashboard',
    description: 'Your home base for everything volunteer-related. Track your shifts, monitor your training progress, and stay connected.',
    icon: (
      <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      </div>
    ),
    features: [
      'See your upcoming shifts at a glance',
      'Track hours and training progress',
      'Quick access to sign up for new shifts',
    ],
  },
  {
    title: 'Getting Started',
    description: 'Here\'s how to begin your volunteer journey:',
    icon: (
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    features: [
      '1. Complete your required training modules',
      '2. Set your weekly availability in your profile',
      '3. Browse and sign up for available shifts',
    ],
  },
];

const coordinatorSlide: Slide = {
  title: 'Coordinator Tools',
  description: 'As a coordinator, you have additional tools to manage volunteers and shifts.',
  icon: (
    <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
      <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </div>
  ),
  features: [
    'Monitor weekly coverage on the Schedule page',
    'Review and confirm volunteer RSVPs',
    'Create and manage shifts',
    'Access the volunteer directory',
  ],
};

const adminSlide: Slide = {
  title: 'Admin Controls',
  description: 'As an administrator, you have full system access.',
  icon: (
    <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
      <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  ),
  features: [
    'Manage zones and shift types',
    'Configure RSVP settings (auto-confirm vs manual)',
    'Assign roles and qualifications to volunteers',
  ],
};

function getSlides(role: string): Slide[] {
  const slides = [...volunteerSlides];
  if (role === 'COORDINATOR' || role === 'ADMINISTRATOR') {
    slides.push(coordinatorSlide);
  }
  if (role === 'ADMINISTRATOR') {
    slides.push(adminSlide);
  }
  return slides;
}

export default function WelcomeScreen({ userName, userRole, onComplete }: WelcomeScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const slides = getSlides(userRole);

  useEffect(() => {
    // Check if user has already seen welcome
    if (!hasSeenWelcome()) {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentSlide(currentSlide + 1);
        setIsAnimating(false);
      }, 150);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentSlide(currentSlide - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleComplete = () => {
    markWelcomeSeen();
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isVisible) return null;

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 flex items-center justify-center">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Content card */}
      <div className="relative w-full max-w-lg mx-4">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute -top-12 right-0 text-white/70 hover:text-white text-sm font-medium transition-colors"
        >
          Skip
        </button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Greeting header */}
          <div className="bg-gray-50 px-8 py-4 border-b border-gray-100">
            <p className="text-gray-600 text-sm">
              Hello, <span className="font-medium text-gray-900">{userName}</span>!
            </p>
          </div>

          {/* Slide content */}
          <div className={`px-8 py-10 text-center transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            {/* Icon */}
            <div className="flex justify-center mb-6">
              {slide.icon}
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {slide.title}
            </h2>

            {/* Description */}
            <p className="text-gray-600 mb-6">
              {slide.description}
            </p>

            {/* Features list */}
            {slide.features && (
              <ul className="text-left space-y-3 mb-6">
                {slide.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-700">
                    <svg className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Navigation */}
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
            {/* Progress dots */}
            <div className="flex justify-center gap-2 mb-6">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentSlide ? 'bg-teal-600' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {currentSlide > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-3 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                {isLastSlide ? "Let's Go!" : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
