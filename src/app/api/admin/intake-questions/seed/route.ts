import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { getCurrentOrgId } from '@/lib/org-context';

// Fallback defaults if no templates exist in database
const FALLBACK_DEFAULTS = [
  {
    question: 'Do you have any prior experience with community organizing or rapid response?',
    type: 'textarea',
    options: [],
    required: false,
    sortOrder: 1,
  },
  {
    question: 'What languages do you speak fluently (besides English)?',
    type: 'text',
    options: [],
    required: false,
    sortOrder: 2,
  },
  {
    question: 'Do you have reliable transportation?',
    type: 'select',
    options: ['Yes', 'No', 'Sometimes'],
    required: true,
    sortOrder: 3,
  },
  {
    question: 'How did you hear about us?',
    type: 'select',
    options: ['Friend/Family', 'Social Media', 'Community Event', 'News', 'Other'],
    required: false,
    sortOrder: 4,
  },
  {
    question: 'Why are you interested in volunteering with us?',
    type: 'textarea',
    options: [],
    required: false,
    sortOrder: 5,
  },
];

// POST /api/admin/intake-questions/seed - Seed default intake questions from templates
export async function POST() {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = await getCurrentOrgId();

    // Check if questions already exist for this org
    const existingCount = await prisma.intakeQuestion.count({
      where: orgId ? { organizationId: orgId } : {},
    });
    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Intake questions already exist. Delete them first if you want to re-seed.' },
        { status: 400 }
      );
    }

    // Try to get templates from database first
    const templates = await prisma.defaultIntakeQuestionTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    // Use templates if they exist, otherwise use fallback defaults
    const questionsToCreate = templates.length > 0
      ? templates.map(t => ({
          question: t.question,
          type: t.type,
          options: t.options,
          required: t.required,
          sortOrder: t.sortOrder,
          organizationId: orgId || undefined,
        }))
      : FALLBACK_DEFAULTS.map(q => ({
          ...q,
          organizationId: orgId || undefined,
        }));

    // Create questions for this org
    const created = await prisma.intakeQuestion.createMany({
      data: questionsToCreate,
    });

    return NextResponse.json({
      message: `Seeded ${created.count} intake questions${templates.length > 0 ? ' from templates' : ' from defaults'}`,
      count: created.count,
      fromTemplates: templates.length > 0,
    });
  } catch (error) {
    console.error('Error seeding intake questions:', error);
    return NextResponse.json({ error: 'Failed to seed intake questions' }, { status: 500 });
  }
}
