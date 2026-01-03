import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { QuestionType } from '@/generated/prisma/enums';
import { canManageTrainingCenter, createPermissionContext } from '@/lib/permissions';

interface ImportedQuestion {
  questionText: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT';
  points?: number;
  explanation?: string;
  options: Array<{
    optionText: string;
    isCorrect: boolean;
  }>;
}

interface ImportPayload {
  csv: string;
  replaceExisting?: boolean;
}

// Parse CSV to questions array
function parseCSV(csv: string): ImportedQuestion[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Parse header - handle quoted fields
  const parseRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const header = parseRow(lines[0]).map(h => h.toLowerCase().trim());

  // Expected columns
  const questionTextIdx = header.indexOf('questiontext');
  const typeIdx = header.indexOf('type');
  const pointsIdx = header.indexOf('points');
  const explanationIdx = header.indexOf('explanation');

  if (questionTextIdx === -1 || typeIdx === -1) {
    throw new Error('CSV must have "questionText" and "type" columns');
  }

  // Find option columns (option1, correct1, option2, correct2, etc.)
  const optionIndices: { textIdx: number; correctIdx: number }[] = [];
  for (let i = 1; i <= 6; i++) {
    const textIdx = header.indexOf(`option${i}`);
    const correctIdx = header.indexOf(`correct${i}`);
    if (textIdx !== -1 && correctIdx !== -1) {
      optionIndices.push({ textIdx, correctIdx });
    }
  }

  if (optionIndices.length < 2) {
    throw new Error('CSV must have at least option1, correct1, option2, correct2 columns');
  }

  const questions: ImportedQuestion[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseRow(line);

    const questionText = values[questionTextIdx]?.trim();
    const type = values[typeIdx]?.trim().toUpperCase() as 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT';

    if (!questionText) continue; // Skip rows without question text

    const points = pointsIdx !== -1 ? parseInt(values[pointsIdx]) || 1 : 1;
    const explanation = explanationIdx !== -1 ? values[explanationIdx]?.trim() || undefined : undefined;

    const options: { optionText: string; isCorrect: boolean }[] = [];
    for (const { textIdx, correctIdx } of optionIndices) {
      const optionText = values[textIdx]?.trim();
      if (optionText) {
        const correctVal = values[correctIdx]?.trim().toLowerCase();
        const isCorrect = correctVal === 'true' || correctVal === 'yes' || correctVal === '1' || correctVal === 'x';
        options.push({ optionText, isCorrect });
      }
    }

    if (options.length >= 2) {
      questions.push({
        questionText,
        type,
        points,
        explanation,
        options,
      });
    }
  }

  return questions;
}

// POST /api/training-center/modules/[id]/sections/[sectionId]/quiz/import
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = createPermissionContext(user.role);
    if (!canManageTrainingCenter(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sectionId } = await params;
    const body: ImportPayload = await request.json();
    const { csv, replaceExisting } = body;

    if (!csv || typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json(
        { error: 'No CSV data provided' },
        { status: 400 }
      );
    }

    // Parse CSV to questions
    let questions: ImportedQuestion[];
    try {
      questions = parseCSV(csv);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to parse CSV' },
        { status: 400 }
      );
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'No valid questions found in CSV' },
        { status: 400 }
      );
    }

    // Find the quiz for this section
    const quiz = await prisma.moduleQuiz.findUnique({
      where: { sectionId },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Validate questions
    const errors: string[] = [];
    questions.forEach((q, index) => {
      if (!q.questionText?.trim()) {
        errors.push(`Question ${index + 1}: Missing question text`);
      }
      if (!q.type || !['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT'].includes(q.type)) {
        errors.push(`Question ${index + 1}: Invalid type "${q.type}"`);
      }
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`Question ${index + 1}: Must have at least 2 options`);
      }
      const hasCorrect = q.options?.some(o => o.isCorrect);
      if (!hasCorrect) {
        errors.push(`Question ${index + 1}: Must have at least one correct answer`);
      }
      q.options?.forEach((opt, optIndex) => {
        if (!opt.optionText?.trim()) {
          errors.push(`Question ${index + 1}, Option ${optIndex + 1}: Missing option text`);
        }
      });
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // Get current max sort order
    let startSortOrder = 0;
    if (!replaceExisting) {
      const lastQuestion = await prisma.quizQuestion.findFirst({
        where: { quizId: quiz.id },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      startSortOrder = (lastQuestion?.sortOrder ?? -1) + 1;
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // If replacing, delete existing questions first
      if (replaceExisting) {
        await tx.quizQuestion.deleteMany({
          where: { quizId: quiz.id },
        });
      }

      // Create all questions with their options
      const createdQuestions = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const question = await tx.quizQuestion.create({
          data: {
            quizId: quiz.id,
            questionText: q.questionText.trim(),
            type: q.type as QuestionType,
            points: q.points ?? 1,
            explanation: q.explanation?.trim() || null,
            sortOrder: startSortOrder + i,
            options: {
              create: q.options.map((opt, optIndex) => ({
                optionText: opt.optionText.trim(),
                isCorrect: opt.isCorrect,
                sortOrder: optIndex,
              })),
            },
          },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        });
        createdQuestions.push(question);
      }

      return createdQuestions;
    });

    return NextResponse.json({
      success: true,
      imported: result.length,
      questions: result,
    });
  } catch (error) {
    console.error('Error importing questions:', error);
    return NextResponse.json(
      { error: 'Failed to import questions' },
      { status: 500 }
    );
  }
}

// GET /api/training-center/modules/[id]/sections/[sectionId]/quiz/import
// Returns a CSV template for importing
export async function GET() {
  const csvTemplate = `questionText,type,points,explanation,option1,correct1,option2,correct2,option3,correct3,option4,correct4
"What is the primary role of a poll observer?",MULTIPLE_CHOICE,1,"Poll observers watch and document the voting process.","To help voters fill out ballots",false,"To observe and document the process",true,"To count the votes",false,"To check voter IDs",false
"Observers should maintain a respectful distance from voters.",TRUE_FALSE,1,"Maintaining distance ensures voters can vote privately.",True,true,False,false,,,,
"Which are valid reasons to contact your dispatcher? (Select all)",MULTI_SELECT,2,"Contact dispatchers for safety concerns or incidents.","You observe a potential violation",true,"You need a bathroom break",false,"Equipment malfunction",true,"Safety concern at location",true`;

  return new NextResponse(csvTemplate, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="quiz-import-template.csv"',
    },
  });
}
