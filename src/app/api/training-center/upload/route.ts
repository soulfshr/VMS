import { NextRequest, NextResponse } from 'next/server';
import { getDbUser } from '@/lib/user';
import { uploadToS3 } from '@/lib/s3';

// POST /api/training-center/upload - Upload video file to S3
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const moduleId = formData.get('moduleId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate content type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only MP4, WebM, and MOV videos are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'mp4';
    const key = `training-videos/${moduleId || 'general'}/${timestamp}-${randomStr}.${extension}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    await uploadToS3(buffer, key, file.type);

    return NextResponse.json({
      key,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}
