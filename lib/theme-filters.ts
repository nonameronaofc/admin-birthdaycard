export const MAX_THEME_FILTER_TAGS = 12;
export const MAX_THEME_FILTER_TAG_LENGTH = 32;

function cleanTag(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_THEME_FILTER_TAG_LENGTH);
}

export function parseThemeTags(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of raw) {
    const tag = cleanTag(item);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_THEME_FILTER_TAGS) break;
  }

  return tags;
}

export function themeTagsToText(tags: unknown): string {
  return parseThemeTags(tags).join(', ');
}
