import { NextRequest, NextResponse } from 'next/server';
import { getDbUser } from '@/lib/user';
import { getUploadPresignedUrl } from '@/lib/s3';

// POST /api/training-center/upload - Get presigned URL for video upload
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { filename, contentType, moduleId } = body;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Filename and contentType are required' },
        { status: 400 }
      );
    }

    // Validate content type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type. Only MP4, WebM, and MOV videos are allowed.' },
        { status: 400 }
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = filename.split('.').pop() || 'mp4';
    const key = `training-videos/${moduleId || 'general'}/${timestamp}-${randomStr}.${extension}`;

    // Get presigned URL (15 minutes expiry for upload)
    const uploadUrl = await getUploadPresignedUrl(key, contentType, 900);

    return NextResponse.json({
      uploadUrl,
      key,
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
