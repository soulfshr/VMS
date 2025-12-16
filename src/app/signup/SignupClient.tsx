'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

// Days and time slots for availability grid
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  { label: 'Morning', value: 'MORNING', time: '6am-10am' },
  { label: 'Midday', value: 'MIDDAY', time: '10am-2pm' },
  { label: 'Afternoon', value: 'AFTERNOON', time: '2pm-6pm' },
];

// Background questions - configurable by stakeholders
const BACKGROUND_QUESTIONS = [
  {
    id: 'experience',
    question: 'Do you have any prior experience with community organizing or rapid response?',
    type: 'textarea',
    required: false,
  },
  {
    id: 'languages',
    question: 'What languages do you speak fluently (besides English)?',
    type: 'text',
    required: false,
  },
  {
    id: 'transportation',
    question: 'Do you have reliable transportation?',
    type: 'select',
    options: ['Yes', 'No', 'Sometimes'],
    required: true,
  },
  {
    id: 'referral',
    question: 'How did you hear about us?',
    type: 'select',
    options: ['Friend/Family', 'Social Media', 'Community Event', 'News', 'Other'],
    required: false,
  },
  {
    id: 'motivation',
    question: 'Why are you interested in volunteering with us?',
    type: 'textarea',
    required: false,
  },
];

type AvailabilityGrid = { [key: string]: boolean };

export default function SignupClient() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signalHandle, setSignalHandle] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('English');

  // Step 2: Zone & Availability
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [primaryZoneId, setPrimaryZoneId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityGrid>({});

  // Step 3: Background Questions
  const [backgroundResponses, setBackgroundResponses] = useState<{ [key: string]: string }>({});

  // Fetch zones on mount
  useEffect(() => {
    fetch('/api/public/zones')
      .then(res => res.json())
      .then(data => {
        if (data.zones) {
          setZones(data.zones);
        }
      })
      .catch(err => console.error('Error fetching zones:', err));
  }, []);

  const toggleZone = (zoneId: string) => {
    if (selectedZoneIds.includes(zoneId)) {
      setSelectedZoneIds(selectedZoneIds.filter(id => id !== zoneId));
      if (primaryZoneId === zoneId) {
        setPrimaryZoneId(null);
      }
    } else {
      setSelectedZoneIds([...selectedZoneIds, zoneId]);
      if (!primaryZoneId) {
        setPrimaryZoneId(zoneId);
      }
    }
  };

  const toggleAvailability = (day: string, slot: string) => {
    const key = `${day}-${slot}`;
    setAvailability(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleBackgroundChange = (questionId: string, value: string) => {
    setBackgroundResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const validateStep = (stepNum: number): boolean => {
    setError(null);

    if (stepNum === 1) {
      if (!name.trim()) {
        setError('Please enter your full name');
        return false;
      }
      if (!email.trim()) {
        setError('Please enter your email address');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Please enter a valid email address');
        return false;
      }
    }

    if (stepNum === 2) {
      if (selectedZoneIds.length === 0) {
        setError('Please select at least one zone');
        return false;
      }
    }

    if (stepNum === 3) {
      // Check required background questions
      for (const q of BACKGROUND_QUESTIONS) {
        if (q.required && !backgroundResponses[q.id]?.trim()) {
          setError(`Please answer: "${q.question}"`);
          return false;
        }
      }
    }

    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
    setError(null);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim() || null,
          signalHandle: signalHandle.trim() || null,
          primaryLanguage,
          zoneIds: selectedZoneIds,
          primaryZoneId,
          availability,
          intakeResponses: backgroundResponses,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="text-center mb-8">
            <Image
              src="/ripple-logo.png"
              alt="RippleVMS"
              width={150}
              height={124}
              className="mx-auto mb-4"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Check your email to verify your address and set your password.
              Once verified, our team will review your application and notify you when approved.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Image
            src="/ripple-logo.png"
            alt="RippleVMS"
            width={150}
            height={124}
            className="mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Volunteer Application
          </h1>
          <p className="text-gray-600">
            Join our community of volunteers making a difference
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                  step >= s
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 ${
                    step > s ? 'bg-cyan-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label htmlFor="signal" className="block text-sm font-medium text-gray-700 mb-1">
                  Signal Handle
                </label>
                <input
                  id="signal"
                  type="text"
                  value={signalHandle}
                  onChange={(e) => setSignalHandle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                  placeholder="@yoursignalhandle"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We use Signal for secure team coordination
                </p>
              </div>

              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Language
                </label>
                <select
                  id="language"
                  value={primaryLanguage}
                  onChange={(e) => setPrimaryLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors bg-white"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Zone & Availability */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Zone & Availability</h2>

              {/* Zone Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zone Preferences <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Select zones where you can volunteer. Click a selected zone again to make it your primary.
                </p>
                <div className="flex flex-wrap gap-2">
                  {zones.map((zone) => {
                    const isSelected = selectedZoneIds.includes(zone.id);
                    const isPrimary = zone.id === primaryZoneId;
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => {
                          if (isSelected && !isPrimary) {
                            setPrimaryZoneId(zone.id);
                          } else {
                            toggleZone(zone.id);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          isPrimary
                            ? 'bg-cyan-600 text-white ring-2 ring-cyan-300'
                            : isSelected
                            ? 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {zone.name}
                        {isPrimary && ' ★'}
                      </button>
                    );
                  })}
                </div>
                {selectedZoneIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">★ indicates your primary zone</p>
                )}
              </div>

              {/* Availability Grid */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weekly Availability
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  In general, when are you available during the week?
                </p>
                <div className="overflow-x-auto">
                  <table className="text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-4"></th>
                        {DAYS.map(day => (
                          <th key={day} className="text-center py-2 px-2 font-medium text-gray-700">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map(slot => (
                        <tr key={slot.value}>
                          <td className="py-2 pr-4 font-medium text-gray-700 whitespace-nowrap">
                            <div>{slot.label}</div>
                            <div className="text-xs text-gray-400 font-normal">{slot.time}</div>
                          </td>
                          {DAYS.map(day => {
                            const key = `${day}-${slot.value}`;
                            const isChecked = availability[key] || false;
                            return (
                              <td key={key} className="text-center py-2 px-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAvailability(day, slot.value)}
                                  className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Background Questions */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Tell Us About Yourself</h2>

              {BACKGROUND_QUESTIONS.map((q) => (
                <div key={q.id}>
                  <label htmlFor={q.id} className="block text-sm font-medium text-gray-700 mb-1">
                    {q.question}
                    {q.required && <span className="text-red-500"> *</span>}
                  </label>

                  {q.type === 'text' && (
                    <input
                      id={q.id}
                      type="text"
                      value={backgroundResponses[q.id] || ''}
                      onChange={(e) => handleBackgroundChange(q.id, e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                    />
                  )}

                  {q.type === 'textarea' && (
                    <textarea
                      id={q.id}
                      value={backgroundResponses[q.id] || ''}
                      onChange={(e) => handleBackgroundChange(q.id, e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors resize-none"
                    />
                  )}

                  {q.type === 'select' && q.options && (
                    <select
                      id={q.id}
                      value={backgroundResponses[q.id] || ''}
                      onChange={(e) => handleBackgroundChange(q.id, e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors bg-white"
                    >
                      <option value="">Select an option</option>
                      {q.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Already have account */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-cyan-600 hover:text-cyan-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
