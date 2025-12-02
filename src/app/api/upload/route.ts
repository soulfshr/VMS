import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db';

// Get upload settings from database
async function getUploadSettings() {
  const settings = await prisma.organizationSettings.findFirst();
  return {
    maxUploadSizeMb: settings?.maxUploadSizeMb ?? 50,
    maxUploadsPerReport: settings?.maxUploadsPerReport ?? 5,
  };
}

// POST /api/upload - Upload a file to Vercel Blob (PUBLIC - no auth required for sighting reports)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get upload settings
    const settings = await getUploadSettings();
    const maxSizeBytes = settings.maxUploadSizeMb * 1024 * 1024;

    // Validate file size
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File size exceeds ${settings.maxUploadSizeMb}MB limit` },
        { status: 400 }
      );
    }

    // Validate file type (images and videos only)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-msvideo',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images and videos are allowed.' },
        { status: 400 }
      );
    }

    // Determine media type
    const mediaType = file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO';

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'bin';
    const filename = `sightings/${timestamp}-${randomStr}.${extension}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({
      url: blob.url,
      type: mediaType,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('[Upload] Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
