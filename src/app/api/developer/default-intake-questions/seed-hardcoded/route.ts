import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

// Hardcoded defaults to seed the template table initially
const HARDCODED_DEFAULTS = [
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

// POST /api/developer/default-intake-questions/seed-hardcoded - Seed templates with hardcoded defaults
export async function POST() {
  try {
    const user = await getDbUser();
    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if templates already exist
    const existingCount = await prisma.defaultIntakeQuestionTemplate.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Default templates already exist. Delete them first to re-seed.' },
        { status: 400 }
      );
    }

    // Create default templates
    const created = await prisma.defaultIntakeQuestionTemplate.createMany({
      data: HARDCODED_DEFAULTS,
    });

    return NextResponse.json({
      message: `Seeded ${created.count} default intake question templates`,
      count: created.count,
    });
  } catch (error) {
    console.error('Error seeding default intake question templates:', error);
    return NextResponse.json({ error: 'Failed to seed templates' }, { status: 500 });
  }
}
