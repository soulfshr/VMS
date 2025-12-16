import 'next-auth';
import type { Role, Qualification, AccountStatus } from '@/generated/prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      zone?: string;
      qualifications: Qualification[];
      accountStatus?: AccountStatus;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    zone?: string;
    qualifications: Qualification[];
    accountStatus?: AccountStatus;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: Role;
    zone?: string;
    qualifications: Qualification[];
    accountStatus?: AccountStatus;
  }
}
