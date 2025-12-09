/**
 * HTML escaping utilities for preventing XSS in email templates
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 * @param str - String to escape
 * @returns Escaped string safe for HTML insertion
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) {
    return '';
  }

  return String(str).replace(/[&<>"'`=/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Escape HTML but preserve line breaks as <br> tags
 * Useful for user-provided text content in emails
 * @param str - String to escape
 * @returns Escaped string with <br> for line breaks
 */
export function escapeHtmlPreserveBreaks(str: string | null | undefined): string {
  if (str === null || str === undefined) {
    return '';
  }

  // First escape HTML entities
  let escaped = escapeHtml(str);

  // Then convert newlines to <br> tags
  // Collapse multiple blank lines into double <br>
  escaped = escaped.replace(/\n{3,}/g, '\n\n');
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

/**
 * Sanitize a URL for use in href attributes
 * Prevents javascript: and data: URLs
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if unsafe
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  const trimmedUrl = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    trimmedUrl.startsWith('javascript:') ||
    trimmedUrl.startsWith('data:') ||
    trimmedUrl.startsWith('vbscript:')
  ) {
    return '';
  }

  // Escape the URL for use in HTML attributes
  return escapeHtml(url);
}
