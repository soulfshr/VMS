import HomeClient from './HomeClient';

// Force dynamic rendering to prevent SSR prerendering issues with React 19.2.1
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <HomeClient />;
}
