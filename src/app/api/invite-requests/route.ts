import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

// Feature options for reference
const FEATURE_OPTIONS = [
  { slug: 'shifts', label: 'Shift scheduling & calendar' },
  { slug: 'coverage', label: 'Coverage grid / dispatch coordination' },
  { slug: 'sightings', label: 'ICE sighting reporting & alerts' },
  { slug: 'training', label: 'Volunteer training management' },
  { slug: 'multi-location', label: 'Multi-location/chapter support' },
  { slug: 'mobile', label: 'Mobile-friendly volunteer access' },
];

// POST /api/invite-requests - Submit a new invite request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      organizationName,
      organizationType,
      volunteerCount,
      featuresOfInterest,
      notes,
    } = body;

    // Validate required fields
    if (!name || !email || !organizationName || !organizationType || !volunteerCount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check for existing request with same email (to prevent duplicates)
    const existingRequest = await prisma.inviteRequest.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'An invite request with this email is already pending' },
        { status: 409 }
      );
    }

    // Create the invite request
    const inviteRequest = await prisma.inviteRequest.create({
      data: {
        name,
        email: email.toLowerCase(),
        organizationName,
        organizationType,
        volunteerCount,
        featuresOfInterest: featuresOfInterest || [],
        notes: notes || null,
      },
    });

    // Format features for email
    const selectedFeatures = (featuresOfInterest || [])
      .map((slug: string) => FEATURE_OPTIONS.find(f => f.slug === slug)?.label || slug)
      .join(', ');

    // Format organization type for display
    const orgTypeLabels: Record<string, string> = {
      'rapid-response': 'Rapid Response Network',
      'legal-aid': 'Legal Aid Organization',
      'mutual-aid': 'Mutual Aid Network',
      'community-org': 'Community Organization',
      'other': 'Other',
    };
    const orgTypeDisplay = orgTypeLabels[organizationType] || organizationType;

    // Send notification email to admin
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'josh@ripple-vms.com',
        subject: `New Invite Request: ${organizationName}`,
        fromName: 'RippleVMS',
        fromAddress: process.env.SES_FROM_EMAIL || 'noreply@ripple-vms.com',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0891b2;">New Invite Request</h2>
            <p>A new organization has requested access to RippleVMS:</p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Contact Information</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>

              <h3 style="color: #374151;">Organization Details</h3>
              <p><strong>Organization:</strong> ${organizationName}</p>
              <p><strong>Type:</strong> ${orgTypeDisplay}</p>
              <p><strong>Volunteer Count:</strong> ${volunteerCount}</p>

              <h3 style="color: #374151;">Features of Interest</h3>
              <p>${selectedFeatures || 'None specified'}</p>

              ${notes ? `
                <h3 style="color: #374151;">Additional Notes</h3>
                <p>${notes}</p>
              ` : ''}
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              Request ID: ${inviteRequest.id}<br>
              Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error('Failed to send admin notification email:', emailError);
    }

    // Send confirmation email to requester
    try {
      await sendEmail({
        to: email,
        subject: 'We received your RippleVMS invite request',
        fromName: 'RippleVMS',
        fromAddress: process.env.SES_FROM_EMAIL || 'noreply@ripple-vms.com',
        replyTo: process.env.ADMIN_EMAIL || 'josh@ripple-vms.com',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0891b2;">Thanks for your interest in RippleVMS!</h2>

            <p>Hi ${name.split(' ')[0]},</p>

            <p>We've received your request for <strong>${organizationName}</strong> to join RippleVMS.
            Our team will review your request and get back to you shortly.</p>

            <div style="background: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2;">
              <p style="margin: 0; color: #0891b2;">
                <strong>What happens next?</strong>
              </p>
              <p style="margin: 10px 0 0 0; color: #374151;">
                We'll reach out within 1-2 business days to learn more about your organization
                and discuss how RippleVMS can support your volunteer coordination needs.
              </p>
            </div>

            <p>In the meantime, feel free to reply to this email if you have any questions.</p>

            <p>Best,<br>The RippleVMS Team</p>
          </div>
        `,
      });
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error('Failed to send confirmation email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Invite request submitted successfully',
      id: inviteRequest.id,
    });
  } catch (error) {
    console.error('Error creating invite request:', error);
    return NextResponse.json(
      { error: 'Failed to submit invite request' },
      { status: 500 }
    );
  }
}
