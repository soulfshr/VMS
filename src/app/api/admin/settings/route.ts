import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { auditUpdate, toAuditUser } from '@/lib/audit';

// GET /api/admin/settings - Get organization settings
export async function GET() {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Allow ADMINISTRATOR and DEVELOPER roles
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin or Developer access required' }, { status: 403 });
    }

    // Get or create settings singleton
    let settings = await prisma.organizationSettings.findFirst();
    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: {
          autoConfirmRsvp: false,
          timezone: 'America/New_York',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/admin/settings - Update organization settings
export async function PUT(request: Request) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Allow ADMINISTRATOR and DEVELOPER roles
    if (!['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin or Developer access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      autoConfirmRsvp,
      timezone,
      maxUploadSizeMb,
      maxUploadsPerReport,
      // Dispatcher scheduling mode
      dispatcherSchedulingMode,
      // Volunteer scheduling mode (SIMPLE vs FULL)
      schedulingMode,
      // Branding settings
      orgName,
      emailFromName,
      emailFromAddress,
      emailFooter,
      emailReplyTo,
      // Feature flag overrides
      featureTrainings,
      featureSightings,
      // Email digest settings
      weeklyDigestEnabled,
      weeklyDigestSendHour,
    } = body;

    // DEVELOPER role can only modify feature flags
    if (user.role === 'DEVELOPER') {
      const nonFeatureFlagFields = [
        autoConfirmRsvp, timezone, maxUploadSizeMb, maxUploadsPerReport,
        dispatcherSchedulingMode, schedulingMode,
        orgName, emailFromName, emailFromAddress, emailFooter, emailReplyTo
      ].filter(f => f !== undefined);
      if (nonFeatureFlagFields.length > 0) {
        return NextResponse.json({ error: 'Developers can only modify feature flags' }, { status: 403 });
      }
    }

    // Validate dispatcher scheduling mode
    if (dispatcherSchedulingMode !== undefined) {
      if (!['REGIONAL', 'COUNTY', 'ZONE'].includes(dispatcherSchedulingMode)) {
        return NextResponse.json({ error: 'Dispatcher scheduling mode must be REGIONAL, COUNTY, or ZONE' }, { status: 400 });
      }
    }

    // Validate volunteer scheduling mode
    if (schedulingMode !== undefined) {
      if (!['SIMPLE', 'FULL'].includes(schedulingMode)) {
        return NextResponse.json({ error: 'Scheduling mode must be SIMPLE or FULL' }, { status: 400 });
      }
    }

    // Validate upload settings
    if (maxUploadSizeMb !== undefined && (maxUploadSizeMb < 1 || maxUploadSizeMb > 100)) {
      return NextResponse.json({ error: 'Max upload size must be between 1 and 100 MB' }, { status: 400 });
    }
    if (maxUploadsPerReport !== undefined && (maxUploadsPerReport < 1 || maxUploadsPerReport > 20)) {
      return NextResponse.json({ error: 'Max uploads per report must be between 1 and 20' }, { status: 400 });
    }

    // Validate branding settings
    if (orgName !== undefined && (typeof orgName !== 'string' || orgName.length > 100)) {
      return NextResponse.json({ error: 'Organization name must be a string under 100 characters' }, { status: 400 });
    }
    if (emailFromName !== undefined && (typeof emailFromName !== 'string' || emailFromName.length > 100)) {
      return NextResponse.json({ error: 'Email from name must be a string under 100 characters' }, { status: 400 });
    }
    if (emailFromAddress !== undefined) {
      if (typeof emailFromAddress !== 'string' || emailFromAddress.length > 255) {
        return NextResponse.json({ error: 'Email from address must be a string under 255 characters' }, { status: 400 });
      }
      // Basic email format validation (only if non-empty)
      if (emailFromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFromAddress)) {
        return NextResponse.json({ error: 'Email from address must be a valid email format' }, { status: 400 });
      }
    }
    if (emailFooter !== undefined && (typeof emailFooter !== 'string' || emailFooter.length > 200)) {
      return NextResponse.json({ error: 'Email footer must be a string under 200 characters' }, { status: 400 });
    }
    if (emailReplyTo !== undefined) {
      if (typeof emailReplyTo !== 'string' || emailReplyTo.length > 255) {
        return NextResponse.json({ error: 'Reply-to email must be a string under 255 characters' }, { status: 400 });
      }
      // Basic email format validation (only if non-empty)
      if (emailReplyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailReplyTo)) {
        return NextResponse.json({ error: 'Reply-to email must be a valid email format' }, { status: 400 });
      }
    }

    // Validate weekly digest send hour
    if (weeklyDigestSendHour !== undefined) {
      const hour = parseInt(weeklyDigestSendHour);
      if (isNaN(hour) || hour < 0 || hour > 23) {
        return NextResponse.json({ error: 'Send hour must be between 0 and 23' }, { status: 400 });
      }
    }

    // Get or create settings singleton
    let settings = await prisma.organizationSettings.findFirst();
    const previousSettings = settings ? { ...settings } : null;

    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: {
          autoConfirmRsvp: autoConfirmRsvp ?? false,
          timezone: timezone ?? 'America/New_York',
          maxUploadSizeMb: maxUploadSizeMb ?? 50,
          maxUploadsPerReport: maxUploadsPerReport ?? 5,
          schedulingMode: schedulingMode ?? 'SIMPLE',
          orgName: orgName ?? 'RippleVMS',
          emailFromName: emailFromName ?? 'RippleVMS',
          emailFromAddress: emailFromAddress ?? '',
          emailReplyTo: emailReplyTo ?? '',
          emailFooter: emailFooter ?? 'RippleVMS Team',
        },
      });
    } else {
      settings = await prisma.organizationSettings.update({
        where: { id: settings.id },
        data: {
          ...(autoConfirmRsvp !== undefined && { autoConfirmRsvp }),
          ...(timezone !== undefined && { timezone }),
          ...(maxUploadSizeMb !== undefined && { maxUploadSizeMb }),
          ...(maxUploadsPerReport !== undefined && { maxUploadsPerReport }),
          ...(dispatcherSchedulingMode !== undefined && { dispatcherSchedulingMode }),
          ...(schedulingMode !== undefined && { schedulingMode }),
          ...(orgName !== undefined && { orgName }),
          ...(emailFromName !== undefined && { emailFromName }),
          ...(emailFromAddress !== undefined && { emailFromAddress }),
          ...(emailReplyTo !== undefined && { emailReplyTo }),
          ...(emailFooter !== undefined && { emailFooter }),
          // Feature flags can be null (reset to default), true, or false
          ...(featureTrainings !== undefined && { featureTrainings }),
          ...(featureSightings !== undefined && { featureSightings }),
          // Email digest settings
          ...(weeklyDigestEnabled !== undefined && { weeklyDigestEnabled }),
          ...(weeklyDigestSendHour !== undefined && { weeklyDigestSendHour: parseInt(weeklyDigestSendHour) }),
        },
      });
    }

    // Audit log the settings change
    if (previousSettings) {
      auditUpdate(
        toAuditUser(user),
        'OrganizationSettings',
        settings.id,
        previousSettings as unknown as Record<string, unknown>,
        settings as unknown as Record<string, unknown>
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
