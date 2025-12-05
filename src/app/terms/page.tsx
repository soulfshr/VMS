import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - RippleVMS',
  description: 'Terms of Service for RippleVMS',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">RippleVMS - Volunteer Management System</p>
          <p className="text-sm text-gray-400 mb-8">Last Updated: December 4, 2024</p>

          <div className="prose prose-gray max-w-none">
            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-600 mb-4">
              By accessing or using RippleVMS (&quot;VMS&quot; or &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you disagree with any part of these Terms, you may not access or use the Service.
            </p>
            <p className="text-gray-600 mb-4">
              These Terms apply to all users of the Service, including volunteers, coordinators, dispatchers, and administrators.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p className="text-gray-600 mb-2">
              The RippleVMS Volunteer Management System is a digital platform operated by RippleVMS (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) that provides:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Volunteer Coordination:</strong> Registration, scheduling, and management of volunteer activities</li>
              <li><strong>Shift Management:</strong> Creation, assignment, and tracking of volunteer shifts</li>
              <li><strong>Training Management:</strong> Scheduling and tracking of volunteer training sessions</li>
              <li><strong>Email Communications:</strong> Notifications for shifts, trainings, and announcements</li>
            </ul>
            <p className="text-gray-600 mb-4">
              The VMS serves RippleVMS&apos;s community initiatives in Durham, Orange, and Wake counties in North Carolina.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Eligibility</h2>
            <p className="text-gray-600 mb-2">To use the VMS as a registered volunteer, you must:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Be at least 18 years of age</li>
              <li>Provide accurate and complete registration information</li>
              <li>Agree to comply with these Terms and all applicable laws</li>
              <li>Complete any required training as specified by RippleVMS</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. User Accounts</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">4.1 Account Creation</h3>
            <p className="text-gray-600 mb-4">
              To access volunteer features, you must have an account created by a RippleVMS administrator or coordinator. You are responsible for maintaining the accuracy of your account information.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">4.2 Account Security</h3>
            <p className="text-gray-600 mb-2">You are responsible for:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access to your account</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">4.3 Account Termination</h3>
            <p className="text-gray-600 mb-2">We reserve the right to suspend or terminate your account at any time for:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Violation of these Terms</li>
              <li>Conduct that we determine is harmful to other users, RippleVMS, or the community</li>
              <li>Extended periods of inactivity</li>
              <li>Any other reason at our sole discretion</li>
            </ul>
            <p className="text-gray-600 mb-4">
              You may request account deletion at any time by contacting us.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Volunteer Responsibilities</h2>
            <p className="text-gray-600 mb-4">As a volunteer using the VMS, you agree to:</p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">5.1 Accurate Information</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Provide truthful and accurate information in your profile</li>
              <li>Keep your contact information up to date</li>
              <li>Accurately report your participation</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">5.2 Shift Commitments</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Honor shift RSVPs and commitments you have confirmed</li>
              <li>Notify coordinators as soon as possible if you cannot attend a confirmed shift</li>
              <li>Follow instructions from Zone Leads and Coordinators during shifts</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">5.3 Training Requirements</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Complete all required training before participating in shifts requiring such training</li>
              <li>Maintain current qualifications as required by RippleVMS policies</li>
              <li>Attend scheduled training sessions you have RSVP&apos;d to</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">5.4 Code of Conduct</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Treat all volunteers, staff, and community members with respect</li>
              <li>Follow RippleVMS&apos;s volunteer policies and guidelines</li>
              <li>Maintain confidentiality of sensitive information encountered during volunteer activities</li>
              <li>Not engage in any illegal activities during volunteer shifts</li>
              <li>Not represent yourself as a RippleVMS employee or authorized spokesperson unless specifically designated</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. Prohibited Activities</h2>
            <p className="text-gray-600 mb-4">You agree not to:</p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">6.1 Misuse of the Service</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Use the Service for any illegal purpose</li>
              <li>Submit false or misleading information</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">6.2 Unauthorized Use</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Share your account credentials with others</li>
              <li>Access accounts belonging to others</li>
              <li>Use automated systems (bots, scrapers) to access the Service</li>
              <li>Attempt to reverse engineer the Service</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Intellectual Property</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">7.1 RippleVMS Property</h3>
            <p className="text-gray-600 mb-4">
              The VMS, including its design, features, and content (excluding user-submitted content), is owned by RippleVMS and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Privacy</h2>
            <p className="text-gray-600 mb-4">
              Your use of the Service is also governed by our <a href="/privacy" className="text-teal-600 hover:underline">Privacy Policy</a>, which describes how we collect, use, and protect your personal information. By using the Service, you consent to the practices described in the Privacy Policy.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">9. Disclaimers</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">9.1 Service Provided &quot;As Is&quot;</h3>
            <p className="text-gray-600 mb-4 uppercase text-sm">
              THE VMS IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. SIEMBRA NC DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">9.2 No Guarantee of Availability</h3>
            <p className="text-gray-600 mb-4">
              We do not guarantee that the Service will be available at all times or without interruption. We may modify, suspend, or discontinue the Service at any time without notice.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">9.3 Volunteer Activities</h3>
            <p className="text-gray-600 mb-4 uppercase text-sm">
              SIEMBRA NC DOES NOT GUARANTEE YOUR SAFETY DURING VOLUNTEER ACTIVITIES. VOLUNTEER PARTICIPATION IS AT YOUR OWN RISK. YOU ACKNOWLEDGE THAT CERTAIN VOLUNTEER ACTIVITIES MAY INVOLVE INHERENT RISKS.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">10. Limitation of Liability</h2>
            <p className="text-gray-600 mb-2 uppercase text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SIEMBRA NC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1 uppercase text-sm">
              <li>ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
              <li>ANY LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES</li>
              <li>ANY DAMAGES RESULTING FROM YOUR USE OR INABILITY TO USE THE SERVICE</li>
              <li>ANY DAMAGES RESULTING FROM UNAUTHORIZED ACCESS TO YOUR ACCOUNT</li>
            </ul>
            <p className="text-gray-600 mb-4 text-sm">
              Some jurisdictions do not allow limitations on implied warranties or exclusion of liability for certain damages. If these laws apply to you, some or all of the above disclaimers or limitations may not apply.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">11. Indemnification</h2>
            <p className="text-gray-600 mb-2">
              You agree to indemnify, defend, and hold harmless RippleVMS, its officers, directors, employees, agents, and volunteers from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys&apos; fees) arising out of or related to:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of a third party</li>
              <li>Your volunteer activities</li>
            </ul>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">12. Third-Party Services</h2>
            <p className="text-gray-600 mb-4">
              The VMS may contain links to or integrations with third-party services (such as Google Maps). These third-party services are governed by their own terms of service and privacy policies. RippleVMS is not responsible for the content, policies, or practices of any third-party services.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">13. Modifications to Terms</h2>
            <p className="text-gray-600 mb-2">We reserve the right to modify these Terms at any time. If we make material changes, we will notify you by:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Posting the updated Terms on the VMS</li>
              <li>Updating the &quot;Last Updated&quot; date</li>
              <li>Sending an email notification for significant changes</li>
            </ul>
            <p className="text-gray-600 mb-4">
              Your continued use of the Service after changes become effective constitutes your acceptance of the revised Terms.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">14. Governing Law</h2>
            <p className="text-gray-600 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of North Carolina, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the state and federal courts located in North Carolina.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">15. Dispute Resolution</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">15.1 Informal Resolution</h3>
            <p className="text-gray-600 mb-4">
              Before initiating any formal dispute resolution, you agree to first contact us and attempt to resolve the dispute informally. Most concerns can be resolved through direct communication.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">16. General Provisions</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">16.1 Entire Agreement</h3>
            <p className="text-gray-600 mb-4">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and RippleVMS regarding the Service.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">16.2 Waiver</h3>
            <p className="text-gray-600 mb-4">
              Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">16.3 Severability</h3>
            <p className="text-gray-600 mb-4">
              If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will continue in effect.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">16.4 Notices</h3>
            <p className="text-gray-600 mb-4">
              We may provide notices to you via email to the address associated with your account or by posting on the Service.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">17. Contact Information</h2>
            <p className="text-gray-600 mb-4">
              If you have questions about these Terms, please contact us at:
            </p>
            <p className="text-gray-600 mb-4">
              <strong>RippleVMS</strong><br />
              Email: <a href="mailto:triangle.dispatch.group@gmail.com" className="text-teal-600 hover:underline">triangle.dispatch.group@gmail.com</a><br />
              Website: <a href="https://nc.ripple-vms.com" className="text-teal-600 hover:underline">nc.ripple-vms.com</a>
            </p>
            <p className="text-gray-600 mb-4">
              For general inquiries about volunteer activities, please contact your assigned coordinator.
            </p>

            <hr className="my-6" />

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">18. Acknowledgment</h2>
            <p className="text-gray-600 mb-2">
              By creating an account or using the RippleVMS Volunteer Management System, you acknowledge that:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>You have read and understood these Terms of Service</li>
              <li>You agree to be bound by these Terms</li>
              <li>You are at least 18 years of age</li>
              <li>You consent to the practices described in our Privacy Policy</li>
            </ul>

            <hr className="my-6" />

            <p className="text-gray-500 text-center italic mt-8">
              Thank you for being part of RippleVMS&apos;s community efforts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
