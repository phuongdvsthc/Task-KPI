/**
 * Text Normalization for AI Knowledge Processing (AI-C2)
 */

export class TextNormalizer {
  /**
   * Normalizes raw extracted text for consistent chunking and vector embedding.
   */
  public static normalize(text: string): string {
    if (!text) return '';

    // 1. Unicode NFC normalization (critical for Vietnamese accents)
    let normalized = text.normalize('NFC');

    // 2. Remove null bytes and non-printable control characters (keep \t, \n, \r)
    normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 3. Normalize Windows and legacy line breaks to standard Unix \n
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 4. Normalize non-breaking spaces and other Unicode spaces to standard ASCII space
    normalized = normalized.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

    // 5. Collapse consecutive spaces and tabs on a line
    normalized = normalized.replace(/[ \t]+/g, ' ');

    // 6. Remove trailing/leading spaces on each individual line
    normalized = normalized
      .split('\n')
      .map(line => line.trim())
      .join('\n');

    // 7. Collapse more than two consecutive empty lines down to two newlines (paragraph boundary)
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    return normalized.trim();
  }

  /**
   * Cleans section titles, removing markdown headers, numbering colons, and extra spacing.
   */
  public static cleanSectionTitle(title: string): string {
    if (!title) return '';
    return title
      .replace(/^[#\s\-*:]+/, '')
      .replace(/[:\s]+$/, '')
      .trim();
  }
}
