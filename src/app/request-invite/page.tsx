'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const ORG_TYPES = [
  { value: 'rapid-response', label: 'Rapid Response Network' },
  { value: 'legal-aid', label: 'Legal Aid Organization' },
  { value: 'mutual-aid', label: 'Mutual Aid Network' },
  { value: 'community-org', label: 'Community Organization' },
  { value: 'other', label: 'Other' },
];

const VOLUNTEER_COUNTS = [
  { value: '1-10', label: '1-10 volunteers' },
  { value: '11-50', label: '11-50 volunteers' },
  { value: '51-200', label: '51-200 volunteers' },
  { value: '200+', label: '200+ volunteers' },
];

const FEATURES = [
  {
    slug: 'shifts',
    label: 'Shift scheduling & calendar',
    description: 'Create and manage volunteer shifts with an intuitive calendar interface',
  },
  {
    slug: 'coverage',
    label: 'Coverage grid / dispatch coordination',
    description: 'Coordinate dispatchers and zone leads for comprehensive coverage',
  },
  {
    slug: 'sightings',
    label: 'ICE sighting reporting & alerts',
    description: 'Enable community members to report and track ICE activity',
  },
  {
    slug: 'training',
    label: 'Volunteer training management',
    description: 'Track certifications, modules, and training completion',
  },
  {
    slug: 'multi-location',
    label: 'Multi-location/chapter support',
    description: 'Manage multiple zones, regions, or chapters from one platform',
  },
  {
    slug: 'mobile',
    label: 'Mobile-friendly volunteer access',
    description: 'Volunteers can view shifts and sign up from any device',
  },
];

export default function RequestInvitePage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organizationName: '',
    organizationType: '',
    volunteerCount: '',
    featuresOfInterest: [] as string[],
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFeatureToggle = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      featuresOfInterest: prev.featuresOfInterest.includes(slug)
        ? prev.featuresOfInterest.filter(f => f !== slug)
        : [...prev.featuresOfInterest, slug],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/invite-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h1>
            <p className="text-gray-600 mb-6">
              Thanks for your interest in RippleVMS. We&apos;ve sent a confirmation to <strong>{formData.email}</strong> and will be in touch within 1-2 business days.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
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
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-cyan-600 transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Intro */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Request an Invite
            </h1>
            <p className="text-gray-600 text-lg">
              Tell us about your organization and we&apos;ll reach out to discuss how RippleVMS can help coordinate your volunteers.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Contact Info */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="jane@organization.org"
                  />
                </div>
              </div>
            </div>

            {/* Organization Info */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.organizationName}
                    onChange={e => setFormData(prev => ({ ...prev, organizationName: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Triangle Rapid Response Network"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.organizationType}
                      onChange={e => setFormData(prev => ({ ...prev, organizationType: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select type...</option>
                      {ORG_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Approximate Volunteer Count <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.volunteerCount}
                      onChange={e => setFormData(prev => ({ ...prev, volunteerCount: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select size...</option>
                      {VOLUNTEER_COUNTS.map(count => (
                        <option key={count.value} value={count.value}>{count.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Features of Interest */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Features of Interest</h2>
              <p className="text-sm text-gray-500 mb-4">Select any features that would be helpful for your organization (optional)</p>
              <div className="grid md:grid-cols-2 gap-3">
                {FEATURES.map(feature => (
                  <label
                    key={feature.slug}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.featuresOfInterest.includes(feature.slug)
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.featuresOfInterest.includes(feature.slug)}
                      onChange={() => handleFeatureToggle(feature.slug)}
                      className="mt-1 w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{feature.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anything else you&apos;d like us to know? (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                placeholder="Tell us about your current volunteer coordination challenges, timeline, or any specific questions..."
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              We typically respond within 1-2 business days.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
