'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

// Intersection Observer hook for scroll animations
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

// Step component with animation
function Step({
  number,
  title,
  description,
  features,
  illustration,
  reverse = false,
}: {
  number: number;
  title: string;
  description: string;
  features: string[];
  illustration: React.ReactNode;
  reverse?: boolean;
}) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 lg:gap-16 items-center transition-all duration-700 ${
        isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {/* Content */}
      <div className="flex-1 max-w-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-cyan-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
            {number}
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
        </div>
        <p className="text-lg text-gray-600 mb-6">{description}</p>
        <ul className="space-y-3">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Illustration */}
      <div className="flex-1 w-full max-w-lg">{illustration}</div>
    </div>
  );
}

// Mock UI illustrations
function ScheduleIllustration() {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-2 text-sm text-gray-500">Shift Calendar</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => {
            const day = i - 3;
            const hasShift = [5, 6, 12, 13, 19, 20, 26, 27].includes(i);
            const isToday = i === 15;
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm relative ${
                  day < 1 || day > 31 ? 'text-gray-300' : 'text-gray-700'
                } ${isToday ? 'bg-cyan-100 font-bold' : ''}`}
              >
                {day > 0 && day <= 31 && day}
                {hasShift && day > 0 && day <= 31 && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-500" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 p-2 bg-cyan-50 rounded-lg border border-cyan-200">
            <div className="w-2 h-8 bg-cyan-500 rounded" />
            <div>
              <div className="text-sm font-medium text-gray-900">Morning Shift - Zone A</div>
              <div className="text-xs text-gray-500">8:00 AM - 12:00 PM</div>
            </div>
            <div className="ml-auto px-2 py-1 bg-green-100 text-green-700 text-xs rounded">3/4 filled</div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
            <div className="w-2 h-8 bg-purple-500 rounded" />
            <div>
              <div className="text-sm font-medium text-gray-900">Evening Shift - Zone B</div>
              <div className="text-xs text-gray-500">4:00 PM - 8:00 PM</div>
            </div>
            <div className="ml-auto px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">1/4 filled</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotifyIllustration() {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-2 text-sm text-gray-500">Shift Details</span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">Morning Shift - Zone A</h4>
          <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs rounded">Open</span>
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Saturday, Jan 18, 2025
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            8:00 AM - 12:00 PM
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Positions Needed:</div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Verifier (2)</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Zone Lead (1)</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Dispatcher (1)</span>
          </div>
        </div>
        <button className="w-full py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors">
          Sign Up for This Shift
        </button>
      </div>
    </div>
  );
}

function TrackIllustration() {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-2 text-sm text-gray-500">Coverage Grid</span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">Today&apos;s Coverage</h4>
          <span className="text-sm text-gray-500">Jan 18, 2025</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 font-medium">Zone</th>
                <th className="pb-2 font-medium text-center">8-12</th>
                <th className="pb-2 font-medium text-center">12-4</th>
                <th className="pb-2 font-medium text-center">4-8</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 font-medium text-gray-900">Zone A</td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-green-100 text-green-700 text-xs leading-6">4</span>
                </td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-green-100 text-green-700 text-xs leading-6">3</span>
                </td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-yellow-100 text-yellow-700 text-xs leading-6">2</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium text-gray-900">Zone B</td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-green-100 text-green-700 text-xs leading-6">3</span>
                </td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-red-100 text-red-700 text-xs leading-6">1</span>
                </td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-green-100 text-green-700 text-xs leading-6">4</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium text-gray-900">Zone C</td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-yellow-100 text-yellow-700 text-xs leading-6">2</span>
                </td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-green-100 text-green-700 text-xs leading-6">4</span>
                </td>
                <td className="py-2 text-center">
                  <span className="inline-block w-6 h-6 rounded bg-yellow-100 text-yellow-700 text-xs leading-6">2</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-100" /> Full coverage
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-100" /> Partial
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-100" /> Needs help
          </div>
        </div>
      </div>
    </div>
  );
}

function CoordinateIllustration() {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-2 text-sm text-gray-500">Dispatch Console</span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">Active Teams</h4>
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">Zone A Team</span>
              <span className="text-xs text-green-600">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center text-white text-xs">M</div>
                <div className="w-6 h-6 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-white text-xs">S</div>
                <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white text-xs">J</div>
              </div>
              <span className="text-xs text-gray-500">3 volunteers</span>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">Zone B Team</span>
              <span className="text-xs text-green-600">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-white text-xs">A</div>
                <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs">R</div>
              </div>
              <span className="text-xs text-gray-500">2 volunteers</span>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
          <div className="text-sm font-medium text-cyan-800 mb-1">Quick Message</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Send update to all teams..."
              className="flex-1 px-3 py-1.5 text-sm border border-cyan-200 rounded bg-white"
              readOnly
            />
            <button className="px-3 py-1.5 bg-cyan-600 text-white text-sm rounded">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapIllustration() {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-2 text-sm text-gray-500">Coverage Map</span>
      </div>
      <div className="p-4">
        {/* Mini map with zones */}
        <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg h-48 mb-4 overflow-hidden">
          {/* Zone polygons */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 150">
            {/* Zone A - Red */}
            <polygon
              points="60,20 90,25 85,70 55,65"
              fill="#ef4444"
              fillOpacity="0.3"
              stroke="#ef4444"
              strokeWidth="2"
            />
            {/* Zone B - Blue */}
            <polygon
              points="55,65 85,70 80,120 45,115"
              fill="#3b82f6"
              fillOpacity="0.3"
              stroke="#3b82f6"
              strokeWidth="2"
            />
            {/* Zone C - Amber */}
            <polygon
              points="90,25 140,35 135,90 85,70"
              fill="#f59e0b"
              fillOpacity="0.3"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            {/* Zone D - Green */}
            <polygon
              points="140,35 180,30 175,85 135,90"
              fill="#22c55e"
              fillOpacity="0.3"
              stroke="#22c55e"
              strokeWidth="2"
            />
            {/* POI markers */}
            <circle cx="70" cy="45" r="4" fill="#dc2626" stroke="white" strokeWidth="1" />
            <circle cx="110" cy="55" r="4" fill="#dc2626" stroke="white" strokeWidth="1" />
            <circle cx="155" cy="60" r="4" fill="#2563eb" stroke="white" strokeWidth="1" />
            <circle cx="65" cy="90" r="4" fill="#2563eb" stroke="white" strokeWidth="1" />
          </svg>
          {/* Map controls */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <button className="w-6 h-6 bg-white rounded shadow text-gray-600 text-xs flex items-center justify-center">+</button>
            <button className="w-6 h-6 bg-white rounded shadow text-gray-600 text-xs flex items-center justify-center">−</button>
          </div>
        </div>
        {/* Zone legend */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Zones</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded bg-red-500" />
              <span className="text-gray-600">Downtown</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-gray-600">Midtown</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-gray-600">Uptown</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded bg-green-500" />
              <span className="text-gray-600">Eastside</span>
            </div>
          </div>
        </div>
        {/* POI legend */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-sm font-medium text-gray-700 mb-2">Points of Interest</div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-gray-600">Court</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-blue-600" />
              <span className="text-gray-600">Hospital</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/ripple-logo.png"
              alt="RippleVMS"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-gray-900">RippleVMS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-cyan-600 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/request-invite"
              className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Request an Invite
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            How RippleVMS Works
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            From scheduling to dispatch, see how RippleVMS helps community organizations coordinate volunteers efficiently.
          </p>
          <div className="flex justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Set up in minutes
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Works on any device
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Secure & private
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-6xl space-y-24">
          <Step
            number={1}
            title="Schedule Shifts"
            description="Create shifts for different zones, times, and roles. Import from spreadsheets or build from scratch with our intuitive calendar."
            features={[
              'Drag-and-drop calendar interface',
              'Import shifts from Google Sheets or Excel',
              'Set role requirements (Volunteer, Coordinator, Shift Lead, etc.)',
              'Recurring shift templates for regular schedules',
            ]}
            illustration={<ScheduleIllustration />}
          />

          <Step
            number={2}
            title="Notify & Fill Shifts"
            description="Volunteers see available shifts and sign up based on their qualifications. No more group chat chaos."
            features={[
              'Automatic qualification matching',
              'Email notifications for new shifts',
              'One-click signup from any device and confirmation emails with calendar invites',
              'Waitlist for popular shifts',
            ]}
            illustration={<NotifyIllustration />}
            reverse
          />

          <Step
            number={3}
            title="Track Coverage"
            description="See coverage at a glance across all zones and time slots. Instantly identify gaps that need attention."
            features={[
              'Real-time coverage grid by zone and time',
              'Color-coded status (full, partial, needs help)',
              'Coverage reports and analytics',
              'Alerts for understaffed shifts',
            ]}
            illustration={<TrackIllustration />}
          />

          <Step
            number={4}
            title="Coordinate Teams"
            description="Dispatch and communicate with field teams in real-time. Keep everyone in sync during operations."
            features={[
              'Live team status dashboard',
              'Quickly copy information to send via messaging apps (e.g. Signal) using message templates',
              'Incident logging and assignment',
              'Shift handoff checklists',
            ]}
            illustration={<CoordinateIllustration />}
            reverse
          />

          <Step
            number={5}
            title="Map Your Territory"
            description="Define custom zones and mark important locations. Visualize coverage across your entire service area."
            features={[
              'Draw custom zone boundaries on an interactive map',
              'Mark points of interest (courts, hospitals, shelters, etc.)',
              'Color-code zones for easy identification',
              'See zone coverage at a glance with the legend',
            ]}
            illustration={<MapIllustration />}
          />
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Plus Everything Else You Need
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Training Center</h3>
              <p className="text-sm text-gray-600">
                Interactive modules with quizzes that auto-award qualifications when volunteers pass.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Volunteer Management</h3>
              <p className="text-sm text-gray-600">
                Track qualifications, attendance history, and volunteer profiles all in one place.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Incident Reporting</h3>
              <p className="text-sm text-gray-600">
                Log and track incidents with SALUTE-style intake and transparent audit trails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-cyan-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-cyan-100 mb-8 max-w-2xl mx-auto">
            We&apos;re onboarding a limited cohort of community organizations. Tell us about your team and we&apos;ll be in touch.
          </p>
          <Link
            href="/request-invite"
            className="inline-block px-8 py-4 bg-white text-cyan-700 font-semibold rounded-lg hover:bg-cyan-50 transition-colors shadow-lg"
          >
            Request an Invite
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-gray-400">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/ripple-logo.png" alt="RippleVMS" width={24} height={24} className="rounded" />
            <span className="text-white font-medium">RippleVMS</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
