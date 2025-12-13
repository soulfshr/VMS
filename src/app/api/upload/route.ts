import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3 } from '@/lib/s3';
import { prisma } from '@/lib/db';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

// Get upload settings from database
async function getUploadSettings() {
  const settings = await prisma.organizationSettings.findFirst();
  return {
    maxUploadSizeMb: settings?.maxUploadSizeMb ?? 50,
    maxUploadsPerReport: settings?.maxUploadsPerReport ?? 5,
  };
}

// Magic byte signatures for file type validation
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF...WEBP)
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp at offset 4
  'video/quicktime': [[0x00, 0x00, 0x00]], // MOV also uses ftyp
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]], // EBML header
};

// Validate file content matches declared type
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) {
    // For types without magic byte validation (HEIC, etc.), allow if MIME type is in allowed list
    return true;
  }

  for (const sig of signatures) {
    let matches = true;
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

// POST /api/upload - Upload a file to S3
// SECURITY NOTE: This endpoint is intentionally public to support anonymous ICE sighting reports.
// Community members need to upload photos/videos without authentication.
// Protections in place:
// 1. Rate limiting: 10 uploads per minute per IP (see RATE_LIMITS.upload)
// 2. File type validation: Only images and videos allowed (MIME type + magic bytes)
// 3. File size limits: Configurable max size (default 50MB)
// 4. Files stored in isolated S3 path (sightings/)
export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimitAsync(`upload:${clientIp}`, RATE_LIMITS.upload);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

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
    const key = `sightings/${timestamp}-${randomStr}.${extension}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file content matches declared MIME type (magic byte check)
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared type.' },
        { status: 400 }
      );
    }

    // Upload to S3
    const url = await uploadToS3(buffer, key, file.type);

    return NextResponse.json({
      url,
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
