/**
 * Normalize a string for diacritic-insensitive matching.
 * PDFs and other sources often strip accents (e.g. "Jokic" vs "Jokić").
 * Uses NFD decomposition and removes combining marks so "ć" and "c" match.
 */
export function normalizeNameForMatch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .trim();
}
