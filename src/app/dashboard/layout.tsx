import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Server-side guard: redirect PENDING/REJECTED users
  // This is defense in depth alongside middleware
  if (session?.user) {
    const accountStatus = session.user.accountStatus;
    if (accountStatus === 'PENDING' || accountStatus === 'REJECTED') {
      redirect('/pending');
    }
  }

  return <>{children}</>;
}
