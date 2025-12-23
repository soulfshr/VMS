import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/intake-questions - Public endpoint to get active intake questions for signup form
export async function GET() {
  try {
    const questions = await prisma.intakeQuestion.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        question: true,
        type: true,
        options: true,
        required: true,
      },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching intake questions:', error);
    return NextResponse.json({ error: 'Failed to fetch intake questions' }, { status: 500 });
  }
}
