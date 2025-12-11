import { NextRequest, NextResponse } from 'next/server';
import { getDbUser } from '@/lib/user';
import { getDownloadPresignedUrl } from '@/lib/s3';

// GET /api/training-center/video-url?key=... - Get presigned URL for video playback
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, only developers can access training center videos
    // This will be expanded when volunteers can take training
    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
