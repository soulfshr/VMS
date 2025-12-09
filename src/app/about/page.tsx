'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Mission Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h1>
          <p className="text-lg text-gray-600 mb-6">
            RippleVMS is a volunteer management platform designed to help community organizations coordinate rapid response efforts. Through organized volunteer networks, communities can monitor, document, and respond to situations that affect their members.
          </p>
          <p className="text-lg text-gray-600 mb-8">
            The system enables organizations to coordinate volunteers across multiple zones, streamlining onboarding, shift scheduling, and real-time communication during field operations.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}
