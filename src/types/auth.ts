// Auth types for RippleVMS

export type UserRole = 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR';

export type Qualification = 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER';

export interface DevUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  zone?: string;
  phone?: string;
  primaryLanguage?: string;
  qualifications?: Qualification[];
}

export interface AuthSession {
  user: DevUser;
  expiresAt: number;
}

// Development users for testing
export const DEV_USERS: DevUser[] = [
  {
    id: 'admin-1',
    name: 'Admin User',
    role: 'ADMINISTRATOR',
    email: 'admin@test.com',
    phone: '(919) 555-0100',
  },
  {
    id: 'coord-1',
    name: 'Coordinator User',
    role: 'COORDINATOR',
    email: 'coord@test.com',
    phone: '(919) 555-0101',
  },
  {
    id: 'disp-1',
    name: 'Dispatcher User',
    role: 'DISPATCHER',
    email: 'disp@test.com',
    phone: '(919) 555-0102',
  },
  {
    id: 'vol-1',
    name: 'Maria Rodriguez',
    role: 'VOLUNTEER',
    zone: 'Durham 1',
    email: 'maria@test.com',
    phone: '(919) 555-0123',
    primaryLanguage: 'Spanish',
  },
  {
    id: 'vol-2',
    name: 'James Kim',
    role: 'VOLUNTEER',
    zone: 'Durham 2',
    email: 'james@test.com',
    phone: '(919) 555-0124',
    primaryLanguage: 'English',
  },
  {
    id: 'vol-3',
    name: 'Ana Lopez',
    role: 'VOLUNTEER',
    zone: 'Orange 1',
    email: 'ana@test.com',
    phone: '(919) 555-0125',
    primaryLanguage: 'Spanish',
  },
  {
    id: 'vol-4',
    name: 'David Chen',
    role: 'VOLUNTEER',
    zone: 'Wake 1',
    email: 'david@test.com',
    phone: '(919) 555-0126',
    primaryLanguage: 'English',
  },
  {
    id: 'vol-5',
    name: 'Patricia Williams',
    role: 'VOLUNTEER',
    zone: 'Wake 3',
    email: 'patricia@test.com',
    phone: '(919) 555-0127',
    primaryLanguage: 'English',
  },
  {
    id: 'vol-rachel',
    name: 'Rachel Kau',
    role: 'VOLUNTEER',
    email: 'rachelkaufman26@gmail.com',
    primaryLanguage: 'English',
  },
  {
    id: 'vol-josh',
    name: 'Josh Cottrell',
    role: 'VOLUNTEER',
    email: 'joshcottrell@gmail.com',
    primaryLanguage: 'English',
  },
];

// Helper to get user by ID
export function getDevUserById(id: string): DevUser | undefined {
  return DEV_USERS.find(user => user.id === id);
}

// Helper to get users by role
export function getDevUsersByRole(role: UserRole): DevUser[] {
  return DEV_USERS.filter(user => user.role === role);
}
