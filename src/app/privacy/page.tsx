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
          <p className="text-sm text-gray-400 mb-8">Last Updated: December 4, 2024</p>

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
            <p className="text-gray-600 mb-2">We implement appropriate technical and organizational measures to protect your personal information, including:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Encryption in Transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS/HTTPS</li>
              <li><strong>Encryption at Rest:</strong> Database data is encrypted at rest</li>
              <li><strong>Secure Authentication:</strong> We use NextAuth.js for secure session management</li>
              <li><strong>Access Controls:</strong> Role-based access ensures users can only view information appropriate to their role</li>
              <li><strong>Password Security:</strong> Passwords are hashed using bcrypt with appropriate salt rounds</li>
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
              Email: <a href="mailto:triangle.dispatch.group@gmail.com" className="text-teal-600 hover:underline">triangle.dispatch.group@gmail.com</a><br />
              Website: <a href="https://nc.ripple-vms.com" className="text-teal-600 hover:underline">nc.ripple-vms.com</a>
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
