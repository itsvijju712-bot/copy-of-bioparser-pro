const WHITESPACE_REGEX = /\s+/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ENTITY_REGEX = /&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/;
const LIKELY_MOJIBAKE_REGEX = /(?:\u00C3.|\u00C2.|\u00E2.)/;

let entityDecoder: HTMLTextAreaElement | null = null;

const decodeEntities = (value: string) => {
  if (!value || !ENTITY_REGEX.test(value)) return value;
  if (typeof document === 'undefined') return value;
  entityDecoder ??= document.createElement('textarea');
  entityDecoder.innerHTML = value;
  return entityDecoder.value;
};

const mojibakeScore = (value: string) => {
  const replacementCount = (value.match(/\uFFFD/g) ?? []).length;
  const artifactCount = (value.match(/[\u00C3\u00C2\u00E2]/g) ?? []).length;
  return replacementCount * 4 + artifactCount;
};

const repairLikelyMojibake = (value: string) => {
  if (!LIKELY_MOJIBAKE_REGEX.test(value)) return value;
  if ([...value].some(char => char.charCodeAt(0) > 255)) return value;

  const bytes = Uint8Array.from(value, char => char.charCodeAt(0));
  const repaired = new TextDecoder('utf-8').decode(bytes);
  return mojibakeScore(repaired) < mojibakeScore(value) ? repaired : value;
};

export const normalizeExtractedText = (value: string) => {
  const repaired = repairLikelyMojibake(value ?? '');
  const decoded = decodeEntities(repaired);
  return decoded
    .normalize('NFC')
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(CONTROL_CHAR_REGEX, '')
    .replace(WHITESPACE_REGEX, ' ')
    .trim();
};

export const trimTrailingFullStop = (value: string) =>
  normalizeExtractedText(value).replace(/\.\s*$/, '').trim();
