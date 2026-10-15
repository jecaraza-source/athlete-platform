type Option = { id: string; label: string };

/** Case- and accent-insensitive form used to match athlete names. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** True when `text` contains every word typed in `query`, in any order. */
export function matchesSearch(text: string, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const haystack = normalize(text);
  return terms.every((term) => haystack.includes(term));
}

/** Keeps the options whose label contains every typed word, in any order. */
export function filterAthleteOptions<T extends Option>(athletes: T[], query: string): T[] {
  return athletes.filter((athlete) => matchesSearch(athlete.label, query));
}
