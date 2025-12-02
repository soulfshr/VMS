'use client';

import { resetWelcome } from '@/lib/onboarding';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  userRole: string;
  onStartTour?: () => void;
  onRestartWelcome: () => void;
}

interface PageHelp {
  title: string;
  description: string;
  tips: string[];
  hasTour: boolean;
}

const pageHelpContent: Record<string, PageHelp> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Your home base for all volunteer activities.',
    tips: [
      'Quick stats show your upcoming shifts, hours, and training progress',
      'The "Upcoming Shifts" section shows your next scheduled shifts',
      'Use Quick Actions to navigate to common tasks',
      'Coordinators see weekly coverage stats at the top',
    ],
    hasTour: true,
  },
  shifts: {
    title: 'Shifts',
    description: 'Browse and sign up for available volunteer shifts.',
    tips: [
      'Use filters to find shifts by type or zone',
      'Click a shift to view details and sign up',
      'Toggle between list and card views',
      'Coordinators can select multiple shifts for bulk actions',
      'Look for the "pending" filter to review RSVPs (coordinators)',
    ],
    hasTour: true,
  },
  schedule: {
    title: 'Schedule',
    description: 'Weekly view of dispatcher and zone lead assignments.',
    tips: [
      'Each cell shows coverage for a time block',
      'Green = full coverage, Yellow = partial, Gray = none',
      'Click any cell to view or edit assignments (coordinators)',
      'Use week navigation to view past or future weeks',
      'Filter by county to focus on specific areas',
    ],
    hasTour: true,
  },
  profile: {
    title: 'Profile',
    description: 'Manage your personal information and availability.',
    tips: [
      'Keep your contact information up to date',
      'Set your weekly availability for shift scheduling',
      'Select your preferred zones for volunteering',
      'View your training progress and certifications',
    ],
    hasTour: true,
  },
  volunteers: {
    title: 'Volunteers',
    description: 'Manage volunteer roster and assignments.',
    tips: [
      'Search volunteers by name or email',
      'Filter by role, zone, or qualification',
      'Click a volunteer to view/edit their profile',
      'Use bulk import to add multiple volunteers at once',
      'Manage roles and qualifications from volunteer profiles',
    ],
    hasTour: true,
  },
  trainings: {
    title: 'Trainings',
    description: 'View and manage training sessions.',
    tips: [
      'Browse available training sessions',
      'Sign up for upcoming trainings',
      'Coordinators can create and manage training sessions',
      'Track volunteer training completion',
    ],
    hasTour: true,
  },
  admin: {
    title: 'Admin Settings',
    description: 'System configuration and management.',
    tips: [
      'Manage zones and their Signal group links',
      'Configure shift types and requirements',
      'Set RSVP mode (auto-confirm vs manual approval)',
      'View system-wide statistics',
    ],
    hasTour: true,
  },
};

const defaultHelp: PageHelp = {
  title: 'Help',
  description: 'Get help with using the VMS.',
  tips: [
    'Use the navigation menu to access different sections',
    'Click the help button on any page for context-specific tips',
    'Contact your coordinator if you need assistance',
  ],
  hasTour: false,
};

export default function HelpDrawer({
  isOpen,
  onClose,
  currentPage,
  onStartTour,
  onRestartWelcome,
}: HelpDrawerProps) {
  const help = pageHelpContent[currentPage] || defaultHelp;

  const handleRestartWelcome = () => {
    resetWelcome();
    onRestartWelcome();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[90] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-[95] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Help</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-[calc(100%-64px)]">
          {/* Page title */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{help.title}</h3>
            <p className="text-gray-600 text-sm">{help.description}</p>
          </div>

          {/* Tips */}
          <div className="mb-8">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              Quick Tips
            </h4>
            <ul className="space-y-3">
              {help.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {help.hasTour && onStartTour && (
              <button
                onClick={() => {
                  onStartTour();
                  onClose();
                }}
                className="w-full py-2.5 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Take a Tour
              </button>
            )}

            <button
              onClick={handleRestartWelcome}
              className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Restart Welcome Guide
            </button>
          </div>

          {/* Full User Guide Link */}
          <div className="mt-6">
            <a
              href="/guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              View Full User Guide
            </a>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Need more help? Contact your coordinator or{' '}
              <a href="mailto:support@siembranc.org" className="text-teal-600 hover:underline">
                email support
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
