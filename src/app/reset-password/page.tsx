import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export const metadata = {
  title: 'Reset Password | RippleVMS',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
