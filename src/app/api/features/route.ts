import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Environment variable defaults
const ENV_DEFAULTS = {
  trainings: process.env.NEXT_PUBLIC_FEATURE_TRAININGS === 'true',
  sightings: process.env.NEXT_PUBLIC_FEATURE_SIGHTINGS === 'true',
};

// GET /api/features - Get resolved feature flags (public endpoint)
export async function GET() {
  try {
    // Get settings (if they exist)
    const settings = await prisma.organizationSettings.findFirst();

    // Resolve feature flags: database override takes precedence over env vars
    const features = {
      trainings: settings?.featureTrainings ?? ENV_DEFAULTS.trainings,
      sightings: settings?.featureSightings ?? ENV_DEFAULTS.sightings,
    };

    return NextResponse.json(features);
  } catch (error) {
    console.error('Error fetching features:', error);
    // Fall back to env defaults on error
    return NextResponse.json(ENV_DEFAULTS);
  }
}
