// =============================================================================
// lib/notifications/template-utils.ts
// Utilities for rendering {{variable}} placeholders in notification templates.
// =============================================================================

/**
 * Replace all {{variable}} placeholders in a string with the corresponding
 * values from the provided map. Unknown variables are left as-is.
 *
 * @example
 *   interpolate('Hola {{first_name}}!', { first_name: 'Ana' })
 *   // → 'Hola Ana!'
 */
export function interpolate(
  template: string,
  variables: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value != null ? String(value) : match;
  });
}

/**
 * Render both the HTML body and plain-text body of an email template,
 * applying the same variable map to both.
 */
export function renderEmailTemplate(
  htmlBody:  string,
  plainBody: string,
  subject:   string,
  variables: Record<string, string | number | undefined | null>
): { html: string; text: string; subject: string } {
  return {
    html:    interpolate(htmlBody, variables),
    text:    interpolate(plainBody, variables),
    subject: interpolate(subject, variables),
  };
}

/**
 * Render a push notification template (title + message).
 */
export function renderPushTemplate(
  title:     string,
  message:   string,
  variables: Record<string, string | number | undefined | null>
): { title: string; message: string } {
  return {
    title:   interpolate(title, variables),
    message: interpolate(message, variables),
  };
}

/**
 * Extract all placeholder names from a template string.
 * Useful for building the variables documentation list.
 *
 * @example
 *   extractVariables('Hola {{first_name}}, tu ticket {{ticket_id}}')
 *   // → ['first_name', 'ticket_id']
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const names = [...matches].map((m) => m[1]);
  // Deduplicate while preserving order
  return [...new Set(names)];
}

/**
 * Validate that all required variables for a template are present in the
 * provided map and have non-empty values. Returns an array of missing keys.
 */
export function validateVariables(
  requiredVariables: string[],
  provided: Record<string, string | number | undefined | null>
): string[] {
  return requiredVariables.filter(
    (key) => provided[key] == null || provided[key] === ''
  );
}
