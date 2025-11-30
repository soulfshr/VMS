import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-teal-600 to-teal-800 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/siembra-logo.webp"
              alt="Siembra NC"
              width={120}
              height={120}
              className="rounded-xl shadow-lg"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Siembra NC
          </h1>
          <p className="text-xl md:text-2xl text-teal-100 mb-8 max-w-2xl mx-auto">
            Volunteer Management System
          </p>
          <p className="text-lg text-teal-200 mb-10 max-w-3xl mx-auto">
            Coordinating community volunteers to monitor, document, and respond to immigration enforcement activities in North Carolina&apos;s Triangle region.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-white text-teal-700 font-semibold rounded-lg hover:bg-teal-50 transition-colors shadow-lg"
            >
              Login
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 bg-teal-700 text-white font-semibold rounded-lg hover:bg-teal-900 transition-colors border border-teal-500"
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
              <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xl font-bold mb-4">
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
              <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xl font-bold mb-4">
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
              <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xl font-bold mb-4">
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

            {/* Intel Collection */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Intel Collection</h3>
                <p className="text-sm text-gray-600">
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

            {/* Community Alerts */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Community Alerts</h3>
                <p className="text-sm text-gray-600">
                  Verified sightings are published through Ojo and social media to keep the community informed.
                </p>
              </div>
            </div>

            {/* Coordination */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
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

            {/* Training */}
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Training & Support</h3>
                <p className="text-sm text-gray-600">
                  Comprehensive training program ensures all volunteers are prepared and supported.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage Area Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Our Coverage Area
          </h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            We operate across 13 zones in Durham, Orange, and Wake counties in North Carolina&apos;s Triangle region.
          </p>
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <iframe
              src="https://www.google.com/maps/d/embed?mid=1ZYih3BSK-5jcHzAbRBX9W-Jo2LmrfEw"
              width="100%"
              height="480"
              style={{ border: 0 }}
              loading="lazy"
              title="Siembra NC Coverage Map"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <span className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200">
              Durham County (5 zones)
            </span>
            <span className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200">
              Orange County (2 zones)
            </span>
            <span className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200">
              Wake County (6 zones)
            </span>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-teal-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-teal-100 mb-8 max-w-2xl mx-auto">
            Join our network of dedicated volunteers protecting immigrant communities in the Triangle.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-white text-teal-700 font-semibold rounded-lg hover:bg-teal-50 transition-colors shadow-lg"
          >
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  );
}
