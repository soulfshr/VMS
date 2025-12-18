import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { sendCoverageSignupConfirmationEmail } from '@/lib/email';

interface SlotInput {
  date: string;
  startHour: number;
  endHour: number;
}

interface ContiguousBlock {
  date: string;
  startHour: number;
  endHour: number;
}

/**
 * Group slots into contiguous blocks for calendar invite generation
 */
function groupContiguousSlots(slots: SlotInput[]): ContiguousBlock[] {
  if (slots.length === 0) return [];

  // Group by date
  const byDate = new Map<string, number[]>();
  for (const slot of slots) {
    if (!byDate.has(slot.date)) {
      byDate.set(slot.date, []);
    }
    byDate.get(slot.date)!.push(slot.startHour);
  }

  // For each date, find contiguous blocks
  const blocks: ContiguousBlock[] = [];

  for (const [date, hours] of byDate.entries()) {
    // Sort hours
    hours.sort((a, b) => a - b);

    let blockStart = hours[0];
    let blockEnd = hours[0] + 1;

    for (let i = 1; i < hours.length; i++) {
      if (hours[i] === blockEnd) {
        // Contiguous, extend the block
        blockEnd = hours[i] + 1;
      } else {
        // Gap found, save current block and start new one
        blocks.push({ date, startHour: blockStart, endHour: blockEnd });
        blockStart = hours[i];
        blockEnd = hours[i] + 1;
      }
    }

    // Save the last block
    blocks.push({ date, startHour: blockStart, endHour: blockEnd });
  }

  // Sort blocks by date, then start hour
  blocks.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour - b.startHour;
  });

  return blocks;
}

/**
 * POST /api/coverage/signup/batch
 *
 * Sign up for multiple coverage slots at once (coordinator only).
 * Body: { slots: Array<{ date: string, startHour: number, endHour: number }>, roleType: string }
 *
 * Sends calendar invites grouped by contiguous blocks.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slots, roleType } = body;

    // Validate required fields
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid slots array' },
        { status: 400 }
      );
    }

    if (!roleType) {
      return NextResponse.json(
        { error: 'Missing roleType' },
        { status: 400 }
      );
    }

    // Currently only supports DISPATCH_COORDINATOR
    if (roleType !== 'DISPATCH_COORDINATOR') {
      return NextResponse.json(
        { error: 'Batch signup currently only supports DISPATCH_COORDINATOR role' },
        { status: 400 }
      );
    }

    // Check user has the required qualification
    const userQualifications = await prisma.userQualification.findMany({
      where: { userId: user.id },
      include: { qualifiedRole: { select: { slug: true } } },
    });

    const hasRequiredQualification = userQualifications.some(
      uq => uq.qualifiedRole.slug === roleType
    );

    if (!hasRequiredQualification) {
      return NextResponse.json(
        { error: 'You must have the Dispatch Coordinator qualification to sign up for this role' },
        { status: 403 }
      );
    }

    // Validate all slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const slot of slots) {
      if (!slot.date || slot.startHour === undefined || slot.endHour === undefined) {
        return NextResponse.json(
          { error: 'Each slot must have date, startHour, and endHour' },
          { status: 400 }
        );
      }

      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      if (slotDate < today) {
        return NextResponse.json(
          { error: 'Cannot sign up for past dates' },
          { status: 400 }
        );
      }
    }

    // Check for conflicts with existing signups
    const signupPromises = slots.map(async (slot: SlotInput) => {
      const signupDate = new Date(slot.date);
      signupDate.setHours(0, 0, 0, 0);

      // Check if slot is already filled
      const existingCoordinator = await prisma.coverageSignup.findFirst({
        where: {
          date: signupDate,
          startHour: slot.startHour,
          zoneId: null,
          roleType: 'DISPATCH_COORDINATOR',
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      });

      if (existingCoordinator) {
        throw new Error(`Slot on ${slot.date} ${slot.startHour}:00 is already filled`);
      }

      // Check if user already has this slot
      const userExisting = await prisma.coverageSignup.findFirst({
        where: {
          date: signupDate,
          startHour: slot.startHour,
          userId: user.id,
          zoneId: null,
          roleType: 'DISPATCH_COORDINATOR',
        },
      });

      if (userExisting) {
        throw new Error(`You are already signed up for ${slot.date} ${slot.startHour}:00`);
      }

      return { slot, signupDate };
    });

    // Wait for all validation to complete
    const validatedSlots = await Promise.all(signupPromises);

    // Create all signups
    const createdSignups = await Promise.all(
      validatedSlots.map(async ({ slot, signupDate }) => {
        return prisma.coverageSignup.create({
          data: {
            date: signupDate,
            zoneId: null,
            startHour: slot.startHour,
            endHour: slot.endHour,
            userId: user.id,
            roleType: 'DISPATCH_COORDINATOR',
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });
      })
    );

    // Group slots into contiguous blocks for calendar invites
    const contiguousBlocks = groupContiguousSlots(slots);

    // Send calendar invite emails for each contiguous block
    const emailPromises = contiguousBlocks.map(async (block) => {
      try {
        const blockDate = new Date(block.date);
        blockDate.setHours(0, 0, 0, 0);

        await sendCoverageSignupConfirmationEmail({
          to: user.email,
          volunteerName: user.name,
          zoneName: 'Regional Coordinator',
          county: 'Triangle Region',
          date: blockDate,
          startHour: block.startHour,
          endHour: block.endHour,
          roleType: 'DISPATCHER', // Use DISPATCHER template
        });
      } catch (emailErr) {
        console.error('Failed to send coverage confirmation email:', emailErr);
      }
    });

    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      signupsCreated: createdSignups.length,
      calendarInvitesSent: contiguousBlocks.length,
      blocks: contiguousBlocks.map(block => ({
        date: block.date,
        startHour: block.startHour,
        endHour: block.endHour,
      })),
    });
  } catch (error) {
    console.error('Error creating batch coverage signup:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create signups' }, { status: 500 });
  }
}
