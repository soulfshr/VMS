'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useFeatures } from '@/hooks/useFeatures';

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <Image
          src="/howdoyoudo.jpg"
          alt="How do you do, fellow Anti-ICE?"
          width={500}
          height={375}
          className="w-full"
          priority
        />

        <div className="p-6 text-center bg-gradient-to-b from-white to-gray-50">
          <p className="text-gray-600 italic mb-4">
            New volunteers welcome - no skateboard required
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Join the Movement
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomeClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const features = useFeatures();
  const [showModal, setShowModal] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.replace('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    // Only show welcome modal for non-authenticated users
    if (status === 'unauthenticated') {
      const hasSeenModal = localStorage.getItem('vms_hasSeenWelcomeModal');
      if (!hasSeenModal) {
        const timer = setTimeout(() => {
          setShowModal(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [status]);

  // Show loading state while checking auth or redirecting
  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleCloseModal = () => {
    setShowModal(false);
    localStorage.setItem('vms_hasSeenWelcomeModal', 'true');
  };

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Welcome Modal */}
      {showModal && <WelcomeModal onClose={handleCloseModal} />}

      {/* ICE Sighting Report Banner - only shown when sightings feature is enabled */}
      {features.sightings && (
        <div className="bg-yellow-400 text-yellow-900">
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm sm:text-base font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Report ICE sightings to the 24/7 hotline: <a href="tel:336-543-0353" className="font-bold hover:underline">336-543-0353</a></span>
            </div>
            <Link
              href="/report"
              className="px-4 py-2 bg-yellow-900 text-yellow-100 font-semibold rounded-lg hover:bg-yellow-800 transition-colors text-sm"
            >
              Submit Online Report
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section - Split Layout */}
      {/* Logo on white background */}
      <section className="bg-white py-10">
        <div className="container mx-auto px-4 flex justify-center">
          <Image
            src="/ripple-logo.png"
            alt="RippleVMS - Volunteer Management System"
            width={280}
            height={232}
            priority
          />
        </div>
      </section>

      {/* Tagline on blue gradient */}
      <section className="bg-gradient-to-br from-cyan-600 to-cyan-800 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-xl md:text-2xl font-medium text-cyan-100 mb-6 max-w-2xl mx-auto">
            Coordinating community volunteers to monitor, document, and respond to immigration enforcement activities in North Carolina&apos;s Triangle region.
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-white text-cyan-700 font-semibold rounded-lg hover:bg-cyan-50 transition-colors shadow-lg"
            >
              Login
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 bg-cyan-700 text-white font-semibold rounded-lg hover:bg-cyan-900 transition-colors border border-cyan-500"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* How to Get Involved Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How to Get Involved
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Create an Account
              </h3>
              <p className="text-gray-600">
                Sign up with your email and complete the volunteer registration form with your background information and availability.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Complete Training
              </h3>
              <p className="text-gray-600">
                Finish required training modules to learn protocols, safety guidelines, and reporting procedures.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Sign Up for Shifts
              </h3>
              <p className="text-gray-600">
                Browse available shifts that match your schedule and preferences, then sign up to volunteer in your community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            What We Do
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Patrol */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Zone Patrol</h3>
                <p className="text-sm text-gray-600">
                  Active monitoring of assigned zones in the Triangle area to observe and document activity.
                </p>
              </div>
            </div>

            {/* Intel Collection - Future Feature */}
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-lg border border-gray-200 opacity-60">
              <div className="w-10 h-10 bg-gray-200 text-gray-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-500 mb-1">Intel Collection <span className="text-xs font-normal text-gray-400">(Coming Soon)</span></h3>
                <p className="text-sm text-gray-400">
                  Monitor social media channels and community networks to identify and verify reports.
                </p>
              </div>
            </div>

            {/* Field Response */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">On-Call Response</h3>
                <p className="text-sm text-gray-600">
                  Available for rapid dispatch to verify sightings and provide on-the-ground support.
                </p>
              </div>
            </div>

            {/* Community Alerts - Future Feature */}
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-lg border border-gray-200 opacity-60">
              <div className="w-10 h-10 bg-gray-200 text-gray-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-500 mb-1">Community Alerts <span className="text-xs font-normal text-gray-400">(Coming Soon)</span></h3>
                <p className="text-sm text-gray-400">
                  Timely alerts to keep the community informed about relevant activity.
                </p>
              </div>
            </div>

            {/* Coordination */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Team Coordination</h3>
                <p className="text-sm text-gray-600">
                  Zone-based teams coordinate via Signal for real-time, encrypted communication.
                </p>
              </div>
            </div>

            {/* Training - Future Feature */}
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-lg border border-gray-200 opacity-60">
              <div className="w-10 h-10 bg-gray-200 text-gray-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-500 mb-1">Training & Support <span className="text-xs font-normal text-gray-400">(Coming Soon)</span></h3>
                <p className="text-sm text-gray-400">
                  Comprehensive training program ensures all volunteers are prepared and supported.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-cyan-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-cyan-100 mb-8 max-w-2xl mx-auto">
            Join our network of dedicated volunteers protecting immigrant communities in the Triangle.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-white text-cyan-700 font-semibold rounded-lg hover:bg-cyan-50 transition-colors shadow-lg"
          >
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  );
}
