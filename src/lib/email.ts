import nodemailer from 'nodemailer';
import icalGenerator from 'ical-generator';

// Organization timezone - used for formatting dates in emails
// This ensures consistent display regardless of server timezone (UTC on Vercel)
const ORG_TIMEZONE = 'America/New_York';

// Helper to format date in organization timezone
function formatDateInOrgTimezone(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: ORG_TIMEZONE,
  });
}

// Helper to format time in organization timezone
function formatTimeInOrgTimezone(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ORG_TIMEZONE,
  });
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Check if email is configured
function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

interface ShiftEmailParams {
  to: string;
  volunteerName: string;
  shiftTitle: string;
  shiftType: string;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  zoneName: string;
  description?: string;
}

/**
 * Send email when volunteer signs up for a shift (PENDING status)
 */
export async function sendShiftSignupEmail(params: ShiftEmailParams): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] SMTP not configured, skipping signup email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  try {
    await transporter.sendMail({
      from: `"Siembra NC VMS" <${process.env.SMTP_USER}>`,
      to,
      subject: `Shift Signup Received: ${shiftTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d9488;">Shift Signup Received</h2>
          <p>Hi ${volunteerName},</p>
          <p>Thank you for signing up! Your request has been received and is pending confirmation.</p>

          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Shift Details</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${shiftTitle}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${shiftType}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${zoneName}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${startStr} - ${endStr}</p>
          </div>

          <p>A coordinator will review and confirm your signup. You'll receive another email with a calendar invite once confirmed.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for volunteering with Siembra NC!
          </p>
        </div>
      `,
    });
    console.log(`[Email] Signup email sent to ${to}`);
  } catch (error) {
    console.error('[Email] Failed to send signup email:', error);
    // Don't throw - email failure shouldn't break the RSVP flow
  }
}

/**
 * Send email when coordinator confirms a shift (CONFIRMED status)
 * Includes ICS calendar invite attachment
 */
export async function sendShiftConfirmationEmail(params: ShiftEmailParams): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] SMTP not configured, skipping confirmation email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, description } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  // Generate ICS calendar invite with explicit timezone
  const calendar = icalGenerator({ name: 'Siembra NC VMS' });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: ORG_TIMEZONE,
    summary: `${shiftType}: ${shiftTitle} - ${zoneName}`,
    description: description || `Siembra NC volunteer shift\n\nType: ${shiftType}\nZone: ${zoneName}`,
    organizer: { name: 'Siembra NC', email: process.env.SMTP_USER! },
  });

  try {
    await transporter.sendMail({
      from: `"Siembra NC VMS" <${process.env.SMTP_USER}>`,
      to,
      subject: `Shift Confirmed: ${shiftTitle} on ${dateStr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d9488;">Your Shift is Confirmed!</h2>
          <p>Hi ${volunteerName},</p>
          <p>Great news! Your shift has been confirmed.</p>

          <div style="background: #d1fae5; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488;">
            <h3 style="margin-top: 0; color: #065f46;">Confirmed Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${shiftTitle}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${shiftType}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${zoneName}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${startStr} - ${endStr}</p>
          </div>

          <p><strong>A calendar invite is attached to this email.</strong> Add it to your calendar so you don't forget!</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for volunteering with Siembra NC!<br>
            If you need to cancel, please do so as soon as possible.
          </p>
        </div>
      `,
      icalEvent: {
        method: 'REQUEST',
        content: calendar.toString(),
      },
    });
    console.log(`[Email] Confirmation email with calendar invite sent to ${to}`);
  } catch (error) {
    console.error('[Email] Failed to send confirmation email:', error);
  }
}

/**
 * Send email when volunteer cancels their RSVP
 */
export async function sendShiftCancellationEmail(params: Omit<ShiftEmailParams, 'description'>): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] SMTP not configured, skipping cancellation email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  try {
    await transporter.sendMail({
      from: `"Siembra NC VMS" <${process.env.SMTP_USER}>`,
      to,
      subject: `Shift Cancelled: ${shiftTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Shift Cancellation Confirmed</h2>
          <p>Hi ${volunteerName},</p>
          <p>Your shift signup has been cancelled.</p>

          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Cancelled Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${shiftTitle}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${shiftType}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${zoneName}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${startStr} - ${endStr}</p>
          </div>

          <p>If you'd like to sign up for a different shift, please visit the VMS to browse available shifts.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for letting us know. We hope to see you at a future shift!
          </p>
        </div>
      `,
    });
    console.log(`[Email] Cancellation email sent to ${to}`);
  } catch (error) {
    console.error('[Email] Failed to send cancellation email:', error);
  }
}

interface ShiftCancelledParams {
  to: string;
  volunteerName: string;
  shiftTitle: string;
  shiftType: string;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  zoneName: string;
  reason?: string;
}

/**
 * Send email when coordinator cancels a shift (affects all signed-up volunteers)
 */
export async function sendShiftCancelledByCoordinatorEmail(params: ShiftCancelledParams): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] SMTP not configured, skipping shift cancelled email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, reason } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  try {
    await transporter.sendMail({
      from: `"Siembra NC VMS" <${process.env.SMTP_USER}>`,
      to,
      subject: `Shift Cancelled: ${shiftTitle} on ${dateStr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Shift Has Been Cancelled</h2>
          <p>Hi ${volunteerName},</p>
          <p>We're sorry to inform you that a shift you were signed up for has been cancelled by a coordinator.</p>

          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Cancelled Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${shiftTitle}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${shiftType}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${zoneName}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${startStr} - ${endStr}</p>
            ${reason ? `<p style="margin: 8px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>

          <p>Please check the VMS for other available shifts you can sign up for.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            We apologize for any inconvenience. Thank you for your understanding!
          </p>
        </div>
      `,
    });
    console.log(`[Email] Shift cancelled notification sent to ${to}`);
  } catch (error) {
    console.error('[Email] Failed to send shift cancelled email:', error);
  }
}

interface ShiftInviteParams {
  to: string;
  volunteerName: string;
  shiftTitle: string;
  shiftType: string;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  zoneName: string;
  description?: string;
  coordinatorName: string;
}

/**
 * Send email when coordinator manually adds a volunteer to a shift
 * Includes ICS calendar invite attachment
 */
export async function sendShiftInviteEmail(params: ShiftInviteParams): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] SMTP not configured, skipping invite email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, description, coordinatorName } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  // Generate ICS calendar invite with explicit timezone
  const calendar = icalGenerator({ name: 'Siembra NC VMS' });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: ORG_TIMEZONE,
    summary: `${shiftType}: ${shiftTitle} - ${zoneName}`,
    description: description || `Siembra NC volunteer shift\n\nType: ${shiftType}\nZone: ${zoneName}`,
    organizer: { name: 'Siembra NC', email: process.env.SMTP_USER! },
  });

  try {
    await transporter.sendMail({
      from: `"Siembra NC VMS" <${process.env.SMTP_USER}>`,
      to,
      subject: `You've Been Added to a Shift: ${shiftTitle} on ${dateStr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d9488;">You've Been Added to a Shift!</h2>
          <p>Hi ${volunteerName},</p>
          <p>${coordinatorName} has added you to a volunteer shift. You are confirmed and ready to go!</p>

          <div style="background: #d1fae5; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488;">
            <h3 style="margin-top: 0; color: #065f46;">Your Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${shiftTitle}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${shiftType}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${zoneName}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${startStr} - ${endStr}</p>
          </div>

          <p><strong>A calendar invite is attached to this email.</strong> Add it to your calendar so you don't forget!</p>

          <p>If you cannot attend this shift, please log into the VMS and cancel your signup, or contact your coordinator.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for volunteering with Siembra NC!
          </p>
        </div>
      `,
      icalEvent: {
        method: 'REQUEST',
        content: calendar.toString(),
      },
    });
    console.log(`[Email] Shift invite email with calendar invite sent to ${to}`);
  } catch (error) {
    console.error('[Email] Failed to send invite email:', error);
  }
}

// ============================================
// ICE SIGHTING NOTIFICATIONS
// ============================================

interface SightingNotificationParams {
  sightingId: string;
  size: string;
  activity: string;
  location: string;
  uniform: string;
  observedAt: Date;
  equipment: string;
  hasMedia: boolean;
  reporterName?: string | null;
}

/**
 * Send email notification to all dispatchers when a new ICE sighting is reported
 */
export async function sendSightingNotificationToDispatchers(
  params: SightingNotificationParams,
  dispatchers: { email: string; name: string }[]
): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] SMTP not configured, skipping sighting notification');
    return;
  }

  const {
    sightingId,
    size,
    activity,
    location,
    uniform,
    observedAt,
    equipment,
    hasMedia,
    reporterName,
  } = params;

  const dateStr = formatDateInOrgTimezone(observedAt);
  const timeStr = formatTimeInOrgTimezone(observedAt);
  const vmsUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vms.siembranc.org';

  for (const dispatcher of dispatchers) {
    try {
      await transporter.sendMail({
        from: `"Siembra NC VMS" <${process.env.SMTP_USER}>`,
        to: dispatcher.email,
        subject: `🚨 NEW ICE Sighting Reported - ${location}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">🚨 New ICE Sighting Report</h2>
            </div>

            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <p>Hi ${dispatcher.name},</p>
              <p>A new ICE sighting has been reported and needs your attention.</p>

              <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                <h3 style="margin-top: 0; color: #991b1b;">S.A.L.U.T.E. Report</h3>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">S</strong> Size/Strength: ${size}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">A</strong> Activity: ${activity}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">L</strong> Location: ${location}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">U</strong> Uniform: ${uniform}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">T</strong> Time: ${dateStr} at ${timeStr}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">E</strong> Equipment: ${equipment}</p>
                ${hasMedia ? '<p style="margin: 8px 0; color: #0d9488;">📷 Photos/videos attached to this report</p>' : ''}
                ${reporterName ? `<p style="margin: 8px 0; color: #6b7280;">Reporter: ${reporterName}</p>` : ''}
              </div>

              <a href="${vmsUrl}/sightings/${sightingId}"
                 style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 16px;">
                View Full Report
              </a>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This is an automated notification from Siembra NC VMS.<br>
                Please review and update the status as you respond to this sighting.
              </p>
            </div>
          </div>
        `,
      });
      console.log(`[Email] Sighting notification sent to ${dispatcher.email}`);
    } catch (error) {
      console.error(`[Email] Failed to send sighting notification to ${dispatcher.email}:`, error);
    }
  }
}
