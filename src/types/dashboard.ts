// Dashboard-related type definitions

export interface Zone {
  id: string;
  name: string;
  signalGroup: string | null;
}

export interface UserZone {
  isPrimary: boolean;
  zone: Zone;
}

export interface ZoneStats {
  zone: Zone;
  upcomingShifts: number;
  activeVolunteers: number;
  openSlots: number;
}

export interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface UpcomingShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftStatus: string;
  shiftType: {
    name: string;
    color: string;
  } | null;
  zone: {
    name: string;
  } | null;
  signedUpCount: number;
  minVolunteers: number;
  maxVolunteers: number;
  userRsvp?: {
    status: string;
    isZoneLead?: boolean;
    roleName?: string;
    roleColor?: string;
  } | null;
}

export interface QualifiedOpening {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: {
    name: string;
    color: string;
  } | null;
  zone: {
    id: string;
    name: string;
  } | null;
  needsZoneLead: boolean;
  spotsRemaining: number;
}

export interface RoleOpeningItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: {
    name: string;
    color: string;
  } | null;
  zone: {
    id: string;
    name: string;
  } | null;
  spotsRemaining: number;
  isUserZone: boolean;
}

export interface RoleOpenings {
  roleId: string;
  roleName: string;
  roleSlug: string;
  roleColor: string;
  count: number;
  openings: RoleOpeningItem[];
}

export interface QualifiedOpeningsData {
  userZones: QualifiedOpening[];
  otherZones: QualifiedOpening[];
  userQualifications: string[];
  byRole?: RoleOpenings[];
}

export interface DispatcherSlotOpening {
  county: string;
  date: string;
  startTime: string;
  endTime: string;
  startHour: number;
  endHour: number;
  zoneCount: number;
  zones: string[];
}

export interface NextShiftTeammate {
  id: string;
  name: string | null;
  qualifiedRole: QualifiedRole | null;
}

export interface DispatchCoordinator {
  id: string;
  name: string;
  isPrimary: boolean;
  notes: string | null;
}

export interface NextShift {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: {
    name: string;
    color: string;
  } | null;
  zone: {
    id: string;
    name: string;
  } | null;
  userRole?: {
    name: string | null;
    color: string | null;
    isZoneLead: boolean;
  };
  teammates: NextShiftTeammate[];
  dispatchCoordinators: DispatchCoordinator[];
  dispatcher: {
    id: string;
    name: string;
    notes: string | null;
  } | null;
}

export interface VolunteerStats {
  myShifts: number;
  hoursThisMonth: number;
  zones: UserZone[];
  qualifiedRoles: QualifiedRole[];
}

export interface WeekCoverage {
  totalShifts: number;
  totalSlots: number;
  filledSlots: number;
  openSlots: number;
  shiftsNeedingHelp: number;
  coveragePercent: number;
}

export interface CoordinatorStats {
  pendingRsvps: number;
  weeklyCoverage?: {
    thisWeek: WeekCoverage;
    nextWeek: WeekCoverage;
  };
}

export interface OrgStats {
  totalVolunteers: number;
  activeThisMonth: number;
  totalZones: number;
  scheduledShifts: number;
  trainingCompliance: number;
}

export interface UpcomingDispatcherAssignment {
  id: string;
  county: string;
  date: string;
  startTime: string;
  endTime: string;
  isBackup: boolean;
  notes: string | null;
}

export interface RegionalLeadOpening {
  date: string;
  shiftCount: number;
  hasExistingAssignment: boolean;
}

export interface UpcomingRegionalLeadAssignment {
  id: string;
  date: string;
  isPrimary: boolean;
  notes: string | null;
}

export interface UpcomingTraining {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  trainingType: {
    name: string;
    color: string;
  } | null;
  currentAttendees: number;
  maxAttendees: number | null;
  userRsvp?: {
    status: string;
  } | null;
}

export interface DashboardData {
  upcomingShifts: UpcomingShift[];
  qualifiedOpenings: QualifiedOpeningsData;
  dispatcherSlotOpenings?: DispatcherSlotOpening[];
  dispatcherSchedulingMode?: 'REGIONAL' | 'COUNTY' | 'ZONE';
  upcomingDispatcherAssignments?: UpcomingDispatcherAssignment[];
  regionalLeadOpenings?: RegionalLeadOpening[];
  upcomingRegionalLeadAssignments?: UpcomingRegionalLeadAssignment[];
  volunteerStats: VolunteerStats;
  coordinatorStats?: CoordinatorStats;
  zoneStats?: ZoneStats;
  orgStats?: OrgStats;
  nextShift?: NextShift | null;
  autoConfirmRsvp?: boolean;
  schedulingMode?: 'SIMPLE' | 'FULL';
}

// Unified assignment type for the schedule table
export type UnifiedAssignment = {
  type: 'shift' | 'dispatcher' | 'coordinator';
  id: string;
  date: Date;
  sortKey: number;
  data: UpcomingShift | UpcomingDispatcherAssignment | UpcomingRegionalLeadAssignment;
};

// Openings tab type
export type OpeningsTab = 'shifts' | 'dispatch' | 'coordinator';
