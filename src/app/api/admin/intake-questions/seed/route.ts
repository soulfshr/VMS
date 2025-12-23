import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// Default intake questions to seed
const DEFAULT_QUESTIONS = [
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

// POST /api/admin/intake-questions/seed - Seed default intake questions
export async function POST() {
  try {
    const user = await getDbUser();
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if questions already exist
    const existingCount = await prisma.intakeQuestion.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Intake questions already exist. Delete them first if you want to re-seed.' },
        { status: 400 }
      );
    }

    // Create default questions
    const created = await prisma.intakeQuestion.createMany({
      data: DEFAULT_QUESTIONS,
    });

    return NextResponse.json({
      message: `Seeded ${created.count} default intake questions`,
      count: created.count,
    });
  } catch (error) {
    console.error('Error seeding intake questions:', error);
    return NextResponse.json({ error: 'Failed to seed intake questions' }, { status: 500 });
  }
}
