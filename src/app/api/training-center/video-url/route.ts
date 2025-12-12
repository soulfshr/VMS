import { NextRequest, NextResponse } from 'next/server';
import { getDbUser } from '@/lib/user';
import { getDownloadPresignedUrl } from '@/lib/s3';
import { prisma } from '@/lib/db';

// GET /api/training-center/video-url?key=... - Get presigned URL for video playback
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const key = request.nextUrl.searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Video key is required' },
        { status: 400 }
      );
    }

    // Validate the key is in the training-videos folder
    if (!key.startsWith('training-videos/')) {
      return NextResponse.json(
        { error: 'Invalid video key' },
        { status: 400 }
      );
    }

    // For non-developers, verify the video belongs to a published module
    if (user.role !== 'DEVELOPER') {
      // Extract module ID from key (format: training-videos/{moduleId}/filename.mp4)
      const parts = key.split('/');
      if (parts.length >= 2) {
        const moduleId = parts[1];
        const trainingModule = await prisma.trainingModule.findUnique({
          where: { id: moduleId },
          select: { isPublished: true },
        });

        if (!trainingModule || !trainingModule.isPublished) {
          return NextResponse.json({ error: 'Video not available' }, { status: 403 });
        }
      }
    }

    // Get presigned URL (1 hour expiry for playback)
    const url = await getDownloadPresignedUrl(key, 3600);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating video URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate video URL' },
      { status: 500 }
    );
  }
}
