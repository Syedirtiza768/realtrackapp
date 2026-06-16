/**
 * sanitizeJson — Fix common LLM JSON output issues.
 *
 * LLMs frequently produce JSON with:
 * - Trailing commas in arrays/objects
 * - Markdown code fences wrapping the JSON
 * - Extra text before/after the JSON object
 * - Unescaped newlines inside string values
 * - Single quotes instead of double quotes (rare but happens)
 *
 * This function applies a cascade of fixes and returns the parsed object.
 * Throws if the JSON cannot be salvaged.
 */
export function sanitizeJson(raw: string): unknown {
  if (!raw || typeof raw !== 'string') {
    throw new Error('sanitizeJson: input must be a non-empty string');
  }

  let cleaned = raw.trim();

  // 1. Remove markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');

  // 2. Extract the outermost JSON object or array
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let start = -1;
  let isArray = false;

  if (firstBrace >= 0 && firstBracket >= 0) {
    if (firstBracket < firstBrace) {
      start = firstBracket;
      isArray = true;
    } else {
      start = firstBrace;
    }
  } else if (firstBrace >= 0) {
    start = firstBrace;
  } else if (firstBracket >= 0) {
    start = firstBracket;
    isArray = true;
  }

  if (start < 0) {
    throw new Error('sanitizeJson: no JSON object or array found in input');
  }

  cleaned = cleaned.substring(start);

  // Find the matching closing bracket/brace
  const openChar = isArray ? '[' : '{';
  const closeChar = isArray ? ']' : '}';
  let depth = 0;
  let lastClose = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        lastClose = i;
        break;
      }
    }
  }

  if (lastClose > 0) {
    cleaned = cleaned.substring(0, lastClose + 1);
  }

  // 3. Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with fixes
  }

  // 4. Fix trailing commas: ,] → ] and ,} → }
  let fixed = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // 5. Fix trailing commas on separate lines (common in LLM output)
  //    e.g.,  "value",\n    ]  →  "value"\n    ]
  fixed = fixed.replace(/,(\s*\n\s*[}\]])/g, '$1');

  try {
    return JSON.parse(fixed);
  } catch {
    // Continue with more aggressive fixes
  }

  // 6. Fix unescaped control characters inside strings
  //    Replace literal newlines/tabs inside string values
  let inStr = false;
  let esc = false;
  const chars = [...fixed];
  const result: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (esc) {
      result.push(ch);
      esc = false;
      continue;
    }

    if (ch === '\\' && inStr) {
      result.push(ch);
      esc = true;
      continue;
    }

    if (ch === '"') {
      inStr = !inStr;
      result.push(ch);
      continue;
    }

    if (inStr) {
      // Escape literal newlines, tabs, and carriage returns
      if (ch === '\n') {
        result.push('\\n');
      } else if (ch === '\r') {
        result.push('\\r');
      } else if (ch === '\t') {
        result.push('\\t');
      } else {
        result.push(ch);
      }
    } else {
      result.push(ch);
    }
  }

  const escaped = result.join('');

  try {
    return JSON.parse(escaped);
  } catch {
    // Continue
  }

  // 7. Last resort: collapse all whitespace and retry
  const collapsed = escaped.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

  try {
    return JSON.parse(collapsed);
  } catch (finalError: any) {
    throw new Error(
      `sanitizeJson: unable to parse JSON after all fixes. Last error: ${finalError.message}`
    );
  }
}
