import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 client singleton
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: (process.env.AWS_REGION || 'us-east-1').trim(),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }
  return s3Client;
}

const BUCKET_NAME = (process.env.AWS_S3_BUCKET || 'ripple-vms-media').trim();

// Upload a file to S3
export async function uploadToS3(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );

  // Return the S3 URL
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

// Generate a pre-signed URL for uploading (client-side direct upload)
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300 // 5 minutes
): Promise<string> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// Generate a pre-signed URL for downloading/viewing
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// Delete a file from S3
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

// Extract S3 key from a full S3 URL
export function getKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Handle both path-style and virtual-hosted style URLs
    if (urlObj.hostname.includes('.s3.')) {
      return urlObj.pathname.slice(1); // Remove leading /
    }
    return null;
  } catch {
    return null;
  }
}
