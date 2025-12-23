/**
 * Organization Setup Templates
 * Pre-configured templates for common organization types
 */

export type SchedulingModel = 'COVERAGE_GRID' | 'SHIFTS';

export interface QualifiedRoleTemplate {
  name: string;
  slug: string;
  description: string;
  color: string;
  countsTowardMinimum: boolean;
  sortOrder: number;
}

export interface ShiftTypeRoleRequirement {
  roleSlug: string;  // References qualifiedRole.slug
  minRequired: number;
  maxAllowed?: number;
}

export interface ShiftTypeTemplate {
  name: string;
  slug: string;
  defaultMinVolunteers: number;
  defaultIdealVolunteers: number;
  defaultMaxVolunteers: number;
  roleRequirements: ShiftTypeRoleRequirement[];
}

export interface OrgTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  schedulingModel: SchedulingModel;
  qualifiedRoles: QualifiedRoleTemplate[];
  shiftTypes: ShiftTypeTemplate[];
}

// Color palette for roles
const COLORS = {
  purple: '#8b5cf6',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  pink: '#ec4899',
  indigo: '#6366f1',
};

/**
 * Legal Observer Template (AWCLO-style)
 * For organizations doing clinic observation/support
 */
export const LEGAL_OBSERVER_TEMPLATE: OrgTemplate = {
  id: 'legal-observer',
  name: 'Legal Observer',
  description: 'Clinic observation and legal support with shift-based scheduling',
  icon: '⚖️',
  schedulingModel: 'SHIFTS',
  qualifiedRoles: [
    {
      name: 'Shift Lead',
      slug: 'SHIFT_LEAD',
      description: 'Leads the observation shift, coordinates team communication',
      color: COLORS.purple,
      countsTowardMinimum: true,
      sortOrder: 0,
    },
    {
      name: 'Observer',
      slug: 'OBSERVER',
      description: 'Observes and documents activities at the location',
      color: COLORS.blue,
      countsTowardMinimum: true,
      sortOrder: 1,
    },
    {
      name: 'Coordinator',
      slug: 'COORDINATOR',
      description: 'Manages scheduling and volunteer assignments',
      color: COLORS.cyan,
      countsTowardMinimum: false,
      sortOrder: 2,
    },
  ],
  shiftTypes: [
    {
      name: 'Clinic Support',
      slug: 'clinic-support',
      defaultMinVolunteers: 2,
      defaultIdealVolunteers: 3,
      defaultMaxVolunteers: 4,
      roleRequirements: [
        { roleSlug: 'SHIFT_LEAD', minRequired: 1 },
        { roleSlug: 'OBSERVER', minRequired: 1 },
      ],
    },
  ],
};

/**
 * Escort Template (AWCE-style)
 * For organizations providing escort services
 */
export const ESCORT_TEMPLATE: OrgTemplate = {
  id: 'escort',
  name: 'Escort',
  description: 'Escort services with shift-based scheduling',
  icon: '🤝',
  schedulingModel: 'SHIFTS',
  qualifiedRoles: [
    {
      name: 'Shift Lead',
      slug: 'SHIFT_LEAD',
      description: 'Leads the escort shift, coordinates team activities',
      color: COLORS.purple,
      countsTowardMinimum: true,
      sortOrder: 0,
    },
    {
      name: 'Escort',
      slug: 'ESCORT',
      description: 'Provides escort support to clients',
      color: COLORS.green,
      countsTowardMinimum: true,
      sortOrder: 1,
    },
    {
      name: 'Coordinator',
      slug: 'COORDINATOR',
      description: 'Manages scheduling and volunteer assignments',
      color: COLORS.cyan,
      countsTowardMinimum: false,
      sortOrder: 2,
    },
  ],
  shiftTypes: [
    {
      name: 'Escort Shift',
      slug: 'escort-shift',
      defaultMinVolunteers: 2,
      defaultIdealVolunteers: 3,
      defaultMaxVolunteers: 5,
      roleRequirements: [
        { roleSlug: 'SHIFT_LEAD', minRequired: 1 },
        { roleSlug: 'ESCORT', minRequired: 1 },
      ],
    },
  ],
};

/**
 * Community Patrol Template (Siembra NC-style)
 * For organizations doing community monitoring with zone-based coverage
 */
export const COMMUNITY_PATROL_TEMPLATE: OrgTemplate = {
  id: 'community-patrol',
  name: 'Community Patrol',
  description: 'Zone-based community monitoring with continuous coverage grid',
  icon: '🛡️',
  schedulingModel: 'COVERAGE_GRID',
  qualifiedRoles: [
    {
      name: 'Dispatcher',
      slug: 'DISPATCHER',
      description: 'Coordinates field response and manages communications',
      color: COLORS.orange,
      countsTowardMinimum: false,
      sortOrder: 0,
    },
    {
      name: 'Zone Lead',
      slug: 'ZONE_LEAD',
      description: 'Leads zone coverage and coordinates with patrol volunteers',
      color: COLORS.purple,
      countsTowardMinimum: true,
      sortOrder: 1,
    },
    {
      name: 'Verifier',
      slug: 'VERIFIER',
      description: 'Patrols assigned zone and verifies reports',
      color: COLORS.blue,
      countsTowardMinimum: true,
      sortOrder: 2,
    },
    {
      name: 'Coordinator',
      slug: 'COORDINATOR',
      description: 'Manages scheduling, volunteers, and overall operations',
      color: COLORS.cyan,
      countsTowardMinimum: false,
      sortOrder: 3,
    },
  ],
  shiftTypes: [
    {
      name: 'Patrol',
      slug: 'patrol',
      defaultMinVolunteers: 2,
      defaultIdealVolunteers: 4,
      defaultMaxVolunteers: 6,
      roleRequirements: [
        { roleSlug: 'ZONE_LEAD', minRequired: 1 },
        { roleSlug: 'VERIFIER', minRequired: 1 },
      ],
    },
    {
      name: 'On-Call Response',
      slug: 'on-call',
      defaultMinVolunteers: 1,
      defaultIdealVolunteers: 2,
      defaultMaxVolunteers: 4,
      roleRequirements: [
        { roleSlug: 'VERIFIER', minRequired: 1 },
      ],
    },
  ],
};

/**
 * Custom Template
 * Start from scratch with no pre-configured roles or shift types
 */
export const CUSTOM_TEMPLATE: OrgTemplate = {
  id: 'custom',
  name: 'Custom',
  description: 'Start from scratch with custom configuration',
  icon: '⚙️',
  schedulingModel: 'SHIFTS',
  qualifiedRoles: [
    {
      name: 'Coordinator',
      slug: 'COORDINATOR',
      description: 'Manages scheduling and volunteer assignments',
      color: COLORS.cyan,
      countsTowardMinimum: false,
      sortOrder: 0,
    },
  ],
  shiftTypes: [],
};

/**
 * All available templates
 */
export const ORG_TEMPLATES: OrgTemplate[] = [
  LEGAL_OBSERVER_TEMPLATE,
  ESCORT_TEMPLATE,
  COMMUNITY_PATROL_TEMPLATE,
  CUSTOM_TEMPLATE,
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): OrgTemplate | undefined {
  return ORG_TEMPLATES.find(t => t.id === id);
}

/**
 * Get default template
 */
export function getDefaultTemplate(): OrgTemplate {
  return CUSTOM_TEMPLATE;
}
