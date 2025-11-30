import nodemailer from 'nodemailer';
import icalGenerator from 'ical-generator';

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

  const dateStr = shiftDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const startStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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

  const dateStr = shiftDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const startStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Generate ICS calendar invite
  const calendar = icalGenerator({ name: 'Siembra NC VMS' });
  calendar.createEvent({
    start: startTime,
    end: endTime,
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

  const dateStr = shiftDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const startStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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

  const dateStr = shiftDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const startStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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
