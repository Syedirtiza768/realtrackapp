import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS attacks.
 * Use this wrapper wherever dangerouslySetInnerHTML is needed.
 *
 * @example
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml) }} />
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    // Allow standard listing HTML
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'img', 'table',
      'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'pre', 'code',
      'hr', 'sup', 'sub', 'dl', 'dt', 'dd', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
      'style', 'class', 'id', 'colspan', 'rowspan',
    ],
    // Force links to open safely
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
  });
}

/**
 * Sanitize search highlight HTML — only allows <mark> tags.
 */
export function sanitizeHighlight(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['mark', 'b', 'em', 'strong'],
    ALLOWED_ATTR: ['class'],
  });
}
