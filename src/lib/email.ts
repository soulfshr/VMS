import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import icalGenerator, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { escapeHtml, escapeHtmlPreserveBreaks } from '@/lib/html-escape';
import { logger } from '@/lib/logger';

// Default organization timezone - used for formatting dates in emails
// This ensures consistent display regardless of server timezone (UTC on Vercel)
const DEFAULT_TIMEZONE = 'America/New_York';

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
  timezone: string;
}

// Default branding (used if no settings exist)
const DEFAULT_BRANDING: BrandingSettings = {
  orgName: 'RippleVMS',
  emailFromName: 'RippleVMS',
  emailFromAddress: DEFAULT_EMAIL_FROM,
  emailReplyTo: REPLY_TO_EMAIL,
  emailFooter: 'RippleVMS Team',
  timezone: DEFAULT_TIMEZONE,
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
      timezone: settings.timezone || DEFAULT_TIMEZONE,
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
function formatDateInTimezone(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
}

// Helper to format time in organization timezone
function formatTimeInTimezone(date: Date, timezone: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
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
 * @param calendarMethod - 'REQUEST' for new/updated events, 'CANCEL' for cancellations
 */
async function sendEmailWithCalendar(params: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromAddress: string;
  replyTo?: string;
  calendarContent: string;
  calendarMethod?: 'REQUEST' | 'CANCEL';
  unsubscribeToken?: string;
}): Promise<void> {
  const { to, subject, html, fromName, fromAddress, replyTo, calendarContent, calendarMethod = 'REQUEST', unsubscribeToken } = params;

  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  // RFC 2047 encode the from name for proper display in email clients
  const encodedFromName = fromName
    ? `=?UTF-8?B?${Buffer.from(fromName).toString('base64')}?=`
    : '';
  const fromHeader = encodedFromName
    ? `From: ${encodedFromName} <${fromAddress}>`
    : `From: ${fromAddress}`;

  console.log('[Email] Sending calendar email with From:', fromHeader, 'Method:', calendarMethod);

  // Normalize HTML: remove all newlines and extra whitespace to create single-line HTML
  // This avoids MIME line ending issues while keeping the email readable
  const normalizedHtml = html.replace(/\s+/g, ' ').trim();

  // Filename based on method
  const filename = calendarMethod === 'CANCEL' ? 'cancel.ics' : 'invite.ics';

  // Build raw MIME message
  // Note: List-Unsubscribe headers removed as they can cause MIME parsing issues
  // Unsubscribe link is included in the email footer instead
  const rawMessage = [
    fromHeader,
    `To: ${to}`,
    `Reply-To: ${replyTo || REPLY_TO_EMAIL}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    normalizedHtml,
    '',
    `--${boundary}`,
    `Content-Type: text/calendar; charset=UTF-8; method=${calendarMethod}`,
    `Content-Disposition: attachment; filename="${filename}"`,
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

  const dateStr = formatDateInTimezone(shiftDate, branding.timezone);
  const startStr = formatTimeInTimezone(startTime, branding.timezone);
  const endStr = formatTimeInTimezone(endTime, branding.timezone);

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
          <h2 style="color: #0891b2;">Shift Signup Received</h2>
          <p>Hi ${escapeHtml(volunteerName)},</p>
          <p>Thank you for signing up! Your request has been received and is pending confirmation.</p>

          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Shift Details</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${escapeHtml(shiftTitle)}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${escapeHtml(shiftType)}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${escapeHtml(zoneName)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
          </div>

          <p>A coordinator will review and confirm your signup. You'll receive another email with a calendar invite once confirmed.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for volunteering with ${escapeHtml(branding.orgName)}!
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    logger.email('Signup email sent', { to }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send signup email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
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

  const dateStr = formatDateInTimezone(shiftDate, branding.timezone);
  const startStr = formatTimeInTimezone(startTime, branding.timezone);
  const endStr = formatTimeInTimezone(endTime, branding.timezone);

  // Generate ICS calendar invite with explicit timezone
  const calendar = icalGenerator({ name: branding.orgName });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: branding.timezone,
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
          <h2 style="color: #0891b2;">Your Shift is Confirmed!</h2>
          <p>Hi ${escapeHtml(volunteerName)},</p>
          <p>Great news! Your shift has been confirmed.</p>

          <div style="background: #cffafe; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2;">
            <h3 style="margin-top: 0; color: #065f46;">Confirmed Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${escapeHtml(shiftTitle)}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${escapeHtml(shiftType)}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${escapeHtml(zoneName)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
          </div>

          <p><strong>A calendar invite is attached to this email.</strong> Add it to your calendar so you don't forget!</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for volunteering with ${escapeHtml(branding.orgName)}!<br>
            If you need to cancel, please do so as soon as possible.
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    logger.email('Confirmation email with calendar invite sent', { to }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send confirmation email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
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

  const dateStr = formatDateInTimezone(shiftDate, branding.timezone);
  const startStr = formatTimeInTimezone(startTime, branding.timezone);
  const endStr = formatTimeInTimezone(endTime, branding.timezone);

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
          <p>Hi ${escapeHtml(volunteerName)},</p>
          <p>Your shift signup has been cancelled.</p>

          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Cancelled Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${escapeHtml(shiftTitle)}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${escapeHtml(shiftType)}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${escapeHtml(zoneName)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
          </div>

          <p>If you'd like to sign up for a different shift, please visit the VMS to browse available shifts.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for letting us know. We hope to see you at a future shift!
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    logger.email('Cancellation email sent', { to }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send cancellation email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
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

  const dateStr = formatDateInTimezone(shiftDate, branding.timezone);
  const startStr = formatTimeInTimezone(startTime, branding.timezone);
  const endStr = formatTimeInTimezone(endTime, branding.timezone);

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
          <p>Hi ${escapeHtml(volunteerName)},</p>
          <p>We're sorry to inform you that a shift you were signed up for has been cancelled by a coordinator.</p>

          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Cancelled Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${escapeHtml(shiftTitle)}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${escapeHtml(shiftType)}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${escapeHtml(zoneName)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
            ${reason ? `<p style="margin: 8px 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
          </div>

          <p>Please check the VMS for other available shifts you can sign up for.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            We apologize for any inconvenience. Thank you for your understanding!
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    logger.email('Shift cancelled notification sent', { to }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send shift cancelled email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
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

  const dateStr = formatDateInTimezone(shiftDate, branding.timezone);
  const startStr = formatTimeInTimezone(startTime, branding.timezone);
  const endStr = formatTimeInTimezone(endTime, branding.timezone);

  // Generate ICS calendar invite with explicit timezone
  const calendar = icalGenerator({ name: branding.orgName });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: branding.timezone,
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
          <h2 style="color: #0891b2;">You've Been Added to a Shift!</h2>
          <p>Hi ${escapeHtml(volunteerName)},</p>
          <p>${escapeHtml(coordinatorName)} has added you to a volunteer shift. You are confirmed and ready to go!</p>

          <div style="background: #cffafe; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2;">
            <h3 style="margin-top: 0; color: #065f46;">Your Shift</h3>
            <p style="margin: 8px 0;"><strong>Shift:</strong> ${escapeHtml(shiftTitle)}</p>
            <p style="margin: 8px 0;"><strong>Type:</strong> ${escapeHtml(shiftType)}</p>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${escapeHtml(zoneName)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
          </div>

          <p><strong>A calendar invite is attached to this email.</strong> Add it to your calendar so you don't forget!</p>

          <p>If you cannot attend this shift, please log into the VMS and cancel your signup, or contact your coordinator.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for volunteering with ${escapeHtml(branding.orgName)}!
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    logger.email('Shift invite email with calendar invite sent', { to }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send invite email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
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

  // Replace variables in body (escape user content for the variable values)
  const processedBody = body
    .replace(/\{\{volunteerName\}\}/g, escapeHtml(recipientName))
    .replace(/\{\{organizationName\}\}/g, escapeHtml(branding.orgName));

  // The body may contain HTML from templates (shift lists, training lists).
  // Check if it contains HTML tags - if so, use as-is; otherwise convert newlines to <br>
  const containsHtml = /<[a-z][\s\S]*>/i.test(processedBody);
  const htmlBody = containsHtml ? processedBody : processedBody.replace(/\n/g, '<br>');

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
          <div style="background: #0891b2; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">${escapeHtml(branding.orgName)}</h2>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 16px 20px; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 12px 0;">Hi ${escapeHtml(recipientName)},</p>

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
    logger.error('EMAIL', 'Failed to send blast email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
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
      timeZone: DEFAULT_TIMEZONE,
    });
    const startStr = shift.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: DEFAULT_TIMEZONE,
    });
    const endStr = shift.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: DEFAULT_TIMEZONE,
    });
    const spotsLeft = shift.maxVolunteers - shift.confirmedCount;
    const spotsBg = spotsLeft <= 2 ? '#fef3c7' : '#cffafe';

    return `<tr><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(dateStr)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(startStr)} - ${escapeHtml(endStr)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(shift.zone.name)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(shift.title)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;"><span style="background: ${spotsBg}; padding: 2px 6px; border-radius: 10px; font-weight: 600; font-size: 12px;">${spotsLeft}</span></td></tr>`;
  }).join('');

  return `<div style="margin: 16px 0 8px 0;"><h3 style="color: #0891b2; margin: 0 0 8px 0; font-size: 16px;">${headerText}</h3><table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><thead><tr style="background: #f3f4f6;"><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Date</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Time</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Zone</th><th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Shift</th><th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 13px;">Spots</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
      timeZone: DEFAULT_TIMEZONE,
    });
    const startStr = training.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: DEFAULT_TIMEZONE,
    });
    const endStr = training.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: DEFAULT_TIMEZONE,
    });
    const spotsLeft = training.maxAttendees - training.confirmedCount;
    const spotsBg = spotsLeft <= 3 ? '#fef3c7' : '#cffafe';
    const locationStr = training.meetingLink ? 'Virtual' : (training.location || 'TBD');

    return `<tr><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(dateStr)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(startStr)} - ${escapeHtml(endStr)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(training.trainingType.name)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(training.title)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(locationStr)}</td><td style="padding: 6px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;"><span style="background: ${spotsBg}; padding: 2px 6px; border-radius: 10px; font-weight: 600; font-size: 12px;">${spotsLeft}</span></td></tr>`;
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
          <div style="background: #0891b2; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${branding.orgName}</h2>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #374151; margin-top: 0;">Reset Your Password</h2>
            <p>Hi ${escapeHtml(userName)},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                 style="display: inline-block; background: #0891b2; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #0891b2; word-break: break-all;">${resetUrl}</a>
            </p>

            ${getEmailFooter(undefined, branding)}
          </div>
        </div>
      `,
    });
    logger.email('Password reset email sent', { to }).catch(() => {});
    return true;
  } catch (error) {
    logger.error('EMAIL', 'Failed to send password reset email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
    return false;
  }
}

// ============================================
// ACCOUNT VERIFICATION / SIGNUP EMAILS
// ============================================

interface VerifyEmailParams {
  to: string;
  userName: string;
  verificationToken: string;
}

/**
 * Send email verification and password setup email for new signups
 */
export async function sendVerifyEmailAndSetPasswordEmail(params: VerifyEmailParams): Promise<boolean> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping verification email');
    return false;
  }

  const { to, userName, verificationToken } = params;
  const verifyUrl = `${APP_URL}/set-password?token=${verificationToken}`;

  try {
    await sendEmail({
      to,
      subject: `Verify Your Email - ${branding.orgName}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0891b2; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${branding.orgName}</h2>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #374151; margin-top: 0;">Welcome! Verify Your Email</h2>
            <p>Hi ${escapeHtml(userName)},</p>
            <p>Thank you for applying to volunteer with ${branding.orgName}! To complete your application, please verify your email address and set your password.</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${verifyUrl}"
                 style="display: inline-block; background: #0891b2; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Verify Email & Set Password
              </a>
            </div>

            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2;">
              <h4 style="margin-top: 0; color: #0369a1;">What happens next?</h4>
              <ol style="margin: 0; padding-left: 20px; color: #374151;">
                <li style="margin-bottom: 8px;">Click the button above to verify your email and create your password</li>
                <li style="margin-bottom: 8px;">Our team will review your application</li>
                <li>Once approved, you'll receive a welcome email and can start volunteering!</li>
              </ol>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              This link will expire in 48 hours. If you didn't submit this application, you can safely ignore this email.
            </p>

            <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verifyUrl}" style="color: #0891b2; word-break: break-all;">${verifyUrl}</a>
            </p>

            ${getEmailFooter(undefined, branding)}
          </div>
        </div>
      `,
    });
    logger.email('Verification email sent', { to }).catch(() => {});
    return true;
  } catch (error) {
    logger.error('EMAIL', 'Failed to send verification email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
    return false;
  }
}

interface NewApplicationNotificationParams {
  applicantName: string;
  applicantEmail: string;
}

/**
 * Send notification to coordinators/admins when a new volunteer application is verified
 */
export async function sendNewApplicationNotification(params: NewApplicationNotificationParams): Promise<boolean> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping new application notification');
    return false;
  }

  const { applicantName, applicantEmail } = params;

  // Get all coordinators and administrators who have email notifications enabled
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ['COORDINATOR', 'ADMINISTRATOR'] },
      isActive: true,
      emailNotifications: true,
    },
    select: { email: true, name: true },
  });

  if (recipients.length === 0) {
    console.log('[Email] No coordinators/admins to notify about new application');
    return true;
  }

  const reviewUrl = `${APP_URL}/volunteers?status=pending`;

  let successCount = 0;
  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: `New Volunteer Application: ${applicantName}`,
        fromName: branding.emailFromName,
        fromAddress: branding.emailFromAddress,
        replyTo: branding.emailReplyTo,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0891b2; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">${branding.orgName}</h2>
            </div>

            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #374151; margin-top: 0;">New Volunteer Application</h2>
              <p>Hi ${escapeHtml(recipient.name || 'Coordinator')},</p>
              <p>A new volunteer application has been submitted and is ready for review.</p>

              <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2;">
                <h4 style="margin-top: 0; color: #0369a1;">Applicant Details</h4>
                <p style="margin: 8px 0;"><strong>Name:</strong> ${escapeHtml(applicantName)}</p>
                <p style="margin: 8px 0;"><strong>Email:</strong> ${escapeHtml(applicantEmail)}</p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${reviewUrl}"
                   style="display: inline-block; background: #0891b2; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Review Application
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                Please review the application and approve or reject accordingly.
              </p>

              ${getEmailFooter(undefined, branding)}
            </div>
          </div>
        `,
      });
      successCount++;
    } catch (error) {
      logger.error('EMAIL', 'Failed to send new application notification', {
        to: recipient.email,
        error: error instanceof Error ? error.message : 'Unknown'
      }).catch(() => {});
    }
  }

  logger.email('New application notification sent', {
    applicantEmail,
    recipientCount: recipients.length,
    successCount
  }).catch(() => {});

  return successCount > 0;
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
 * Send feedback email - routes to developers or coordinators based on category
 * Developer categories (bug, feature) -> feedbackEmail setting
 * Coordinator categories (suggestion, question, other) -> all active coordinators
 */
export async function sendFeedbackEmail(params: FeedbackEmailParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping feedback email');
    return;
  }

  const { category, message, userEmail, userName, url, userAgent } = params;
  const timestamp = new Date().toLocaleString('en-US', { timeZone: DEFAULT_TIMEZONE });

  // Category display mapping
  const categoryLabels: Record<string, string> = {
    bug: 'Bug Report',
    feature: 'Feature Request',
    suggestion: 'Suggestion',
    question: 'Question',
    other: 'Other',
  };

  const categoryLabel = categoryLabels[category] || category;

  // Determine recipients based on category
  const developerCategories = ['bug', 'feature'];
  const isDevFeedback = developerCategories.includes(category);

  let recipients: string[] = [];

  if (isDevFeedback) {
    // Developer feedback -> feedbackEmail setting
    const settings = await prisma.organizationSettings.findFirst({
      select: { feedbackEmail: true }
    });

    if (settings?.feedbackEmail) {
      recipients = [settings.feedbackEmail];
    } else {
      console.log('[Email] No feedback email configured for developer feedback. Configure in Developer console.');
      return;
    }
  } else {
    // Coordinator feedback -> all active coordinators
    const coordinators = await prisma.user.findMany({
      where: {
        role: 'COORDINATOR',
        isActive: true,
      },
      select: { email: true }
    });

    recipients = coordinators.map(c => c.email);

    if (recipients.length === 0) {
      console.log('[Email] No active coordinators found for feedback. Feedback not sent.');
      return;
    }
  }

  // Build email HTML
  const headerColor = isDevFeedback ? '#7c3aed' : '#0891b2'; // Purple for dev, cyan for coordinator
  const headerTitle = isDevFeedback ? `Developer Feedback: ${escapeHtml(categoryLabel)}` : `Volunteer Feedback: ${escapeHtml(categoryLabel)}`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${headerColor}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${headerTitle}</h2>
        ${userName || userEmail ? `<p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">From: ${escapeHtml(userName || 'Anonymous')}${userEmail ? ` &lt;${escapeHtml(userEmail)}&gt;` : ''}</p>` : '<p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">From: Anonymous (not logged in)</p>'}
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #374151;">Message</h3>
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtmlPreserveBreaks(message)}</p>
        </div>

        <div style="color: #6b7280; font-size: 14px;">
          <h4 style="color: #374151; margin-bottom: 8px;">Details</h4>
          <p style="margin: 4px 0;"><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>
          <p style="margin: 4px 0;"><strong>Submitted:</strong> ${escapeHtml(timestamp)}</p>
          ${url ? `<p style="margin: 4px 0;"><strong>Page:</strong> <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''}
          ${userAgent ? `<p style="margin: 4px 0;"><strong>Browser:</strong> ${escapeHtml(userAgent)}</p>` : ''}
        </div>
      </div>
    </div>
  `;

  // Send to all recipients
  const subject = isDevFeedback
    ? `[RippleVMS] ${categoryLabel}${userName ? ` from ${userName}` : ''}`
    : `[RippleVMS] Volunteer Feedback: ${categoryLabel}${userName ? ` from ${userName}` : ''}`;

  try {
    // Send email to each recipient
    for (const recipient of recipients) {
      await sendEmail({
        to: recipient,
        subject,
        fromName: branding.emailFromName,
        fromAddress: branding.emailFromAddress,
        replyTo: userEmail || branding.emailReplyTo,
        html: emailHtml,
      });
    }
    logger.email('Feedback email sent', { to: recipients.join(', '), category, isDevFeedback }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send feedback email', { error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
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

  const dateStr = formatDateInTimezone(observedAt, branding.timezone);
  const timeStr = formatTimeInTimezone(observedAt, branding.timezone);
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
              <p>Hi ${escapeHtml(dispatcher.name)},</p>
              <p>A new ICE sighting has been reported and needs your attention.</p>

              <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                <h3 style="margin-top: 0; color: #991b1b;">S.A.L.U.T.E. Report</h3>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">S</strong> Size/Strength: ${escapeHtml(size)}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">A</strong> Activity: ${escapeHtml(activity)}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">L</strong> Location: ${escapeHtml(location)}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">U</strong> Uniform: ${escapeHtml(uniform)}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">T</strong> Time: ${escapeHtml(dateStr)} at ${escapeHtml(timeStr)}</p>
                <p style="margin: 8px 0;"><strong style="color: #dc2626;">E</strong> Equipment: ${escapeHtml(equipment)}</p>
                ${hasMedia ? '<p style="margin: 8px 0; color: #0891b2;">📷 Photos/videos attached to this report</p>' : ''}
                ${reporterName ? `<p style="margin: 8px 0; color: #6b7280;">Reporter: ${escapeHtml(reporterName)}</p>` : ''}
              </div>

              <a href="${vmsUrl}/sightings/${escapeHtml(sightingId)}"
                 style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 16px;">
                View Full Report
              </a>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This is an automated notification from ${escapeHtml(branding.orgName)}.<br>
                Please review and update the status as you respond to this sighting.
              </p>

              ${getEmailFooter(dispatcher.unsubscribeToken || undefined, branding)}
            </div>
          </div>
        `,
      });
      logger.email('Sighting notification sent', { to: dispatcher.email, sightingId }).catch(() => {});
    } catch (error) {
      logger.error('EMAIL', 'Failed to send sighting notification', { to: dispatcher.email, sightingId, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
    }
  }
}

// ============================================
// WEEKLY SCHEDULE DIGEST
// ============================================

export interface WeeklyDigestData {
  weekStart: Date;
  weekEnd: Date;
  days: Array<{
    date: Date;
    dateStr: string;
    regionalLead: { name: string; isPrimary: boolean } | null;
    dispatchers: Array<{
      county: string;
      name: string | null;
      isBackup: boolean;
    }>;
    zoneLeads: Array<{
      zone: string;
      name: string | null;
    }>;
  }>;
  totalShifts: number;
  positionsNeeded: number;
}

interface WeeklyDigestEmailParams {
  to: string;
  recipientName: string;
  weekStartDate: Date;
  weekEndDate: Date;
  scheduleData: WeeklyDigestData;
  unsubscribeToken?: string;
}

/**
 * Send weekly schedule digest email
 * Sent on Sundays showing the upcoming week's schedule
 */
export async function sendWeeklyDigestEmail(params: WeeklyDigestEmailParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping weekly digest email');
    return;
  }

  const { to, recipientName, weekStartDate, weekEndDate, scheduleData, unsubscribeToken } = params;

  // Format date range for subject
  const startStr = weekStartDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  });
  const endStr = weekEndDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  });

  // Build day rows HTML
  const dayRowsHtml = scheduleData.days.map(day => {
    const regionalLeadText = day.regionalLead
      ? `${day.regionalLead.name}${day.regionalLead.isPrimary ? '' : ' (Backup)'}`
      : '<span style="color: #dc2626;">(NEEDED)</span>';

    const dispatcherLines = day.dispatchers.map(d => {
      const dispatcherText = d.name || '<span style="color: #dc2626;">(NEEDED)</span>';
      return `<div style="font-size: 13px; margin: 2px 0;">${escapeHtml(d.county)}: ${d.name ? escapeHtml(d.name) : dispatcherText}</div>`;
    }).join('');

    const coveredZones = day.zoneLeads.filter(z => z.name).map(z => z.zone);
    const gapZones = day.zoneLeads.filter(z => !z.name).map(z => z.zone);

    const zoneLeadLines = `
      ${coveredZones.length > 0 ? `<div style="font-size: 13px; margin: 2px 0;"><strong style="color: #059669;">Covered:</strong> ${escapeHtml(coveredZones.join(', '))}</div>` : ''}
      ${gapZones.length > 0 ? `<div style="font-size: 13px; margin: 2px 0;"><strong style="color: #dc2626;">Gaps:</strong> ${escapeHtml(gapZones.join(', '))}</div>` : '<div style="font-size: 13px; color: #059669;">All zones covered!</div>'}
    `;

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <div style="font-weight: 600; color: #374151;">${escapeHtml(day.dateStr)}</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          ${regionalLeadText}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          ${dispatcherLines}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          ${zoneLeadLines}
        </td>
      </tr>
    `;
  }).join('');

  // Summary box
  const hasGaps = scheduleData.positionsNeeded > 0;
  const summaryColor = hasGaps ? '#fef2f2' : '#ecfdf5';
  const summaryBorder = hasGaps ? '#dc2626' : '#059669';
  const summaryTextColor = hasGaps ? '#991b1b' : '#065f46';

  try {
    await sendEmail({
      to,
      subject: `[${branding.orgName}] Weekly Schedule: ${startStr} - ${endStr}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: #0891b2; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Weekly Schedule Overview</h2>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Hi ${escapeHtml(recipientName)},</p>
            <p>Here's the schedule overview for the upcoming week:</p>

            <!-- Summary Box -->
            <div style="background: ${summaryColor}; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${summaryBorder};">
              <h3 style="margin-top: 0; color: ${summaryTextColor};">Week Summary</h3>
              <p style="margin: 8px 0;"><strong>Total Shifts:</strong> ${scheduleData.totalShifts}</p>
              <p style="margin: 8px 0;"><strong>Positions Needed:</strong> ${scheduleData.positionsNeeded > 0 ? `<span style="color: #dc2626;">${scheduleData.positionsNeeded}</span>` : '<span style="color: #059669;">All covered!</span>'}</p>
            </div>

            <!-- Schedule Table -->
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 20px 0;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Day</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Dispatch Coord</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Dispatchers</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Zone Leads</th>
                </tr>
              </thead>
              <tbody>
                ${dayRowsHtml}
              </tbody>
            </table>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 24px 0;">
              <a href="${APP_URL}/coverage"
                 style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Full Schedule
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated weekly digest from ${escapeHtml(branding.orgName)}.<br>
              You're receiving this because you are a coordinator, dispatcher, or administrator.
            </p>

            ${getEmailFooter(unsubscribeToken, branding)}
          </div>
        </div>
      `,
    });
    logger.email('Weekly digest email sent', { to }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send weekly digest email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
    throw error; // Re-throw so caller can track failures
  }
}

/**
 * Dispatcher slot confirmation email params
 */
interface DispatcherSlotConfirmationParams {
  to: string;
  dispatcherName: string;
  county: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  zones: string[];
}

/**
 * Send email when dispatcher claims a slot
 * Includes ICS calendar invite attachment
 */
export async function sendDispatcherSlotConfirmationEmail(params: DispatcherSlotConfirmationParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping dispatcher slot confirmation email');
    return;
  }

  const { to, dispatcherName, county, date, startTime, endTime, zones } = params;

  const dateStr = formatDateInTimezone(date, branding.timezone);
  const startStr = formatTimeInTimezone(startTime, branding.timezone);
  const endStr = formatTimeInTimezone(endTime, branding.timezone);
  const zonesStr = zones.slice(0, 5).join(', ') + (zones.length > 5 ? ` +${zones.length - 5} more` : '');

  // Handle REGIONAL mode vs COUNTY mode for display labels
  const isRegionalMode = county === 'REGIONAL';
  const coverageLabel = isRegionalMode ? 'Regional Coverage' : `${county} County`;
  const scopeLabel = isRegionalMode ? 'Coverage' : 'County';
  const scopeValue = isRegionalMode ? 'Regional (All Zones)' : county;

  // Generate ICS calendar invite with explicit timezone
  const calendar = icalGenerator({ name: branding.orgName });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: branding.timezone,
    summary: `Dispatcher: ${coverageLabel}`,
    description: `${branding.orgName} dispatcher coverage\n\n${scopeLabel}: ${scopeValue}\nZones: ${zones.join(', ')}`,
    organizer: { name: branding.orgName, email: branding.emailFromAddress },
  });

  try {
    await sendEmailWithCalendar({
      to,
      subject: `Dispatcher Assignment Confirmed: ${coverageLabel} on ${dateStr}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      calendarContent: calendar.toString(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Dispatcher Assignment Confirmed!</h2>
          <p>Hi ${escapeHtml(dispatcherName)},</p>
          <p>You've successfully claimed a dispatcher slot. Thank you for stepping up!</p>

          <div style="background: #dbeafe; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="margin-top: 0; color: #1d4ed8;">Your Dispatcher Assignment</h3>
            <p style="margin: 8px 0;"><strong>${escapeHtml(scopeLabel)}:</strong> ${escapeHtml(scopeValue)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
            <p style="margin: 8px 0;"><strong>Zones Covered:</strong> ${escapeHtml(zonesStr)}</p>
          </div>

          <p><strong>A calendar invite is attached to this email.</strong> Add it to your calendar so you don't forget!</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            As dispatcher, you'll coordinate volunteers ${isRegionalMode ? 'across all zones' : `in ${escapeHtml(county)} County`} during this time slot.<br>
            If you need to cancel, please do so as soon as possible so another dispatcher can cover.
          </p>

          ${getEmailFooter(undefined, branding)}
        </div>
      `,
    });
    logger.email('Dispatcher slot confirmation email sent', { to, county }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send dispatcher slot confirmation email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
  }
}

// ============================================
// VOLUNTEER APPLICATION APPROVAL/REJECTION
// ============================================

interface WelcomeEmailParams {
  email: string;
  name: string;
  role: string;
}

/**
 * Send welcome email when volunteer application is approved
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping welcome email');
    return false;
  }

  const { email, name, role } = params;
  const loginUrl = `${APP_URL}/login`;

  // Format role for display
  const roleDisplay: Record<string, string> = {
    VOLUNTEER: 'Volunteer',
    COORDINATOR: 'Coordinator',
    DISPATCHER: 'Dispatcher',
    ADMINISTRATOR: 'Administrator',
  };

  try {
    await sendEmail({
      to: email,
      subject: `Welcome to ${branding.orgName}! Your Account is Approved`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0891b2; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${branding.orgName}</h2>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #059669; margin-top: 0;">🎉 You're Approved!</h2>
            <p>Hi ${escapeHtml(name)},</p>
            <p>Great news! Your volunteer application has been approved. Welcome to the ${branding.orgName} team!</p>

            <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h4 style="margin-top: 0; color: #065f46;">Your Account Details</h4>
              <p style="margin: 8px 0;"><strong>Role:</strong> ${escapeHtml(roleDisplay[role] || role)}</p>
              <p style="margin: 8px 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${loginUrl}"
                 style="display: inline-block; background: #0891b2; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Log In to Get Started
              </a>
            </div>

            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2;">
              <h4 style="margin-top: 0; color: #0369a1;">What's Next?</h4>
              <ul style="margin: 0; padding-left: 20px; color: #374151;">
                <li style="margin-bottom: 8px;">Log in and complete your profile</li>
                <li style="margin-bottom: 8px;">Browse available shifts and sign up</li>
                <li>Check out any required trainings</li>
              </ul>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              If you have any questions, don't hesitate to reach out to our coordinators.
            </p>

            ${getEmailFooter(undefined, branding)}
          </div>
        </div>
      `,
    });
    logger.email('Welcome email sent', { to: email }).catch(() => {});
    return true;
  } catch (error) {
    logger.error('EMAIL', 'Failed to send welcome email', { to: email, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
    return false;
  }
}

interface ApplicationRejectedEmailParams {
  email: string;
  name: string;
  rejectionReason?: string | null;
}

/**
 * Send email when volunteer application is rejected
 */
export async function sendApplicationRejectedEmail(params: ApplicationRejectedEmailParams): Promise<boolean> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping rejection email');
    return false;
  }

  const { email, name, rejectionReason } = params;

  try {
    await sendEmail({
      to: email,
      subject: `Update on Your ${branding.orgName} Application`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #6b7280; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${branding.orgName}</h2>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #374151; margin-top: 0;">Application Update</h2>
            <p>Hi ${escapeHtml(name)},</p>
            <p>Thank you for your interest in volunteering with ${branding.orgName}. After careful review, we're unable to approve your application at this time.</p>

            ${rejectionReason ? `
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
                <h4 style="margin-top: 0; color: #374151;">Reason</h4>
                <p style="margin: 0; color: #4b5563;">${escapeHtml(rejectionReason)}</p>
              </div>
            ` : ''}

            <p>If you have questions about this decision or believe there may have been an error, please don't hesitate to contact us.</p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              We appreciate your interest in ${branding.orgName} and wish you all the best.
            </p>

            ${getEmailFooter(undefined, branding)}
          </div>
        </div>
      `,
    });
    logger.email('Application rejected email sent', { to: email }).catch(() => {});
    return true;
  } catch (error) {
    logger.error('EMAIL', 'Failed to send rejection email', { to: email, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
    return false;
  }
}

// ============================================
// COVERAGE SLOT SIGNUP EMAILS
// ============================================

interface CoverageSignupEmailParams {
  to: string;
  volunteerName: string;
  zoneName: string;
  county: string;
  date: Date;
  startHour: number;
  endHour: number;
  roleType: 'DISPATCHER' | 'ZONE_LEAD' | 'VERIFIER';
  unsubscribeToken?: string;
}

// Format hour to time string (e.g., 6 -> "6:00 AM", 14 -> "2:00 PM")
function formatHourToTime(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

// Get role display name
function getRoleDisplayName(roleType: string): string {
  switch (roleType) {
    case 'DISPATCHER': return 'Dispatcher';
    case 'ZONE_LEAD': return 'Zone Lead';
    case 'VERIFIER': return 'Verifier';
    default: return roleType;
  }
}

/**
 * Send confirmation email when volunteer signs up for a coverage slot
 * Includes ICS calendar invite attachment
 */
export async function sendCoverageSignupConfirmationEmail(params: CoverageSignupEmailParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping coverage signup confirmation email');
    return;
  }

  const { to, volunteerName, zoneName, county, date, startHour, endHour, roleType, unsubscribeToken } = params;

  const dateStr = formatDateInTimezone(date, branding.timezone);
  const startStr = formatHourToTime(startHour);
  const endStr = formatHourToTime(endHour);
  const roleDisplay = getRoleDisplayName(roleType);

  // Create start and end times for calendar event
  const startTime = new Date(date);
  startTime.setHours(startHour, 0, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(endHour, 0, 0, 0);

  // Generate ICS calendar invite
  const calendar = icalGenerator({ name: branding.orgName });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: branding.timezone,
    summary: `Coverage: ${zoneName} (${roleDisplay})`,
    description: `${branding.orgName} coverage slot\n\nZone: ${zoneName}\nCounty: ${county}\nRole: ${roleDisplay}`,
    organizer: { name: branding.orgName, email: branding.emailFromAddress },
  });

  try {
    await sendEmailWithCalendar({
      to,
      subject: `Coverage Confirmed: ${zoneName} on ${dateStr}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
      calendarContent: calendar.toString(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0891b2;">Coverage Slot Confirmed!</h2>
          <p>Hi ${escapeHtml(volunteerName)},</p>
          <p>You've successfully signed up for a coverage slot. Thank you for volunteering!</p>

          <div style="background: #cffafe; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2;">
            <h3 style="margin-top: 0; color: #065f46;">Your Coverage Slot</h3>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${escapeHtml(zoneName)}</p>
            <p style="margin: 8px 0;"><strong>County:</strong> ${escapeHtml(county)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
            <p style="margin: 8px 0;"><strong>Role:</strong> ${escapeHtml(roleDisplay)}</p>
          </div>

          <p><strong>A calendar invite is attached to this email.</strong> Add it to your calendar so you don't forget!</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for volunteering with ${escapeHtml(branding.orgName)}!<br>
            If you need to cancel, please do so as soon as possible via the Coverage page.
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    logger.email('Coverage signup confirmation email sent', { to, zoneName, roleType }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send coverage signup confirmation email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
  }
}

/**
 * Send email when volunteer cancels their coverage signup
 * Includes ICS calendar cancellation attachment to remove the event from calendar
 */
export async function sendCoverageCancellationEmail(params: CoverageSignupEmailParams): Promise<void> {
  const branding = await getBranding();

  if (!isEmailConfigured(branding)) {
    console.log('[Email] SES not configured, skipping coverage cancellation email');
    return;
  }

  const { to, volunteerName, zoneName, county, date, startHour, endHour, roleType, unsubscribeToken } = params;

  const dateStr = formatDateInTimezone(date, branding.timezone);
  const startStr = formatHourToTime(startHour);
  const endStr = formatHourToTime(endHour);
  const roleDisplay = getRoleDisplayName(roleType);

  // Create start and end times for calendar event
  const startTime = new Date(date);
  startTime.setHours(startHour, 0, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(endHour, 0, 0, 0);

  // Generate ICS calendar cancellation
  // Using method: CANCEL and status: CANCELLED to tell calendar apps to remove the event
  const calendar = icalGenerator({ name: branding.orgName, method: ICalCalendarMethod.CANCEL });
  calendar.createEvent({
    start: startTime,
    end: endTime,
    timezone: branding.timezone,
    summary: `Coverage: ${zoneName} (${roleDisplay})`,
    description: `CANCELLED - ${branding.orgName} coverage slot\n\nZone: ${zoneName}\nCounty: ${county}\nRole: ${roleDisplay}`,
    organizer: { name: branding.orgName, email: branding.emailFromAddress },
    status: ICalEventStatus.CANCELLED,
    sequence: 1, // Higher sequence number indicates an update
  });

  try {
    await sendEmailWithCalendar({
      to,
      subject: `Coverage Cancelled: ${zoneName}`,
      fromName: branding.emailFromName,
      fromAddress: branding.emailFromAddress,
      replyTo: branding.emailReplyTo,
      unsubscribeToken,
      calendarContent: calendar.toString(),
      calendarMethod: 'CANCEL',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Coverage Cancellation Confirmed</h2>
          <p>Hi ${escapeHtml(volunteerName)},</p>
          <p>Your coverage signup has been cancelled.</p>

          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Cancelled Slot</h3>
            <p style="margin: 8px 0;"><strong>Zone:</strong> ${escapeHtml(zoneName)}</p>
            <p style="margin: 8px 0;"><strong>County:</strong> ${escapeHtml(county)}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
            <p style="margin: 8px 0;"><strong>Role:</strong> ${escapeHtml(roleDisplay)}</p>
          </div>

          <p><strong>A calendar cancellation is attached to this email.</strong> Your calendar should automatically remove the event.</p>

          <p>If you'd like to sign up for a different slot, please visit the Coverage page.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for letting us know. We hope to see you at a future coverage slot!
          </p>

          ${getEmailFooter(unsubscribeToken, branding)}
        </div>
      `,
    });
    logger.email('Coverage cancellation email with calendar sent', { to, zoneName }).catch(() => {});
  } catch (error) {
    logger.error('EMAIL', 'Failed to send coverage cancellation email', { to, error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
  }
}
