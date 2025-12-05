import { Suspense } from 'react';
import ForgotPasswordClient from './ForgotPasswordClient';

export const metadata = {
  title: 'Forgot Password | RippleVMS',
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
