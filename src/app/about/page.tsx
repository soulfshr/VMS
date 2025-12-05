'use client';

import Image from 'next/image';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';

// Dynamic import to prevent SSR issues with Google Maps
const CoverageMap = nextDynamic(
  () => import('@/components/maps/CoverageMap'),
  { ssr: false, loading: () => <div className="bg-gray-100 rounded-xl animate-pulse h-[400px]" /> }
);

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-teal-600 to-teal-800 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <Image
            src="/ripple-logo-perspective-animated.svg"
            alt="RippleVMS"
            width={160}
            height={100}
            className="mx-auto mb-6"
          />
          <h1 className="text-4xl font-bold mb-4">About RippleVMS</h1>
          <p className="text-xl text-teal-100 max-w-2xl mx-auto">
            Protecting immigrant communities through organized volunteer monitoring and rapid response
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
          <p className="text-lg text-gray-600 mb-6">
            RippleVMS is a volunteer management platform designed to help community organizations coordinate rapid response efforts. Through organized volunteer networks, communities can monitor, document, and respond to situations that affect their members.
          </p>
          <p className="text-lg text-gray-600">
            The system enables organizations to coordinate volunteers across multiple zones, streamlining onboarding, shift scheduling, and real-time communication during field operations.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">How We Work</h2>

          <div className="space-y-6">
            {/* Shift Types */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Volunteer Shift Types</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Patrol</h4>
                  <p className="text-sm text-blue-700">
                    Active zone monitoring in the field. Volunteers physically patrol assigned areas to observe and document activity.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">Collection</h4>
                  <p className="text-sm text-purple-700">
                    Social media and intel monitoring. Volunteers track community channels, verify reports, and develop information sources.
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2">On-Call Support</h4>
                  <p className="text-sm text-orange-700">
                    Available for rapid dispatch when incidents are reported. Ready to respond and verify sightings in the field.
                  </p>
                </div>
              </div>
            </div>

            {/* Response Process */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Incident Response Process</h3>
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                  <span className="text-gray-600">Community members or volunteers report sightings through multiple channels</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                  <span className="text-gray-600">Dispatcher verifies the report and coordinates with zone leads via Signal</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                  <span className="text-gray-600">Field team is dispatched to confirm and document the activity</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                  <span className="text-gray-600">Verified reports are published to Ojo and social media to alert the community</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage Area */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Coverage Area</h2>
          <p className="text-lg text-gray-600 mb-6">
            We operate across 13 zones in North Carolina&apos;s Triangle region:
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Durham County</h3>
              <ul className="text-gray-600 space-y-1 text-sm">
                <li>Durham 1</li>
                <li>Durham 2</li>
                <li>Durham 3</li>
                <li>Durham 4</li>
                <li>Durham 5</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Orange County</h3>
              <ul className="text-gray-600 space-y-1 text-sm">
                <li>Orange 1</li>
                <li>Orange 2</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Wake County</h3>
              <ul className="text-gray-600 space-y-1 text-sm">
                <li>Wake 1</li>
                <li>Wake 2</li>
                <li>Wake 3</li>
                <li>Wake 4</li>
                <li>Wake 5</li>
                <li>Wake 6</li>
              </ul>
            </div>
          </div>

          <CoverageMap height="400px" />
        </div>
      </section>

      {/* Built By Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-2xl font-bold mb-6">Built for Communities</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            RippleVMS is developed by Honey Badger Apps to help community organizations coordinate volunteers effectively and respond to situations rapidly.
          </p>

          <div className="flex items-center justify-center gap-4 mb-8">
            <Image
              src="/honeybadger-logo.png"
              alt="Honey Badger Apps"
              width={40}
              height={40}
              className="inline-block"
            />
            <span className="text-gray-400">A Honey Badger App</span>
          </div>

          <p className="text-sm text-gray-500">
            Interested in using RippleVMS for your organization? Contact Honey Badger Apps to learn more.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Join Our Volunteer Network
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Be part of a community dedicated to protecting immigrant rights in the Triangle. Sign up to become a volunteer today.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-lg"
          >
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}
