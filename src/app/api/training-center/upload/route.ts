import { NextRequest, NextResponse } from 'next/server';
import { getDbUser } from '@/lib/user';
import { getUploadPresignedUrl } from '@/lib/s3';

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB limit

// Increase max duration for video uploads (60 seconds on Vercel Pro)
export const maxDuration = 60;

// POST /api/training-center/upload - Generate a presigned S3 URL for direct video upload
// Note: This route is excluded from middleware auth (handles its own auth)
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    console.log('[Training Upload] User:', user?.id, 'Role:', user?.role);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      console.log('[Training Upload] Forbidden - user role is:', user.role);
      return NextResponse.json({ error: 'Forbidden', role: user.role }, { status: 403 });
    }

    const body = await request.json();
    const { filename, contentType, moduleId, size } = body ?? {};

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json(
        { error: 'Content type is required' },
        { status: 400 }
      );
    }

    if (typeof size !== 'number' || Number.isNaN(size) || size <= 0) {
      return NextResponse.json(
        { error: 'Invalid file size' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only MP4, WebM, and MOV videos are allowed.' },
        { status: 400 }
      );
    }

    if (size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    const sanitizedModuleId =
      typeof moduleId === 'string' && moduleId.trim().length > 0
        ? moduleId
        : 'general';

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = filename.split('.').pop() || 'mp4';
    const key = `training-videos/${sanitizedModuleId}/${timestamp}-${randomStr}.${extension}`;

    const uploadUrl = await getUploadPresignedUrl(key, contentType, 10 * 60); // 10 min expiry

    return NextResponse.json({
      key,
      uploadUrl,
      filename,
      size,
    });
  } catch (error) {
    console.error('Error preparing video upload:', error);
    return NextResponse.json(
      { error: 'Failed to prepare video upload' },
      { status: 500 }
    );
  }
}
