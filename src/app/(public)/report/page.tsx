'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import LocationPicker from '@/components/maps/LocationPicker';
import MediaUploader from '@/components/MediaUploader';
import { useFeatures } from '@/hooks/useFeatures';

interface UploadSettings {
  maxUploadSizeMb: number;
  maxUploadsPerReport: number;
}

interface UploadedMedia {
  url: string;
  type: 'IMAGE' | 'VIDEO';
  filename: string;
  size: number;
}

interface LocationData {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

// Format datetime-local value
function formatDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function ReportPage() {
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect - public report page redirects to landing when disabled
  useEffect(() => {
    if (!features.isLoading && !features.sightings) {
      router.replace('/');
    }
  }, [router, features.isLoading, features.sightings]);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSettings, setUploadSettings] = useState<UploadSettings>({
    maxUploadSizeMb: 50,
    maxUploadsPerReport: 5,
  });

  // Fetch upload settings on mount
  useEffect(() => {
    fetch('/api/settings/upload')
      .then((res) => res.json())
      .then((data) => setUploadSettings(data))
      .catch(console.error);
  }, []);

  // SALUTE form fields
  const [size, setSize] = useState('');
  const [activity, setActivity] = useState('');
  const [location, setLocation] = useState<LocationData>({
    address: '',
    latitude: null,
    longitude: null,
  });
  const [uniform, setUniform] = useState('');
  const [observedAt, setObservedAt] = useState(formatDatetimeLocal(new Date()));
  const [equipment, setEquipment] = useState('');

  // Optional reporter info
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');

  // Media uploads
  const [mediaUrls, setMediaUrls] = useState<UploadedMedia[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/sightings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size,
          activity,
          location: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          uniform,
          observedAt: new Date(observedAt).toISOString(),
          equipment,
          reporterName: reporterName || null,
          reporterPhone: reporterPhone || null,
          reporterEmail: reporterEmail || null,
          mediaUrls,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setSize('');
    setActivity('');
    setLocation({ address: '', latitude: null, longitude: null });
    setUniform('');
    setObservedAt(formatDatetimeLocal(new Date()));
    setEquipment('');
    setReporterName('');
    setReporterPhone('');
    setReporterEmail('');
    setMediaUrls([]);
  };

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center space-y-6">
            {/* Success icon */}
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900">Report Submitted</h1>
            <p className="text-lg text-gray-600">
              Thank you for keeping our community safe. Your report has been received and will be reviewed by our dispatch team.
            </p>

            {/* Hotline reminder */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <p className="text-sm text-yellow-800 mb-2">For immediate assistance, call the 24/7 hotline:</p>
              <a href="tel:336-543-0353" className="text-2xl font-bold text-yellow-900 hover:underline">
                336-543-0353
              </a>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button
                onClick={resetForm}
                className="px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                Submit Another Report
              </button>
              <Link
                href="/"
                className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-center"
              >
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {/* Header with hotline */}
      <div className="bg-teal-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/siembra-logo.webp"
                alt="Siembra NC"
                width={48}
                height={48}
                className="rounded-lg"
              />
              <span className="font-semibold text-lg">Siembra NC</span>
            </Link>
            <div className="text-center sm:text-right">
              <p className="text-sm text-teal-200">Report ICE Sightings to 24/7 Hotline</p>
              <a href="tel:336-543-0353" className="text-xl font-bold hover:underline">
                336-543-0353
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero section */}
        <div className="text-center mb-8">
          <p className="text-teal-700 font-semibold tracking-wide uppercase text-sm mb-2">
            Spread Information, Not Panic
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Report an ICE Sighting
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Use the <strong>S.A.L.U.T.E.</strong> model to report what you observed. Your report helps keep our community informed and safe.
          </p>
        </div>

        {/* SALUTE legend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-teal-600">S.A.L.U.T.E.</span> Reporting Model
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><span className="font-bold text-teal-700">S</span> - Size/Strength</div>
            <div><span className="font-bold text-teal-700">A</span> - Actions/Activity</div>
            <div><span className="font-bold text-teal-700">L</span> - Location/Direction</div>
            <div><span className="font-bold text-teal-700">U</span> - Uniform/Clothes</div>
            <div><span className="font-bold text-teal-700">T</span> - Time & Date</div>
            <div><span className="font-bold text-teal-700">E</span> - Equipment/Weapons</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {/* S - Size/Strength */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <label className="block">
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold">S</span>
                Size / Strength
              </span>
              <span className="text-sm text-gray-500 mt-1 block">How many people and vehicles?</span>
              <textarea
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="5-6 officers, 2 white SUVs"
                rows={2}
                required
                className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
              />
            </label>
          </div>

          {/* A - Actions/Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <label className="block">
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold">A</span>
                Actions / Activity
              </span>
              <span className="text-sm text-gray-500 mt-1 block">What are they doing?</span>
              <textarea
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="trying to force a man into their SUV"
                rows={2}
                required
                className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
              />
            </label>
          </div>

          {/* L - Location/Direction */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div>
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold">L</span>
                Location / Direction
              </span>
              <span className="text-sm text-gray-500 mt-1 block">Where is this happening?</span>
              <div className="mt-3">
                <LocationPicker
                  value={location}
                  onChange={setLocation}
                  placeholder="parked in front of Wendy's in Methuen"
                />
              </div>
            </div>
          </div>

          {/* U - Uniform/Clothes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <label className="block">
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold">U</span>
                Uniform / Clothes
              </span>
              <span className="text-sm text-gray-500 mt-1 block">What are they wearing?</span>
              <textarea
                value={uniform}
                onChange={(e) => setUniform(e.target.value)}
                placeholder="blue vests with ICE on the back"
                rows={2}
                required
                className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
              />
            </label>
          </div>

          {/* T - Time & Date */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <label className="block">
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold">T</span>
                Time & Date
              </span>
              <span className="text-sm text-gray-500 mt-1 block">When did you observe this?</span>
              <input
                type="datetime-local"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
                required
                className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </label>
          </div>

          {/* E - Equipment/Weapons */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <label className="block">
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold">E</span>
                Equipment & Weapons
              </span>
              <span className="text-sm text-gray-500 mt-1 block">What equipment or weapons are visible?</span>
              <textarea
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="helmets, vests, and guns"
                rows={2}
                required
                className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
              />
            </label>
          </div>

          {/* Photos/Videos */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div>
              <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Photos & Videos
                <span className="text-sm font-normal text-gray-500">(optional)</span>
              </span>
              <span className="text-sm text-gray-500 mt-1 block">Upload any photos or videos of the sighting</span>
              <div className="mt-3">
                <MediaUploader
                  onUpload={setMediaUrls}
                  maxFiles={uploadSettings.maxUploadsPerReport}
                  maxSizeMb={uploadSettings.maxUploadSizeMb}
                />
              </div>
            </div>
          </div>

          {/* Reporter Contact Info (optional) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Your Contact Information
              <span className="text-sm font-normal text-gray-500 ml-2">(optional)</span>
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Provide your contact info if you&apos;d like us to follow up with you
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting || !location.address}
              className="w-full py-4 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        </form>

        {/* Footer reminder */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            For immediate emergencies, call <strong>911</strong>.
            <br />
            For ICE sighting reports, call the Siembra NC hotline:{' '}
            <a href="tel:336-543-0353" className="text-teal-600 font-medium hover:underline">
              336-543-0353
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
