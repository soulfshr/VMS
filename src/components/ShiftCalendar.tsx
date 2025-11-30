'use client';

import { useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';

// Setup localizer for react-big-calendar
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    type: string;
    status: string;
    zone: string;
    spotsLeft: number;
    confirmedCount: number;
    maxVolunteers: number;
  };
}

// Event colors by type
const typeColors: Record<string, { bg: string; border: string }> = {
  PATROL: { bg: '#dbeafe', border: '#3b82f6' },
  COLLECTION: { bg: '#f3e8ff', border: '#a855f7' },
  ON_CALL_FIELD_SUPPORT: { bg: '#ffedd5', border: '#f97316' },
};

const statusColors: Record<string, { bg: string; border: string }> = {
  CANCELLED: { bg: '#fee2e2', border: '#ef4444' },
  DRAFT: { bg: '#f3f4f6', border: '#9ca3af' },
};

interface ShiftCalendarProps {
  events: CalendarEvent[];
  view: (typeof Views)[keyof typeof Views];
  date: Date;
  onView: (view: (typeof Views)[keyof typeof Views]) => void;
  onNavigate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot: (slotInfo: { start: Date }) => void;
}

export default function ShiftCalendar({
  events,
  view,
  date,
  onView,
  onNavigate,
  onSelectEvent,
  onSelectSlot,
}: ShiftCalendarProps) {
  const [mounted, setMounted] = useState(false);

  // Load CSS on client only
  useEffect(() => {
    // @ts-expect-error - CSS module import
    import('react-big-calendar/lib/css/react-big-calendar.css');
    setMounted(true);
  }, []);

  // Custom event styling
  const eventStyleGetter = (event: CalendarEvent) => {
    const { type, status } = event.resource;
    const colors = status === 'CANCELLED' || status === 'DRAFT'
      ? statusColors[status]
      : typeColors[type] || typeColors.PATROL;

    return {
      style: {
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        color: '#1f2937',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '12px',
        opacity: status === 'CANCELLED' ? 0.7 : 1,
      },
    };
  };

  if (!mounted) {
    return (
      <div className="h-[700px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Calendar<CalendarEvent>
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 700 }}
      view={view}
      onView={onView}
      date={date}
      onNavigate={onNavigate}
      onSelectEvent={onSelectEvent}
      onSelectSlot={onSelectSlot}
      selectable
      eventPropGetter={eventStyleGetter}
      views={[Views.MONTH, Views.WEEK, Views.DAY]}
      popup
      tooltipAccessor={(event) => {
        const r = event.resource;
        return `${event.title}\nStatus: ${r.status}\n${r.confirmedCount}/${r.maxVolunteers} volunteers`;
      }}
    />
  );
}

export { Views };
export type { CalendarEvent };
