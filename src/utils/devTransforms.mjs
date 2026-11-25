/**
 * Pure developer transform utilities: Base64, URL encoding, JWT inspection,
 * and epoch timestamp conversion.
 */

export function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64Utf8(text) {
  const cleaned = text.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = cleaned.padEnd(cleaned.length + ((4 - (cleaned.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeUrlText(text) {
  return encodeURIComponent(text);
}

export function decodeUrlText(text) {
  return decodeURIComponent(text);
}

export function decodeJwtToken(token) {
  const parts = token.trim().split('.');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error('Invalid JWT format');
  }
  const header = JSON.parse(decodeBase64Utf8(parts[0]));
  const payload = JSON.parse(decodeBase64Utf8(parts[1]));
  return JSON.stringify(
    {
      header,
      payload,
      signature: parts[2] || ''
    },
    null,
    2
  );
}

export function convertTimestampText(text) {
  const trimmed = text.trim();
  if (!/^-?\d{10,16}$/.test(trimmed)) {
    throw new Error('Invalid Unix timestamp');
  }
  const num = Number(trimmed);
  const ms = trimmed.length <= 10 ? num * 1000 : num;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return JSON.stringify(
    {
      input: trimmed,
      unit: trimmed.length <= 10 ? 'seconds' : 'milliseconds',
      iso: date.toISOString(),
      utc: date.toUTCString(),
      local: date.toString()
    },
    null,
    2
  );
}
