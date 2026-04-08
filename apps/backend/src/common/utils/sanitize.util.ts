import sanitizeHtml from 'sanitize-html';

/**
 * Recursively sanitizes strings in an object or array to prevent XSS.
 * Useful for Zod `preprocess` wrappers around DTOs.
 */
export function sanitizeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    return sanitizeHtml(input, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'width', 'height'],
      },
      allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
    });
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (input !== null && typeof input === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitizedObj[key] = sanitizeInput(value);
    }
    return sanitizedObj;
  }

  return input;
}
