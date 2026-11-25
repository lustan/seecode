/**
 * Pure JSON formatting, sorting, compression, and string escape utilities.
 */

export function sortJsonKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortJsonKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Parses JSON text, falling back to stripping trailing commas outside strings
 * if strict JSON.parse fails.
 */
export function parseJsonLenient(text) {
  try {
    return JSON.parse(text);
  } catch (strictErr) {
    const cleaned = stripTrailingCommas(text);
    if (cleaned !== text) {
      return JSON.parse(cleaned);
    }
    throw strictErr;
  }
}

function stripTrailingCommas(input) {
  let out = '';
  let inString = false;
  let quote = '"';
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (j < input.length && (input[j] === '}' || input[j] === ']')) {
        continue;
      }
    }

    out += ch;
  }

  return out;
}

export function formatJsonText(text, { sortKeys = false, indent = 2 } = {}) {
  const parsed = parseJsonLenient(text);
  const target = sortKeys ? sortJsonKeysDeep(parsed) : parsed;
  return JSON.stringify(target, null, indent);
}

export function compressJsonText(text) {
  const parsed = parseJsonLenient(text);
  return JSON.stringify(parsed);
}

export function unescapeJsonText(text) {
  const trimmed = text.trim();
  if (!trimmed) return text;

  // Case 1: The whole payload is a JSON-encoded string literal, e.g. "{\"a\":1}"
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      try {
        return JSON.stringify(JSON.parse(parsed), null, 2);
      } catch {
        return parsed;
      }
    }
  }

  // Case 2: Raw escaped fragment like {\"a\":1} or \"hello\"
  const unescaped = text
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');

  try {
    return JSON.stringify(JSON.parse(unescaped), null, 2);
  } catch {
    return unescaped;
  }
}

export function escapeJsonText(text) {
  return JSON.stringify(text);
}
