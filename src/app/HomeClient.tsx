'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function HomeClient() {
  const { data: session, status } = useSession();

  // Show different CTA for authenticated users
  const isAuthenticated = status === 'authenticated' && session?.user;

  return (
    <div className="min-h-[calc(100vh-200px)]">

      {/* Public ICE Sighting Report Banner - HIDDEN for now */}

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
          <h1 className="text-xl md:text-2xl font-medium text-cyan-100 mb-3 max-w-3xl mx-auto">
            Coordinate volunteers, dispatch, and training from one hub—built for rapid-response community orgs.
          </h1>
          <p className="text-cyan-100/90 max-w-3xl mx-auto mb-6">
            Replace spreadsheets and group chats with integrated scheduling, dispatch, training, and coverage tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-white text-cyan-700 font-semibold rounded-lg hover:bg-cyan-50 transition-colors shadow-lg"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/request-invite"
                  className="px-8 py-4 bg-white text-cyan-700 font-semibold rounded-lg hover:bg-cyan-50 transition-colors shadow-lg"
                >
                  Request an Invite
                </Link>
                <Link
                  href="/how-it-works"
                  className="px-8 py-4 bg-cyan-700 text-white font-semibold rounded-lg hover:bg-cyan-900 transition-colors border border-cyan-500"
                >
                  See How It Works
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Built for Your Organization - Two Column Value Prop */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Built for Your Organization
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Coordinators Column */}
            <div className="bg-gradient-to-br from-cyan-50 to-white rounded-xl p-8 border border-cyan-100">
              <h3 className="text-xl font-semibold text-cyan-700 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                For Coordinators
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Hit zone coverage targets and dispatch teams in minutes</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Auto-qualify volunteers as soon as they pass your trainings</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Fill the right roles fast with skill and availability matching</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Track volunteer qualifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Track coverage by zone and time without spreadsheets</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Send consistent updates to Signal with prebuilt templates</span>
                </li>
              </ul>
            </div>

            {/* Volunteers Column */}
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl p-8 border border-purple-100">
              <h3 className="text-xl font-semibold text-purple-700 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                For Volunteers
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Complete training at your own pace</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Automatically earn shift qualifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Sign up for shifts matching your skills</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Track your progress and certifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Access resources and training materials</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Stay connected with your team</span>
                </li>
              </ul>
            </div>
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
                Complete interactive training modules to earn qualifications for shift positions.
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

      {/* Platform Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Platform Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Field Monitoring */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Field Monitoring</h3>
                <p className="text-sm text-gray-600">
                  SALUTE-style intake plus live status so dispatch and field teams stay in sync.
                </p>
              </div>
            </div>

            {/* Rapid Response */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Rapid Response</h3>
                <p className="text-sm text-gray-600">
                  Dispatch the right team fast with invite flows, requirements, and real-time updates.
                </p>
              </div>
            </div>

            {/* Training Center */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Training Center</h3>
                <p className="text-sm text-gray-600">
                  Interactive trainings with quizzes and attestations that auto-award qualifications.
                </p>
              </div>
            </div>

            {/* Incident Reports */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Incident Reports</h3>
                <p className="text-sm text-gray-600">
                  Intake, assign, and close incidents with a transparent audit trail.
                </p>
              </div>
            </div>

            {/* Shift Scheduling */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Shift Scheduling</h3>
                <p className="text-sm text-gray-600">
                  Create and fill shifts with role requirements, RSVPs, and coverage tracking.
                </p>
              </div>
            </div>

            {/* Message Templates */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Message Templates</h3>
                <p className="text-sm text-gray-600">
                  Prebuilt Signal templates for consistent updates to leads and field teams.
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
            Ready to coordinate faster?
          </h2>
          <p className="text-cyan-100 mb-8 max-w-2xl mx-auto">
            We’re onboarding a limited cohort of community organizations—tell us about your team and coverage needs.
          </p>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-block px-8 py-4 bg-white text-cyan-700 font-semibold rounded-lg hover:bg-cyan-50 transition-colors shadow-lg"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/request-invite"
              className="inline-block px-8 py-4 bg-white text-cyan-700 font-semibold rounded-lg hover:bg-cyan-50 transition-colors shadow-lg"
            >
              Request an Invite
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
