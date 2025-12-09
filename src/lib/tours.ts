// Tour definitions for guided tours
// Note: react-joyride types are defined locally until React 19 support is added

export type PageName = 'dashboard' | 'shifts' | 'schedule' | 'profile' | 'volunteers' | 'trainings' | 'admin';

// Local type definition matching react-joyride's Step interface
export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center';
  disableBeacon?: boolean;
  styles?: {
    options?: {
      primaryColor?: string;
    };
  };
}

export interface TourDefinition {
  name: PageName;
  title: string;
  steps: TourStep[];
}

// Helper to create consistent step styles
const createStep = (
  target: string,
  title: string,
  content: string,
  placement: TourStep['placement'] = 'bottom'
): TourStep => ({
  target,
  title,
  content,
  placement,
  disableBeacon: true,
  styles: {
    options: {
      primaryColor: '#0d9488', // cyan-600
    },
  },
});

export const dashboardTour: TourDefinition = {
  name: 'dashboard',
  title: 'Dashboard Tour',
  steps: [
    createStep(
      '[data-tour="welcome-header"]',
      'Welcome!',
      'This is your personal dashboard. Here you can see your upcoming shifts, quick stats, and important actions.',
      'bottom'
    ),
    createStep(
      '[data-tour="quick-stats"]',
      'Quick Stats',
      'Track your volunteer activity at a glance: upcoming shifts, hours this month, training progress, and available shifts to sign up for.',
      'bottom'
    ),
    createStep(
      '[data-tour="upcoming-shifts"]',
      'Your Upcoming Shifts',
      'See your confirmed and pending shifts here. Click "View All" to see your complete schedule.',
      'right'
    ),
    createStep(
      '[data-tour="quick-actions"]',
      'Quick Actions',
      'Access common tasks quickly: browse shifts, update your availability, and view training modules.',
      'left'
    ),
    createStep(
      '[data-tour="coverage-overview"]',
      'Coverage Overview',
      'Coordinators can see weekly coverage at a glance. Green means fully staffed, yellow is partial, and red needs attention.',
      'bottom'
    ),
  ],
};

export const shiftsTour: TourDefinition = {
  name: 'shifts',
  title: 'Shifts Page Tour',
  steps: [
    createStep(
      '[data-tour="shift-filters"]',
      'Filter Shifts',
      'Use these filters to narrow down shifts by type, zone, or date. This helps you find shifts that match your availability.',
      'bottom'
    ),
    createStep(
      '[data-tour="shift-list"]',
      'Available Shifts',
      'Browse available shifts here. Each row shows the date, time, type, zone, and current signup status.',
      'top'
    ),
    createStep(
      '[data-tour="rsvp-button"]',
      'Sign Up for Shifts',
      'Click "Sign Up" to RSVP for a shift. Depending on settings, your RSVP may be confirmed immediately or require coordinator approval.',
      'left'
    ),
    createStep(
      '[data-tour="shift-select"]',
      'Multi-Select (Coordinators)',
      'Coordinators can select multiple shifts using these checkboxes to perform bulk actions like confirming RSVPs.',
      'right'
    ),
    createStep(
      '[data-tour="bulk-actions"]',
      'Bulk Actions',
      'After selecting shifts, use the toolbar that appears to confirm pending RSVPs or perform other bulk operations.',
      'bottom'
    ),
  ],
};

export const scheduleTour: TourDefinition = {
  name: 'schedule',
  title: 'Schedule Page Tour',
  steps: [
    createStep(
      '[data-tour="week-nav"]',
      'Week Navigation',
      'Use these arrows to move between weeks. See coverage for past weeks or plan ahead.',
      'bottom'
    ),
    createStep(
      '[data-tour="county-filter"]',
      'County Filter',
      'Filter the schedule view by county to focus on specific zones.',
      'bottom'
    ),
    createStep(
      '[data-tour="coverage-legend"]',
      'Coverage Legend',
      'Cells are color-coded: green means fully staffed (dispatcher + all zone leads), yellow is partial coverage, red needs attention.',
      'bottom'
    ),
    createStep(
      '[data-tour="schedule-grid"]',
      'Schedule Grid',
      'Each cell shows a time slot. Click any cell to see details about who is assigned and what positions need to be filled.',
      'top'
    ),
    createStep(
      '[data-tour="dispatcher-assign"]',
      'Dispatcher Assignment',
      'Coordinators can assign dispatchers and zone leads by clicking on a cell and using the assignment modal.',
      'left'
    ),
  ],
};

export const profileTour: TourDefinition = {
  name: 'profile',
  title: 'Profile Page Tour',
  steps: [
    createStep(
      '[data-tour="contact-info"]',
      'Contact Information',
      'Keep your contact details up to date so coordinators can reach you for shift communications.',
      'bottom'
    ),
    createStep(
      '[data-tour="zone-assignment"]',
      'Zone Assignment',
      'Your primary zone determines which shifts appear first. You can be assigned to multiple zones.',
      'bottom'
    ),
    createStep(
      '[data-tour="availability"]',
      'Weekly Availability',
      'Set your general availability for each day of the week. This helps coordinators know when you can be scheduled.',
      'top'
    ),
    createStep(
      '[data-tour="training-progress"]',
      'Training Progress',
      'Track your completion of required and optional training modules. Complete all required trainings to be fully active.',
      'top'
    ),
  ],
};

export const volunteersTour: TourDefinition = {
  name: 'volunteers',
  title: 'Volunteers Page Tour',
  steps: [
    createStep(
      '[data-tour="volunteer-search"]',
      'Search Volunteers',
      'Search by name or email to quickly find specific volunteers.',
      'bottom'
    ),
    createStep(
      '[data-tour="volunteer-filters"]',
      'Filter by Zone or Role',
      'Filter the list by zone or role to see specific groups of volunteers.',
      'bottom'
    ),
    createStep(
      '[data-tour="volunteer-row"]',
      'Volunteer Details',
      'Each row shows the volunteer\'s zone, role, qualifications, and recent activity.',
      'top'
    ),
    createStep(
      '[data-tour="bulk-import"]',
      'Bulk Import',
      'Use the import feature to add multiple volunteers at once from a CSV file.',
      'left'
    ),
  ],
};

export const trainingsTour: TourDefinition = {
  name: 'trainings',
  title: 'Trainings Page Tour',
  steps: [
    createStep(
      '[data-tour="training-list"]',
      'Available Trainings',
      'Browse all training modules. Required trainings must be completed before you can sign up for certain shifts.',
      'top'
    ),
    createStep(
      '[data-tour="training-progress"]',
      'Your Progress',
      'See which trainings you\'ve completed and which are still pending.',
      'bottom'
    ),
    createStep(
      '[data-tour="training-rsvp"]',
      'Sign Up for Training',
      'Click to RSVP for in-person training sessions or access online training materials.',
      'left'
    ),
  ],
};

export const adminTour: TourDefinition = {
  name: 'admin',
  title: 'Admin Page Tour',
  steps: [
    createStep(
      '[data-tour="admin-settings"]',
      'System Settings',
      'Configure global settings like RSVP auto-confirmation mode and organization details.',
      'bottom'
    ),
    createStep(
      '[data-tour="zone-management"]',
      'Zone Management',
      'Add, edit, or remove zones. Assign Signal group links for real-time coordination.',
      'top'
    ),
    createStep(
      '[data-tour="shift-types"]',
      'Shift Types',
      'Configure shift types and their requirements (which qualifications are needed).',
      'top'
    ),
  ],
};

// Map of all tours
export const tours: Record<PageName, TourDefinition> = {
  dashboard: dashboardTour,
  shifts: shiftsTour,
  schedule: scheduleTour,
  profile: profileTour,
  volunteers: volunteersTour,
  trainings: trainingsTour,
  admin: adminTour,
};

// Get tour for a specific page
export function getTour(pageName: PageName): TourDefinition | null {
  return tours[pageName] || null;
}

// Get steps for coordinator-only features
export function filterStepsForRole(steps: TourStep[], role: string): TourStep[] {
  const coordinatorTargets = [
    '[data-tour="coverage-overview"]',
    '[data-tour="shift-select"]',
    '[data-tour="bulk-actions"]',
    '[data-tour="dispatcher-assign"]',
    '[data-tour="bulk-import"]',
  ];

  const adminTargets = [
    '[data-tour="admin-settings"]',
    '[data-tour="zone-management"]',
    '[data-tour="shift-types"]',
  ];

  return steps.filter(step => {
    const target = step.target;

    // Admin-only targets
    if (adminTargets.includes(target) && role !== 'ADMINISTRATOR') {
      return false;
    }

    // Leadership targets (Coordinator/Dispatcher)
    if (coordinatorTargets.includes(target) &&
        role !== 'COORDINATOR' && role !== 'DISPATCHER' && role !== 'ADMINISTRATOR') {
      return false;
    }

    return true;
  });
}
