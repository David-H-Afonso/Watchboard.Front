export function normalizedName(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toUpperCase().toLocaleLowerCase('es');
}

export function locationDisplayName(value: string): string {
  const clean = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const key = normalizedName(clean).replace(/[ _-]/g, '');
  return ({ linux: 'Linux', 'gnu/linux': 'Linux', gnulinux: 'Linux', windows: 'Windows', win: 'Windows', steamdeck: 'Steam Deck', casaos: 'CasaOS', macos: 'macOS', osx: 'macOS' } as Record<string,string>)[key] ?? clean;
}

export const locationSuggestions = ['Linux', 'Steam Deck', 'Windows', 'CasaOS', 'macOS'];
