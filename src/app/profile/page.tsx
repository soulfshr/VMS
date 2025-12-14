'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';
import GuidedTour from '@/components/onboarding/GuidedTour';

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface UserZone {
  id: string;
  zoneId: string;
  isPrimary: boolean;
  zone: Zone;
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const TIME_SLOTS = [
  { label: 'Morning (6am-10am)', startTime: '06:00', endTime: '10:00' },
  { label: 'Midday (10am-2pm)', startTime: '10:00', endTime: '14:00' },
  { label: 'Afternoon (2pm-6pm)', startTime: '14:00', endTime: '18:00' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [allZones, setAllZones] = useState<Zone[]>([]);
  const [userZones, setUserZones] = useState<UserZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [phone, setPhone] = useState('');
  const [signalHandle, setSignalHandle] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('English');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [primaryZoneId, setPrimaryZoneId] = useState<string>('');
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/profile').then(res => res.json()),
    ])
      .then(([sessionData, profileData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        setUser(sessionData.user);

        if (profileData.user) {
          setPhone(profileData.user.phone || '');
          setSignalHandle(profileData.user.signalHandle || '');
          setPrimaryLanguage(profileData.user.primaryLanguage || 'English');
          setEmailNotifications(profileData.user.emailNotifications ?? true);
        }

        if (profileData.allZones) {
          setAllZones(profileData.allZones);
        }

        if (profileData.user?.zones) {
          setUserZones(profileData.user.zones);
          const zoneIds = profileData.user.zones.map((uz: UserZone) => uz.zoneId);
          setSelectedZoneIds(zoneIds);
          const primary = profileData.user.zones.find((uz: UserZone) => uz.isPrimary);
          if (primary) setPrimaryZoneId(primary.zoneId);
        }

        if (profileData.availability) {
          const avail: Record<string, boolean> = {};
          profileData.availability.forEach((slot: AvailabilitySlot) => {
            const key = `${slot.dayOfWeek}-${slot.startTime}`;
            avail[key] = true;
          });
          setAvailability(avail);
        }

        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const toggleAvailability = (dayIndex: number, startTime: string) => {
    const key = `${dayIndex}-${startTime}`;
    setAvailability(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds(prev => {
      if (prev.includes(zoneId)) {
        // If removing the primary zone, clear primary
        if (zoneId === primaryZoneId) {
          setPrimaryZoneId('');
        }
        return prev.filter(id => id !== zoneId);
      } else {
        // If first zone, make it primary
        if (prev.length === 0) {
          setPrimaryZoneId(zoneId);
        }
        return [...prev, zoneId];
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Save profile
      const profileRes = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          signalHandle,
          primaryLanguage,
          emailNotifications,
        }),
      });
      if (!profileRes.ok) throw new Error('Failed to save profile');

      // Save zones
      const zonesRes = await fetch('/api/profile/zones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneIds: selectedZoneIds,
          primaryZoneId,
        }),
      });
      if (!zonesRes.ok) throw new Error('Failed to save zones');

      // Convert availability to slots
      const slots: AvailabilitySlot[] = [];
      Object.entries(availability).forEach(([key, isAvailable]) => {
        if (isAvailable) {
          const [dayOfWeek, startTime] = key.split('-');
          const slot = TIME_SLOTS.find(s => s.startTime === startTime);
          if (slot) {
            slots.push({
              dayOfWeek: parseInt(dayOfWeek, 10),
              startTime: slot.startTime,
              endTime: slot.endTime,
            });
          }
        }
      });

      // Save availability
      const availRes = await fetch('/api/profile/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: slots }),
      });
      if (!availRes.ok) throw new Error('Failed to save availability');

      setSaveMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const roleColors: Record<string, string> = {
    ADMINISTRATOR: 'bg-purple-100 text-purple-700',
    COORDINATOR: 'bg-blue-100 text-blue-700',
    DISPATCHER: 'bg-orange-100 text-orange-700',
    VOLUNTEER: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <>
      {/* Guided Tour */}
      {user && (
        <GuidedTour
          pageName="profile"
          userRole={user.role}
          autoStart={true}
        />
      )}

    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
          <p className="text-gray-600">Manage your account information and preferences</p>
        </div>

        {saveMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            saveMessage.type === 'success'
              ? 'bg-cyan-50 border border-cyan-200 text-cyan-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {saveMessage.text}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-24 h-24 bg-cyan-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">
                {user.name.charAt(0)}
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${roleColors[user.role]}`}>
                {user.role}
              </span>
              {userZones.find(uz => uz.isPrimary) && (
                <p className="text-gray-500 mt-2">
                  Zone: {userZones.find(uz => uz.isPrimary)?.zone.name}
                </p>
              )}
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-xl border border-gray-200" data-tour="contact-info">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Contact Information</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone or Signal ID</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(919) 555-0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Signal Handle</label>
                  <input
                    type="text"
                    value={signalHandle}
                    onChange={(e) => setSignalHandle(e.target.value)}
                    placeholder="@signal_username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Language</label>
                  <select
                    value={primaryLanguage}
                    onChange={(e) => setPrimaryLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Email Preferences */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Email Preferences</h3>
              </div>
              <div className="p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="mt-1 w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Email Notifications</span>
                    <p className="text-sm text-gray-600 mt-1">
                      Receive email notifications for shift signups, confirmations, cancellations, and ICE sighting alerts.
                    </p>
                  </div>
                </label>
                <p className="text-xs text-gray-500 mt-3">
                  Note: Critical account-related emails will still be sent regardless of this setting.
                </p>
              </div>
            </div>

            {/* Weekly Availability */}
            <div className="bg-white rounded-xl border border-gray-200" data-tour="availability">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Weekly Availability</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Select your recurring availability to help coordinators schedule shifts.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-2"></th>
                        {DAYS.map(day => (
                          <th key={day} className="text-center py-2 px-1 font-medium text-gray-700">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map(slot => (
                        <tr key={slot.startTime}>
                          <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{slot.label}</td>
                          {DAYS.map((_, dayIndex) => {
                            const key = `${dayIndex}-${slot.startTime}`;
                            const isSelected = availability[key];
                            return (
                              <td key={dayIndex} className="text-center py-2 px-1">
                                <button
                                  onClick={() => toggleAvailability(dayIndex, slot.startTime)}
                                  className={`w-8 h-8 rounded transition-colors ${
                                    isSelected
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {isSelected ? '✓' : '—'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Zone Preferences */}
            <div className="bg-white rounded-xl border border-gray-200" data-tour="zone-assignment">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Zone Preferences</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Select zones you are willing to volunteer in. Click a selected zone again to make it your primary.
                </p>
                <div className="flex flex-wrap gap-2">
                  {allZones.map((zone) => {
                    const isSelected = selectedZoneIds.includes(zone.id);
                    const isPrimary = zone.id === primaryZoneId;
                    return (
                      <button
                        key={zone.id}
                        onClick={() => {
                          if (isSelected && !isPrimary) {
                            setPrimaryZoneId(zone.id);
                          } else {
                            toggleZone(zone.id);
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          isPrimary
                            ? 'bg-cyan-600 text-white ring-2 ring-cyan-300'
                            : isSelected
                            ? 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {zone.name}
                        {isPrimary && ' ★'}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  ★ indicates your primary zone
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
