/**
 * Alert System for RippleVMS
 *
 * Sends email alerts to DEVELOPER users + joshcottrell@gmail.com
 * when critical system events occur. Implements cooldowns to
 * prevent alert fatigue.
 */

import { prisma } from '@/lib/db';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Alert configurations
interface AlertConfig {
  type: string;
  cooldownMinutes: number;
  subject: string;
}

const ALERT_CONFIGS: AlertConfig[] = [
  { type: 'db_connection_error', cooldownMinutes: 15, subject: 'Database Connection Error' },
  { type: 'email_service_down', cooldownMinutes: 15, subject: 'Email Service Down' },
  { type: 'redis_down', cooldownMinutes: 30, subject: 'Redis Service Down' },
  { type: 'high_error_rate', cooldownMinutes: 30, subject: 'High API Error Rate' },
  { type: 'critical_error', cooldownMinutes: 5, subject: 'Critical Error Occurred' },
  { type: 'email_failure_rate', cooldownMinutes: 30, subject: 'High Email Failure Rate' },
  { type: 'test_alert', cooldownMinutes: 1, subject: 'Test Alert' },
];

// Always include this email in alerts (in addition to DEVELOPER users)
const ALWAYS_ALERT_EMAIL = 'joshcottrell@gmail.com';

/**
 * Check if we should send an alert (respects cooldown)
 */
async function shouldAlert(alertType: string): Promise<boolean> {
  try {
    const state = await prisma.alertState.findUnique({
      where: { alertType },
    });

    if (!state) return true;
    if (state.cooldownUntil && state.cooldownUntil > new Date()) {
      console.log(`[Alerts] Skipping ${alertType} - in cooldown until ${state.cooldownUntil}`);
      return false;
    }

    return true;
  } catch (error) {
    // If we can't check, allow the alert
    console.error('[Alerts] Error checking cooldown:', error);
    return true;
  }
}

/**
 * Update alert state with new cooldown
 */
async function updateAlertState(alertType: string): Promise<void> {
  try {
    const config = ALERT_CONFIGS.find((c) => c.type === alertType);
    const cooldownMinutes = config?.cooldownMinutes || 15;
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

    await prisma.alertState.upsert({
      where: { alertType },
      create: {
        alertType,
        lastTriggeredAt: new Date(),
        triggerCount: 1,
        cooldownUntil,
      },
      update: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
        cooldownUntil,
      },
    });
  } catch (error) {
    console.error('[Alerts] Error updating alert state:', error);
  }
}

/**
 * Get all email addresses that should receive alerts
 */
async function getAlertRecipients(): Promise<string[]> {
  const recipients = new Set<string>();

  // Always add the primary admin email
  recipients.add(ALWAYS_ALERT_EMAIL);

  try {
    // Get all DEVELOPER users
    const developers = await prisma.user.findMany({
      where: {
        role: 'DEVELOPER',
        isActive: true,
      },
      select: { email: true },
    });

    for (const dev of developers) {
      recipients.add(dev.email);
    }
  } catch (error) {
    console.error('[Alerts] Error fetching developer emails:', error);
  }

  return Array.from(recipients);
}

/**
 * Get the verified from email from OrganizationSettings (same as main email system)
 */
async function getFromEmail(): Promise<string | null> {
  try {
    const settings = await prisma.organizationSettings.findFirst();
    if (settings?.emailFromAddress) {
      return settings.emailFromAddress;
    }
  } catch (error) {
    console.error('[Alerts] Error fetching org settings:', error);
  }
  // Fallback to env var
  return process.env.SES_FROM_EMAIL || process.env.EMAIL_FROM || null;
}

/**
 * Send an alert email
 * Uses the same SES config as main email system
 */
async function sendAlertEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    const ses = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const fromEmail = await getFromEmail();
    if (!fromEmail) {
      console.error('[Alerts] No from email configured');
      return false;
    }

    // RFC 2047 encode the display name for proper email client handling
    const encodedName = `=?UTF-8?B?${Buffer.from('RippleVMS Alerts').toString('base64')}?=`;

    await ses.send(
      new SendEmailCommand({
        Source: `${encodedName} <${fromEmail}>`,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: `[VMS Alert] ${subject}` },
          Body: {
            Html: {
              Data: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .alert-box { background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .alert-title { color: #dc2626; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .alert-body { color: #1f2937; line-height: 1.6; }
    .footer { color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="alert-box">
    <div class="alert-title">🚨 ${subject}</div>
    <div class="alert-body">${body}</div>
  </div>
  <div class="footer">
    <p>This is an automated alert from RippleVMS production monitoring.</p>
    <p>Timestamp: ${new Date().toISOString()}</p>
    <p>Environment: ${process.env.NEXT_PUBLIC_VERCEL_ENV || 'unknown'}</p>
  </div>
</body>
</html>
              `,
            },
            Text: {
              Data: `[VMS Alert] ${subject}\n\n${body}\n\nTimestamp: ${new Date().toISOString()}`,
            },
          },
        },
      })
    );

    return true;
  } catch (error) {
    console.error(`[Alerts] Failed to send alert to ${to}:`, error);
    return false;
  }
}

/**
 * Send an alert to all configured recipients
 */
export async function sendAlert(
  alertType: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Check cooldown
  if (!(await shouldAlert(alertType))) {
    return;
  }

  // Get alert configuration
  const config = ALERT_CONFIGS.find((c) => c.type === alertType);
  const subject = config?.subject || alertType.replace(/_/g, ' ');

  // Build message body
  let body = `<p>${message}</p>`;
  if (metadata && Object.keys(metadata).length > 0) {
    body += '<p><strong>Details:</strong></p><ul>';
    for (const [key, value] of Object.entries(metadata)) {
      body += `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`;
    }
    body += '</ul>';
  }

  // Get recipients
  const recipients = await getAlertRecipients();

  if (recipients.length === 0) {
    console.warn('[Alerts] No recipients configured for alerts');
    return;
  }

  console.log(`[Alerts] Sending ${alertType} alert to ${recipients.length} recipients`);

  // Send to all recipients
  let successCount = 0;
  for (const email of recipients) {
    const success = await sendAlertEmail(email, subject, body);
    if (success) successCount++;
  }

  console.log(`[Alerts] Sent ${successCount}/${recipients.length} alert emails`);

  // Update cooldown state
  await updateAlertState(alertType);
}

/**
 * Convenience methods for common alert types
 */
export const alerts = {
  /**
   * Database connection error
   */
  databaseError: (error: string) =>
    sendAlert('db_connection_error', `Database connection failed: ${error}`, { error }),

  /**
   * Email service down
   */
  emailServiceDown: (error: string) =>
    sendAlert('email_service_down', `Email service (SES) is unreachable: ${error}`, { error }),

  /**
   * Redis service down
   */
  redisDown: (error: string) =>
    sendAlert('redis_down', `Redis service is unreachable: ${error}`, { error }),

  /**
   * High API error rate
   */
  highErrorRate: (errorRate: number, windowMinutes: number) =>
    sendAlert(
      'high_error_rate',
      `API error rate is ${(errorRate * 100).toFixed(1)}% over the last ${windowMinutes} minutes`,
      { errorRate, windowMinutes }
    ),

  /**
   * Critical error occurred
   */
  criticalError: (message: string, metadata?: Record<string, unknown>) =>
    sendAlert('critical_error', message, metadata),

  /**
   * High email failure rate
   */
  emailFailureRate: (failureRate: number, failedCount: number, totalCount: number) =>
    sendAlert(
      'email_failure_rate',
      `Email delivery failure rate is ${(failureRate * 100).toFixed(1)}% (${failedCount}/${totalCount} failed)`,
      { failureRate, failedCount, totalCount }
    ),
};

export default alerts;
