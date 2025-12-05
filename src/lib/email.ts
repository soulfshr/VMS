import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import icalGenerator from 'ical-generator';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

// Organization timezone - used for formatting dates in emails
// This ensures consistent display regardless of server timezone (UTC on Vercel)
const ORG_TIMEZONE = 'America/New_York';

// Email configuration - AWS SES
// Default fallback from env vars (can be overridden by admin settings)
const DEFAULT_EMAIL_FROM = process.env.SES_FROM_EMAIL || process.env.EMAIL_FROM || '';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || DEFAULT_EMAIL_FROM;

// App URL for unsubscribe links
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ripple-vms.com';

// Initialize SES client (uses AWS SDK credential chain: env vars, IAM role, etc.)
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// Branding settings interface
interface BrandingSettings {
  orgName: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  emailFooter: string;
}

// Default branding (used if no settings exist)
const DEFAULT_BRANDING: BrandingSettings = {
  orgName: 'RippleVMS',
  emailFromName: 'RippleVMS',
  emailFromAddress: DEFAULT_EMAIL_FROM,
  emailReplyTo: REPLY_TO_EMAIL,
  emailFooter: 'RippleVMS Team',
};

// Cache for branding settings (refreshes every 5 minutes)
let brandingCache: { settings: BrandingSettings; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get organization branding settings from database
 * Uses caching to avoid hitting DB on every email
 */
async function getBranding(): Promise<BrandingSettings> {
  // Check cache
  if (brandingCache && Date.now() - brandingCache.timestamp < CACHE_TTL) {
    return brandingCache.settings;
  }

  try {
    const settings = await prisma.organizationSettings.findFirst();
    const branding: BrandingSettings = settings ? {
      orgName: settings.orgName,
      emailFromName: settings.emailFromName,
      emailFromAddress: settings.emailFromAddress || DEFAULT_EMAIL_FROM,
      emailReplyTo: settings.emailReplyTo || settings.emailFromAddress || REPLY_TO_EMAIL,
      emailFooter: settings.emailFooter,
    } : DEFAULT_BRANDING;

    // Update cache
    brandingCache = { settings: branding, timestamp: Date.now() };
    return branding;
  } catch (error) {
    console.error('[Email] Failed to fetch branding settings:', error);
    return DEFAULT_BRANDING;
  }
}

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

// Check if email is configured (AWS SES)
// Requires a valid from email address either from settings or env vars
function isEmailConfigured(branding: BrandingSettings): boolean {
  // Check if we have a valid from email configured
  const fromEmail = branding.emailFromAddress;
  return !!fromEmail && fromEmail.includes('@');
}

// Generate unsubscribe token for a user
export function generateUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate email footer with unsubscribe link (AWS SES compliance)
function getEmailFooter(unsubscribeToken?: string, branding?: BrandingSettings): string {
  const unsubscribeUrl = unsubscribeToken
    ? `${APP_URL}/api/unsubscribe?token=${unsubscribeToken}`
    : `${APP_URL}/profile`;

  const orgName = branding?.orgName || DEFAULT_BRANDING.orgName;

  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        ${orgName} Volunteer Management System<br>
        <a href="${unsubscribeUrl}" style="color: #9ca3af;">Manage email preferences</a> |
        <a href="${APP_URL}/profile" style="color: #9ca3af;">Update profile</a>
      </p>
      <p style="color: #9ca3af; font-size: 11px; text-align: center;">
        Questions? Reply to this email or visit <a href="${APP_URL}" style="color: #9ca3af;">${APP_URL.replace('https://', '')}</a>
      </p>
    </div>
  `;
}

/**
 * Send a simple email via AWS SES (no attachments)
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromAddress: string;
  replyTo?: string;
  unsubscribeToken?: string;
}): Promise<void> {
  const { to, subject, html, fromName, fromAddress, replyTo } = params;

  // Build Source with display name - use RFC 2047 encoding for special characters
  const source = fromName
    ? `=?UTF-8?B?${Buffer.from(fromName).toString('base64')}?= <${fromAddress}>`
    : fromAddress;

  console.log('[Email] Sending email with Source:', source);

  // Note: SES SendEmailCommand doesn't support custom headers directly
  // Unsubscribe link is included in the email footer instead
  const command = new SendEmailCommand({
    Source: source,
    Destination: {
      ToAddresses: [to],
    },
    ReplyToAddresses: replyTo ? [replyTo] : [REPLY_TO_EMAIL],
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },
      },
    },
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
    Tags: [
      { Name: 'Application', Value: 'RippleVMS' },
    ],
  });

  // Add list-unsubscribe headers via message headers
  // Note: SES SendEmailCommand doesn't support custom headers directly
  // For custom headers, we'd need SendRawEmailCommand, but for simplicity
  // we include unsubscribe link in the footer

  await sesClient.send(command);
}

/**
 * Send an email with ICS calendar attachment via AWS SES
 * Uses SendRawEmailCommand for MIME multipart support
 */
async function sendEmailWithCalendar(params: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromAddress: string;
  replyTo?: string;
  calendarContent: string;
  unsubscribeToken?: string;
}): Promise<void> {
  const { to, subject, html, fromName, fromAddress, replyTo, calendarContent, unsubscribeToken } = params;

  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const unsubscribeUrl = unsubscribeToken
    ? `${APP_URL}/api/unsubscribe?token=${unsubscribeToken}`
    : `${APP_URL}/profile`;

  // RFC 2047 encode the from name for proper display in email clients
  const encodedFromName = fromName
    ? `=?UTF-8?B?${Buffer.from(fromName).toString('base64')}?=`
    : '';
  const fromHeader = encodedFromName
    ? `From: ${encodedFromName} <${fromAddress}>`
    : `From: ${fromAddress}`;

  console.log('[Email] Sending calendar email with From:', fromHeader);

  // Build raw MIME message
  const rawMessage = [
    fromHeader,
    `To: ${to}`,
    `Reply-To: ${replyTo || REPLY_TO_EMAIL}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `List-Unsubscribe: <${unsubscribeUrl}>`,
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    html,
    '',
    `--${boundary}`,
    `Content-Type: text/calendar; charset=UTF-8; method=REQUEST`,
    `Content-Disposition: attachment; filename="invite.ics"`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    calendarContent,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage),
    },
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
    Tags: [
      { Name: 'Application', Value: 'RippleVMS' },
    ],
  });

  await sesClient.send(command);
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
  unsubscribeToken?: string;
}

/**
 * Send email when volunteer signs up for a shift (PENDING status)
 */
export async function sendShiftSignupEmail(params: ShiftEmailParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping signup email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, unsubscribeToken } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  try {
    await sendEmail({
      to,
      subject: `Shift Signup Received: ${shiftTitle}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
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
            Thank you for volunteering with ${branding.orgName}!
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    console.log(`[Email] Signup email sent to ${to}`);
  } catch (error) {
    console.error('[Email] Failed to send signup email:', error);
  }
}

/**
 * Send email when coordinator confirms a shift (CONFIRMED status)
 * Includes ICS calendar invite attachment
 */
export async function sendShiftConfirmationEmail(params: ShiftEmailParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping confirmation email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, description, unsubscribeToken } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  // Generate ICS calendar invite with explicit timezone
  const calendar = icalGenerator({ name: branding.orgName });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: ORG_TIMEZONE,
    summary: `${shiftType}: ${shiftTitle} - ${zoneName}`,
    description: description || `${branding.orgName} volunteer shift\n\nType: ${shiftType}\nZone: ${zoneName}`,
    organizer: { name: branding.orgName, email: branding.emailFromAddress },
  });

  try {
    await sendEmailWithCalendar({
      to,
      subject: `Shift Confirmed: ${shiftTitle} on ${dateStr}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
      calendarContent: calendar.toString(),
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
            Thank you for volunteering with ${branding.orgName}!<br>
            If you need to cancel, please do so as soon as possible.
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
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
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping cancellation email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, unsubscribeToken } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  try {
    await sendEmail({
      to,
      subject: `Shift Cancelled: ${shiftTitle}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
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

          ${getEmailFooter(unsubscribeToken, branding)}
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
  unsubscribeToken?: string;
}

/**
 * Send email when coordinator cancels a shift (affects all signed-up volunteers)
 */
export async function sendShiftCancelledByCoordinatorEmail(params: ShiftCancelledParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping shift cancelled email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, reason, unsubscribeToken } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  try {
    await sendEmail({
      to,
      subject: `Shift Cancelled: ${shiftTitle} on ${dateStr}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
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

          ${getEmailFooter(unsubscribeToken, branding)}
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
  unsubscribeToken?: string;
}

/**
 * Send email when coordinator manually adds a volunteer to a shift
 * Includes ICS calendar invite attachment
 */
export async function sendShiftInviteEmail(params: ShiftInviteParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping invite email');
    return;
  }

  const { to, volunteerName, shiftTitle, shiftType, shiftDate, startTime, endTime, zoneName, description, coordinatorName, unsubscribeToken } = params;

  const dateStr = formatDateInOrgTimezone(shiftDate);
  const startStr = formatTimeInOrgTimezone(startTime);
  const endStr = formatTimeInOrgTimezone(endTime);

  // Generate ICS calendar invite with explicit timezone
  const calendar = icalGenerator({ name: branding.orgName });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: ORG_TIMEZONE,
    summary: `${shiftType}: ${shiftTitle} - ${zoneName}`,
    description: description || `${branding.orgName} volunteer shift\n\nType: ${shiftType}\nZone: ${zoneName}`,
    organizer: { name: branding.orgName, email: branding.emailFromAddress },
  });

  try {
    await sendEmailWithCalendar({
      to,
      subject: `You've Been Added to a Shift: ${shiftTitle} on ${dateStr}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
      calendarContent: calendar.toString(),
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
            Thank you for volunteering with ${branding.orgName}!
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    console.log(`[Email] Shift invite email with calendar invite sent to ${to}`);
  } catch (error) {
    console.error('[Email] Failed to send invite email:', error);
  }
}

// ============================================
// EMAIL BLASTS
// ============================================

interface BlastEmailParams {
  to: string;
  recipientName: string;
  subject: string;
  body: string;
  unsubscribeToken?: string;
}

/**
 * Send a blast email to a single recipient
 * Body supports {{volunteerName}} and {{organizationName}} variables
 */
export async function sendBlastEmail(params: BlastEmailParams): Promise<{ success: boolean; error?: string }> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping blast email');
    return { success: false, error: 'SES not configured' };
  }

  const { to, recipientName, subject, body, unsubscribeToken } = params;

  // Replace variables in body
  const processedBody = body
    .replace(/\{\{volunteerName\}\}/g, recipientName)
    .replace(/\{\{organizationName\}\}/g, branding.orgName);

  // Convert newlines to <br> for HTML, collapsing multiple blank lines
  const htmlBody = processedBody
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n/g, '<br>');

  try {
    await sendEmail({
      to,
      subject,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; font-size: 14px; line-height: 1.5;">
          <div style="background: #0d9488; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">${branding.orgName}</h2>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 16px 20px; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 12px 0;">Hi ${recipientName},</p>

            <div style="margin: 0;">
              ${htmlBody}
            </div>

            ${getEmailFooter(unsubscribeToken, branding)}
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error(`[Email] Failed to send blast email to ${to}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// ZONE-SPECIFIC SHIFT LISTINGS (for Schedule Announcement)
// ============================================

export interface ShiftForListing {
  title: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  maxVolunteers: number;
  confirmedCount: number;
  zone: {
    name: string;
  };
}

/**
 * Generate an HTML table of upcoming shifts with openings for email
 * Used in Schedule Announcement template for zone-specific listings
 * @param shifts - Array of shifts to display
 * @param showAllZones - If true, shows "All Available Shifts" instead of "Your Zone(s)"
 */
export function generateShiftListHtml(shifts: ShiftForListing[], showAllZones = false): string {
  if (shifts.length === 0) {
    return `
      <p style="color: #6b7280; font-style: italic;">
        No upcoming shifts with openings at this time.
      </p>
    `;
  }

  const headerText = showAllZones
    ? '📅 All Available Shifts'
    : '📅 Upcoming Shifts in Your Zone(s)';

  const rows = shifts.map(shift => {
    const dateStr = shift.date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: ORG_TIMEZONE,
    });
    const startStr = shift.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: ORG_TIMEZONE,
    });
    const endStr = shift.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: ORG_TIMEZONE,
    });
    const spotsLeft = shift.maxVolunteers - shift.confirmedCount;
    const spotsBg = spotsLeft <= 2 ? '#fef3c7' : '#d1fae5';

    return `<tr><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${dateStr}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${startStr} - ${endStr}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${shift.zone.name}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${shift.title}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;"><span style="background: ${spotsBg}; padding: 2px 6px; border-radius: 10px; font-weight: 600; font-size: 12px;">${spotsLeft}</span></td></tr>`;
  }).join('');

  return `<div style="margin: 16px 0 8px 0;"><h3 style="color: #0d9488; margin: 0 0 8px 0; font-size: 16px;">${headerText}</h3><table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><thead><tr style="background: #f3f4f6;"><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Date</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Time</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Zone</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Shift</th><th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Spots</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ============================================
// TRAINING LISTINGS (for Training Announcement)
// ============================================

export interface TrainingForListing {
  title: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  location: string | null;
  meetingLink: string | null;
  maxAttendees: number;
  confirmedCount: number;
  trainingType: {
    name: string;
  };
}

/**
 * Generate an HTML table of upcoming trainings for email
 * Used in Training Announcement template
 * @param trainings - Array of training sessions to display
 */
export function generateTrainingListHtml(trainings: TrainingForListing[]): string {
  if (trainings.length === 0) {
    return `
      <p style="color: #6b7280; font-style: italic;">
        No upcoming training sessions at this time.
      </p>
    `;
  }

  const rows = trainings.map(training => {
    const dateStr = training.date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: ORG_TIMEZONE,
    });
    const startStr = training.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: ORG_TIMEZONE,
    });
    const endStr = training.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: ORG_TIMEZONE,
    });
    const spotsLeft = training.maxAttendees - training.confirmedCount;
    const spotsBg = spotsLeft <= 3 ? '#fef3c7' : '#d1fae5';
    const locationStr = training.meetingLink ? 'Virtual' : (training.location || 'TBD');

    return `<tr><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${dateStr}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${startStr} - ${endStr}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${training.trainingType.name}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${training.title}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${locationStr}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;"><span style="background: ${spotsBg}; padding: 2px 6px; border-radius: 10px; font-weight: 600; font-size: 12px;">${spotsLeft}</span></td></tr>`;
  }).join('');

  return `<div style="margin: 16px 0 8px 0;"><h3 style="color: #8b5cf6; margin: 0 0 8px 0; font-size: 16px;">📚 Upcoming Trainings</h3><table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><thead><tr style="background: #f3f4f6;"><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Date</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Time</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374141; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Type</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Title</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Location</th><th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Spots</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ============================================
// PASSWORD RESET
// ============================================

interface PasswordResetParams {
  to: string;
  userName: string;
  resetToken: string;
}

/**
 * Send password reset email
 * Also used for initial password setup for new users
 */
export async function sendPasswordResetEmail(params: PasswordResetParams): Promise<boolean> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping password reset email');
    return false;
  }

  const { to, userName, resetToken } = params;
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  try {
    await sendEmail({
      to,
      subject: `Reset Your Password - ${branding.orgName}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0d9488; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${branding.orgName}</h2>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #374151; margin-top: 0;">Reset Your Password</h2>
            <p>Hi ${userName},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                 style="display: inline-block; background: #0d9488; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #0d9488; word-break: break-all;">${resetUrl}</a>
            </p>

            ${getEmailFooter(undefined, branding)}
          </div>
        </div>
      `,
    });
    console.log(`[Email] Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    return false;
  }
}

// ============================================
// FEEDBACK EMAILS
// ============================================

interface FeedbackEmailParams {
  category: string;
  message: string;
  userEmail?: string;
  userName?: string;
  url?: string;
  userAgent?: string;
}

/**
 * Send feedback email to the admin
 */
export async function sendFeedbackEmail(params: FeedbackEmailParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping feedback email');
    return;
  }

  const { category, message, userEmail, userName, url, userAgent } = params;
  const timestamp = new Date().toLocaleString('en-US', { timeZone: ORG_TIMEZONE });

  // Category display mapping
  const categoryLabels: Record<string, string> = {
    bug: 'Bug Report',
    feature: 'Feature Request',
    suggestion: 'Suggestion',
    question: 'Question',
    other: 'Other',
  };

  const categoryLabel = categoryLabels[category] || category;

  try {
    await sendEmail({
      to: 'joshcottrell@gmail.com',
      subject: `[VMS Feedback] ${categoryLabel}${userName ? ` from ${userName}` : ''}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: userEmail || branding.emailReplyTo,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0d9488; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">VMS Feedback: ${categoryLabel}</h2>
            ${userName || userEmail ? `<p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">From: ${userName || 'Anonymous'}${userEmail ? ` &lt;${userEmail}&gt;` : ''}</p>` : '<p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">From: Anonymous (not logged in)</p>'}
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #374151;">Message</h3>
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>

            <div style="color: #6b7280; font-size: 14px;">
              <h4 style="color: #374151; margin-bottom: 8px;">Details</h4>
              <p style="margin: 4px 0;"><strong>Category:</strong> ${categoryLabel}</p>
              <p style="margin: 4px 0;"><strong>Submitted:</strong> ${timestamp}</p>
              ${url ? `<p style="margin: 4px 0;"><strong>Page:</strong> <a href="${url}">${url}</a></p>` : ''}
              ${userAgent ? `<p style="margin: 4px 0;"><strong>Browser:</strong> ${userAgent}</p>` : ''}
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Feedback email sent to joshcottrell@gmail.com');
  } catch (error) {
    console.error('[Email] Failed to send feedback email:', error);
    throw error; // Re-throw so the API can return an error
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

interface DispatcherWithToken {
  email: string;
  name: string;
  unsubscribeToken?: string | null;
}

/**
 * Send email notification to all dispatchers when a new ICE sighting is reported
 */
export async function sendSightingNotificationToDispatchers(
  params: SightingNotificationParams,
  dispatchers: DispatcherWithToken[]
): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping sighting notification');
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
  const vmsUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ripple-vms.com';

  for (const dispatcher of dispatchers) {
    try {
      await sendEmail({
        to: dispatcher.email,
        subject: `🚨 NEW ICE Sighting Reported - ${location}`,
        fromName: branding.emailFromName,
        fromAddress: branding.emailFromAddress,
        unsubscribeToken: dispatcher.unsubscribeToken || undefined,
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
                This is an automated notification from ${branding.orgName}.<br>
                Please review and update the status as you respond to this sighting.
              </p>

              ${getEmailFooter(dispatcher.unsubscribeToken || undefined, branding)}
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
