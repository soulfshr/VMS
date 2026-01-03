import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// Default system templates that can be seeded per organization
const DEFAULT_TEMPLATES = [
  {
    name: 'General Newsletter',
    slug: 'GENERAL_NEWSLETTER',
    description: 'General updates and announcements',
    icon: '📰',
    defaultSubject: 'Volunteer Update',
    defaultContent: '',
    templateType: 'SYSTEM',
    sortOrder: 1,
  },
  {
    name: 'Schedule Announcement',
    slug: 'SCHEDULE_ANNOUNCEMENT',
    description: 'New shifts available with zone-specific listings. Uses {{zoneShifts}} placeholder.',
    icon: '📅',
    defaultSubject: 'New Volunteer Shifts Available',
    defaultContent: `Our neighbors are counting on us! We have new volunteer shifts available.

Use this email to notify volunteers about upcoming shifts in their zones. The system will automatically include a personalized list of shifts based on each recipient's assigned zones.`,
    templateType: 'SYSTEM',
    sortOrder: 2,
  },
  {
    name: 'Training Announcement',
    slug: 'TRAINING_ANNOUNCEMENT',
    description: 'Upcoming trainings with session listings. Uses {{upcomingTrainings}} placeholder.',
    icon: '🎓',
    defaultSubject: 'Upcoming Training Sessions',
    defaultContent: `We have new training opportunities coming up!

Use this email to announce training sessions. The system will automatically include the training schedule based on your selected date range.`,
    templateType: 'SYSTEM',
    sortOrder: 3,
  },
  {
    name: 'Freeform',
    slug: 'FREEFORM',
    description: 'Custom subject and body with no special placeholders',
    icon: '✏️',
    defaultSubject: '',
    defaultContent: '',
    templateType: 'SYSTEM',
    sortOrder: 4,
  },
];

// POST /api/admin/email-templates/seed - Seed default email templates for the organization
export async function POST() {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();

    // Check if templates already exist for this org
    const existingCount = await prisma.emailTemplateConfig.count({
      where: orgId ? { organizationId: orgId } : { organizationId: '__NO_ORG_SELECTED__' },
    });
    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Email templates already exist. Delete them first if you want to re-seed.' },
        { status: 400 }
      );
    }

    // Create default templates for this org
    const templatesToCreate = DEFAULT_TEMPLATES.map(t => ({
      ...t,
      organizationId: orgId || undefined,
    }));

    const created = await prisma.emailTemplateConfig.createMany({
      data: templatesToCreate,
    });

    return NextResponse.json({
      message: `Seeded ${created.count} email templates`,
      count: created.count,
    });
  } catch (error) {
    console.error('Error seeding email templates:', error);
    return NextResponse.json({ error: 'Failed to seed email templates' }, { status: 500 });
  }
}
