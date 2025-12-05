// Onboarding state management using localStorage
// Note: May migrate to database in the future for cross-device persistence

const STORAGE_KEYS = {
  hasSeenWelcome: 'vms_hasSeenWelcome',
  hasSeenPageTour: 'vms_hasSeenPageTour_',
  welcomeDismissedAt: 'vms_welcomeDismissedAt',
  allToursDismissed: 'vms_allToursDismissed',
} as const;

export function hasSeenWelcome(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEYS.hasSeenWelcome) === 'true';
}

export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.hasSeenWelcome, 'true');
  localStorage.setItem(STORAGE_KEYS.welcomeDismissedAt, new Date().toISOString());
}

export function resetWelcome(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.hasSeenWelcome);
  localStorage.removeItem(STORAGE_KEYS.welcomeDismissedAt);
}

export function hasSeenPageTour(pageName: string): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(`${STORAGE_KEYS.hasSeenPageTour}${pageName}`) === 'true';
}

export function markPageTourSeen(pageName: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_KEYS.hasSeenPageTour}${pageName}`, 'true');
}

export function resetPageTour(pageName: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${STORAGE_KEYS.hasSeenPageTour}${pageName}`);
}

export function resetAllTours(): void {
  if (typeof window === 'undefined') return;
  // Clear all tour-related keys
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('vms_hasSeenPageTour_')) {
      localStorage.removeItem(key);
    }
  });
}

export function resetAllOnboarding(): void {
  resetWelcome();
  resetAllTours();
}

export function hasAllToursDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.allToursDismissed) === 'true';
}

export function markAllToursDismissed(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.allToursDismissed, 'true');
}

export function resetAllToursDismissed(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.allToursDismissed);
}
