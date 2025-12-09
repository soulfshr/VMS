import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - RippleVMS',
  description: 'Privacy Policy for RippleVMS',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">RippleVMS - Volunteer Management System</p>
          <p className="text-sm text-gray-500 mb-8">Last Updated: December 7, 2025</p>

          <div className="prose prose-gray max-w-none">
            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Introduction</h2>
            <p className="text-gray-600 mb-4">
              RippleVMS (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates a volunteer management system (the &quot;VMS&quot; or &quot;Service&quot;), a digital platform designed to coordinate volunteer activities. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
            <p className="text-gray-600 mb-4">
              By using the VMS, you agree to the collection and use of information in accordance with this policy. If you do not agree with this policy, please do not use the Service.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Information You Provide Directly</h3>

            <h4 className="font-medium text-gray-700 mt-4 mb-2">Volunteer Account Information</h4>
            <p className="text-gray-600 mb-2">When you register as a volunteer, we collect:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Contact Information:</strong> Full name, email address, and phone number</li>
              <li><strong>Language Preferences:</strong> Primary language and additional languages spoken</li>
              <li><strong>Zone Preferences:</strong> Geographic zones where you prefer to volunteer (Durham, Orange, and Wake counties)</li>
            </ul>

            <h4 className="font-medium text-gray-700 mt-4 mb-2">Volunteer Activity Information</h4>
            <p className="text-gray-600 mb-2">As you use the Service, we collect:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Shift Participation:</strong> Shifts you RSVP to and your confirmation status</li>
              <li><strong>Training Records:</strong> Training sessions attended and qualifications earned (Verifier, Zone Lead, Dispatcher)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Information Collected Automatically</h3>

            <h4 className="font-medium text-gray-700 mt-4 mb-2">Device and Usage Information</h4>
            <p className="text-gray-600 mb-2">When you access the VMS, we may automatically collect:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Browser and Device Information:</strong> Browser type, operating system, and device identifiers</li>
              <li><strong>Access Logs:</strong> Date and time of access, pages visited, and actions taken within the Service</li>
              <li><strong>Session Information:</strong> Authentication tokens stored in secure, HTTP-only cookies</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">How We Use Your Information</h2>
            <p className="text-gray-600 mb-2">We use the information we collect to:</p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Operate and Improve the Service</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Create and manage your volunteer account</li>
              <li>Coordinate volunteer shift scheduling and assignments</li>
              <li>Track training completion and qualifications</li>
              <li>Match volunteers with appropriate shifts based on zone assignments</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Communications</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Send email notifications about shifts, training sessions, and schedule changes</li>
              <li>Provide important updates about the Service or your volunteer activities</li>
              <li>Send password reset emails when requested</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Administrative Purposes</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Maintain accurate records of volunteer participation</li>
              <li>Generate reports on volunteer activity and program effectiveness</li>
              <li>Improve the Service based on usage patterns</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Information Sharing and Disclosure</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Within the Organization</h3>
            <p className="text-gray-600 mb-2">Your information may be accessed by:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Coordinators:</strong> To manage volunteer assignments, view contact information, and track participation</li>
              <li><strong>Dispatchers:</strong> To view shift schedules and coordinate activities</li>
              <li><strong>Administrators:</strong> To manage system settings and oversee operations</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">With Third-Party Service Providers</h3>
            <p className="text-gray-600 mb-2">We use the following third-party services to operate the VMS:</p>

            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Service</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Purpose</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Data Shared</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr>
                    <td className="px-4 py-2 border-b"><strong>Neon (PostgreSQL)</strong></td>
                    <td className="px-4 py-2 border-b">Database hosting</td>
                    <td className="px-4 py-2 border-b">All stored data (encrypted at rest)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b"><strong>Vercel</strong></td>
                    <td className="px-4 py-2 border-b">Application hosting</td>
                    <td className="px-4 py-2 border-b">Application data</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b"><strong>Amazon SES</strong></td>
                    <td className="px-4 py-2 border-b">Email delivery</td>
                    <td className="px-4 py-2 border-b">Email addresses and notification content</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b"><strong>Google Maps</strong></td>
                    <td className="px-4 py-2 border-b">Zone boundary display</td>
                    <td className="px-4 py-2 border-b">Zone boundary coordinates (public)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b"><strong>Upstash Redis</strong></td>
                    <td className="px-4 py-2 border-b">Rate limiting</td>
                    <td className="px-4 py-2 border-b">IP addresses (temporary, for abuse prevention)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Legal Requirements</h3>
            <p className="text-gray-600 mb-4">
              We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency).
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">With Your Consent</h3>
            <p className="text-gray-600 mb-4">
              We may share your information with third parties when you have given us explicit consent to do so.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Data Security</h2>
            <p className="text-gray-600 mb-4">We implement comprehensive technical and organizational measures to protect your personal information. Our security practices meet or exceed industry standards for protecting sensitive data.</p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Encryption Standards</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Encryption in Transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher with strong cipher suites. We enforce HTTPS on all connections and use HSTS (HTTP Strict Transport Security) to prevent downgrade attacks.</li>
              <li><strong>Encryption at Rest:</strong> All database data is encrypted at rest using AES-256 encryption. Our database provider (Neon) implements transparent data encryption (TDE) for all stored data, including backups.</li>
              <li><strong>Password Security:</strong> User passwords are never stored in plain text. We use bcrypt with a cost factor of 12 for password hashing, making brute-force attacks computationally infeasible.</li>
              <li><strong>Token Security:</strong> Sensitive tokens (password reset, email verification) are cryptographically hashed using SHA-256 before storage and expire after a limited time window.</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Infrastructure Security</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Secure Hosting:</strong> Our application is hosted on Vercel, which maintains SOC 2 Type II compliance and implements enterprise-grade security controls including network isolation and DDoS protection.</li>
              <li><strong>Database Security:</strong> Our PostgreSQL database is hosted on Neon, which provides SOC 2 Type II certified infrastructure with automatic failover, point-in-time recovery, and encrypted connections.</li>
              <li><strong>Environment Isolation:</strong> Development, staging, and production environments are fully isolated with separate databases and credentials to prevent accidental data exposure.</li>
              <li><strong>Secrets Management:</strong> All sensitive credentials and API keys are stored as encrypted environment variables, never in source code.</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Application Security</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Secure Authentication:</strong> We use industry-standard authentication protocols with secure, HTTP-only session cookies that cannot be accessed by client-side scripts.</li>
              <li><strong>Access Controls:</strong> Role-based access control (RBAC) ensures users can only view and modify information appropriate to their assigned role (Volunteer, Coordinator, Dispatcher, Administrator).</li>
              <li><strong>Input Validation:</strong> All user inputs are validated and sanitized to prevent SQL injection, cross-site scripting (XSS), and other injection attacks.</li>
              <li><strong>Rate Limiting:</strong> We implement rate limiting on authentication endpoints and public forms to prevent brute-force attacks and abuse.</li>
              <li><strong>Security Headers:</strong> We implement comprehensive security headers including Content Security Policy (CSP), X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.</li>
              <li><strong>CSRF Protection:</strong> Cross-site request forgery protection is implemented on all state-changing operations.</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Monitoring and Incident Response</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Security Logging:</strong> We maintain security logs for authentication events, access attempts, and administrative actions.</li>
              <li><strong>Anomaly Detection:</strong> Unusual patterns of access or failed authentication attempts trigger alerts for review.</li>
              <li><strong>Incident Response:</strong> We have procedures in place to respond to security incidents, including notification of affected users when required by law.</li>
              <li><strong>Regular Updates:</strong> We keep all software dependencies updated to address known security vulnerabilities.</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Third-Party Security Compliance</h3>
            <p className="text-gray-600 mb-2">Our infrastructure providers maintain the following security certifications:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Vercel:</strong> SOC 2 Type II, GDPR compliant</li>
              <li><strong>Neon (Database):</strong> SOC 2 Type II certified</li>
              <li><strong>Amazon SES (Email):</strong> SOC 1/2/3, ISO 27001, PCI DSS compliant</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Data Retention</h2>
            <p className="text-gray-600 mb-4">
              We retain your information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Volunteer Accounts:</strong> Account information is retained while your account is active and for a reasonable period thereafter</li>
              <li><strong>Shift and Training Records:</strong> Participation records are retained for historical tracking and reporting purposes</li>
            </ul>
            <p className="text-gray-600 mb-4">
              To request deletion of your data, please contact us using the information provided below.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Your Rights and Choices</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Access and Correction</h3>
            <p className="text-gray-600 mb-2">You can access and update your profile information at any time through the VMS dashboard. This includes:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Contact information</li>
              <li>Language preferences</li>
              <li>Zone preferences</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Data Deletion</h3>
            <p className="text-gray-600 mb-2">You may request deletion of your personal data by contacting us. Please note that:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>We may retain certain information as required by law or for legitimate business purposes</li>
              <li>Some information may be retained in anonymized form for statistical purposes</li>
              <li>Deletion of your account will remove your ability to participate as a volunteer</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Email Communications</h3>
            <p className="text-gray-600 mb-4">
              You can manage your email notification preferences through your profile settings. You may unsubscribe from non-essential communications while still receiving important operational emails.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Children&apos;s Privacy</h2>
            <p className="text-gray-600 mb-4">
              The VMS is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and believe your child has provided us with personal information, please contact us so we can take appropriate action.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Geographic Scope</h2>
            <p className="text-gray-600 mb-4">
              The VMS is designed for use in North Carolina, specifically in Durham, Orange, and Wake counties. The Service is hosted in the United States, and all data is processed and stored within the United States.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Changes to This Privacy Policy</h2>
            <p className="text-gray-600 mb-2">We may update this Privacy Policy from time to time. We will notify you of any changes by:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Posting the new Privacy Policy on the VMS</li>
              <li>Updating the &quot;Last Updated&quot; date at the top of this policy</li>
              <li>Sending an email notification for significant changes</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-gray-600 mb-4">
              <strong>RippleVMS</strong><br />
              Email: <a href="mailto:triangle.dispatch.group@gmail.com" className="text-cyan-600 hover:underline">triangle.dispatch.group@gmail.com</a><br />
              Website: <a href="https://nc.ripple-vms.com" className="text-cyan-600 hover:underline">nc.ripple-vms.com</a>
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Acknowledgment</h2>
            <p className="text-gray-600 mb-4">
              By using the RippleVMS Volunteer Management System, you acknowledge that you have read and understood this Privacy Policy and agree to be bound by its terms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
