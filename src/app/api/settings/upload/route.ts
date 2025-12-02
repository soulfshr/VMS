import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/settings/upload - Get public upload settings (no auth required)
export async function GET() {
  try {
    const settings = await prisma.organizationSettings.findFirst();

    return NextResponse.json({
      maxUploadSizeMb: settings?.maxUploadSizeMb ?? 50,
      maxUploadsPerReport: settings?.maxUploadsPerReport ?? 5,
    });
  } catch (error) {
    console.error('Error fetching upload settings:', error);
    // Return defaults if database fails
    return NextResponse.json({
      maxUploadSizeMb: 50,
      maxUploadsPerReport: 5,
    });
  }
}
