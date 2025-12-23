import Link from 'next/link';

export const metadata = {
  title: 'Security & Architecture | RippleVMS',
  description: 'Information about our security practices, data handling, and system architecture.',
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Security & Architecture</h1>
          <p className="text-lg text-gray-600">
            Transparency about how we build, secure, and operate the Volunteer Management System
          </p>
        </div>

        {/* Overview */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <p className="text-gray-700 mb-4">
            RippleVMS is purpose-built for coordinating community rapid response efforts.
            We prioritize volunteer privacy while maintaining the accountability needed
            for effective coordination.
          </p>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p className="text-sm text-cyan-800">
              <strong>Our Commitment:</strong> We collect only what&apos;s necessary, we&apos;re transparent
              about what we store, and we give volunteers control over their information.
            </p>
          </div>
        </section>

        {/* External Services */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">External Services</h2>
          <p className="text-gray-600 mb-4">
            We use the following third-party services to operate the VMS:
          </p>

          <div className="space-y-4">
            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">🗄️</span>
                <h3 className="font-medium text-gray-900">Neon (Database)</h3>
              </div>
              <p className="text-sm text-gray-600 ml-8">
                PostgreSQL database hosted on Neon. All volunteer data, shift schedules, and
                activity logs are stored here. Data is encrypted at rest and in transit.
              </p>
              <p className="text-xs text-gray-500 ml-8 mt-2">
                Location: US-East (AWS) | SOC 2 Type II Compliant
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">📧</span>
                <h3 className="font-medium text-gray-900">AWS SES (Email)</h3>
              </div>
              <p className="text-sm text-gray-600 ml-8">
                Amazon Simple Email Service for sending shift reminders, notifications, and
                email blasts. We do not store email content after sending.
              </p>
              <p className="text-xs text-gray-500 ml-8 mt-2">
                Location: US-East | SOC 1, SOC 2, SOC 3 Compliant
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">🌐</span>
                <h3 className="font-medium text-gray-900">Vercel (Hosting)</h3>
              </div>
              <p className="text-sm text-gray-600 ml-8">
                Application hosting and CDN. Vercel provides DDoS protection, automatic SSL
                certificates, and edge caching for performance.
              </p>
              <p className="text-xs text-gray-500 ml-8 mt-2">
                Location: Global Edge Network | SOC 2 Type II Compliant
              </p>
            </div>
          </div>
        </section>

        {/* Data We Store */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data We Store</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Volunteer Information</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>Preferred name (display name you choose)</li>
                <li>Email address</li>
                <li>Phone number or Signal ID (at least one required for operational communication)</li>
                <li>Zone assignment</li>
                <li>Qualifications and roles</li>
                <li>Shift history and coverage signups</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Activity Logs</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>Who made changes and when</li>
                <li>What was changed (before/after values)</li>
                <li>Login and logout events</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 ml-2">
                Activity logs are retained for 90 days, then automatically deleted.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">What We Don&apos;t Store</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>Plain-text passwords (only secure hashes)</li>
                <li>Detailed location data or GPS coordinates</li>
                <li>Financial information</li>
                <li>Social media accounts</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Access Control */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Who Can See What</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-medium text-gray-900">Data Type</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-900">Volunteers</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-900">Coordinators</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-900">Admins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3 pr-4 text-gray-700">Your own profile</td>
                  <td className="py-3 px-2 text-center text-green-600">Full</td>
                  <td className="py-3 px-2 text-center text-green-600">Full</td>
                  <td className="py-3 px-2 text-center text-green-600">Full</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-gray-700">Other volunteers&apos; names</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-gray-700">Other volunteers&apos; contact info</td>
                  <td className="py-3 px-2 text-center text-red-500">No</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-gray-700">Shift rosters</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-gray-700">Activity logs</td>
                  <td className="py-3 px-2 text-center text-red-500">No</td>
                  <td className="py-3 px-2 text-center text-green-600">Read-only</td>
                  <td className="py-3 px-2 text-center text-green-600">Full</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-gray-700">System settings</td>
                  <td className="py-3 px-2 text-center text-red-500">No</td>
                  <td className="py-3 px-2 text-center text-red-500">No</td>
                  <td className="py-3 px-2 text-center text-green-600">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit Trail */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Audit Trail</h2>
          <p className="text-gray-700 mb-4">
            Every significant action in the system is logged automatically:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2 mb-4">
            <li>Creating, updating, or deleting shifts</li>
            <li>Volunteer profile changes</li>
            <li>Coverage signups and cancellations</li>
            <li>Role and qualification changes</li>
            <li>Login and logout events</li>
          </ul>
          <p className="text-sm text-gray-600">
            Coordinators can view the activity log at{' '}
            <Link href="/coordinator/activity" className="text-cyan-600 hover:underline">
              /coordinator/activity
            </Link>
            {' '}to see recent changes across the system.
          </p>
        </section>

        {/* Security Practices */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Security Practices</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500">✓</span>
                <h3 className="font-medium text-gray-900">HTTPS Everywhere</h3>
              </div>
              <p className="text-sm text-gray-600">
                All traffic is encrypted with TLS 1.3
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500">✓</span>
                <h3 className="font-medium text-gray-900">Secure Password Storage</h3>
              </div>
              <p className="text-sm text-gray-600">
                Passwords are hashed with bcrypt, never stored in plain text
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500">✓</span>
                <h3 className="font-medium text-gray-900">Role-Based Access</h3>
              </div>
              <p className="text-sm text-gray-600">
                Users only see what their role permits
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500">✓</span>
                <h3 className="font-medium text-gray-900">Data Encryption</h3>
              </div>
              <p className="text-sm text-gray-600">
                Database encrypted at rest and in transit
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500">✓</span>
                <h3 className="font-medium text-gray-900">Automatic Backups</h3>
              </div>
              <p className="text-sm text-gray-600">
                Daily database backups with point-in-time recovery
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500">✓</span>
                <h3 className="font-medium text-gray-900">Open Source</h3>
              </div>
              <p className="text-sm text-gray-600">
                Code is available for community review
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500">✓</span>
                <h3 className="font-medium text-gray-900">IP Address Privacy</h3>
              </div>
              <p className="text-sm text-gray-600">
                IP addresses are hashed (SHA-256 with unique salt) before storage, preserving pattern detection while protecting your actual IP
              </p>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="bg-cyan-50 border border-cyan-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-cyan-900 mb-2">Questions or Concerns?</h2>
          <p className="text-cyan-800">
            If you have questions about how your data is handled, want to request deletion
            of your information, or have security concerns, please contact your zone coordinator
            or email the technical team.
          </p>
        </section>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-cyan-600 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
