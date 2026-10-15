type Option = { id: string; label: string };

/** Case- and accent-insensitive form used to match athlete names. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Keeps the options whose label contains every typed word, in any order. */
export function filterAthleteOptions<T extends Option>(athletes: T[], query: string): T[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return athletes;
  return athletes.filter((athlete) => {
    const label = normalize(athlete.label);
    return terms.every((term) => label.includes(term));
  });
}
