import type { Dashboard, GameWatch, PricePoint, SoftwareWatch, WidgetItem } from '../types';
import { money } from './format';

export const sourceLabel = (game: Pick<GameWatch, 'provider'>) => game.provider === 'steam' ? 'Steam oficial' : 'AllKeyShop';
export const platformLabel = (platform: string | null) => ({ steam: 'Steam', 'ubisoft-connect': 'Ubisoft Connect', epic: 'Epic Games', gog: 'GOG', 'ea-app': 'EA app', rockstar: 'Rockstar', battlenet: 'Battle.net', 'microsoft-store': 'Microsoft Store' } as Record<string, string>)[platform ?? ''] ?? 'Plataforma sin indicar';
export const deliveryLabel = (delivery: string | null) => delivery === 'gift' ? 'Regalo' : delivery === 'key' ? 'Clave' : delivery === 'direct' ? 'Compra oficial' : 'Entrega sin indicar';
export const languageLabel = (language: string | null) => language === 'en' ? 'Solo inglés' : language ? `Idioma: ${language}` : null;
export const offerLabel = (point: Pick<PricePoint, 'activationPlatform' | 'deliveryType' | 'languageRestriction'>) =>
  [platformLabel(point.activationPlatform), deliveryLabel(point.deliveryType), languageLabel(point.languageRestriction)].filter(Boolean).join(' · ');
export const freshPrice = (watch: GameWatch) => watch.current !== null && !watch.error && !watch.stale;

export const officialSteamWatch = (watches: GameWatch[]) => recommendedWatch(watches.filter(watch => watch.provider === 'steam'));

export function recommendedWatch(watches: GameWatch[]): GameWatch | undefined {
  const fresh = watches.filter(freshPrice);
  const cheapest = (items: GameWatch[]) => items.reduce<GameWatch | undefined>((lowest, watch) => !lowest || watch.current!.priceCents < lowest.current!.priceCents ? watch : lowest, undefined);
  const markets = fresh.filter(watch => watch.provider === 'allkeyshop');
  const steamMarkets = markets.filter(watch => watch.current!.activationPlatform === 'steam');
  const market = cheapest(steamMarkets.length ? steamMarkets : markets);
  const official = cheapest(fresh.filter(watch => watch.provider === 'steam'));
  // Select a real source; NEVER clamp a market observation or inherit another source's goal.
  if (official && (!market || official.current!.priceCents <= market.current!.priceCents)) return official;
  return market ?? watches.find(watch => watch.current) ?? watches.find(watch => watch.provider === 'steam') ?? watches[0];
}
export const paymentLabel = (method: string | null) => method === 'card' ? 'Tarjeta' : method === 'paypal' ? 'PayPal' : method === 'best' ? 'Menor total · tarjeta / PayPal' : 'Pago sin indicar';
export const hasSoftwareUpdate = (watch: SoftwareWatch) => watch.comparison === 'update' && !watch.stale && !watch.error && !watch.detectionError && !!watch.installedVersion && !!watch.latestVersion;
export const onSale = (game: GameWatch) => game.provider === 'steam' && !game.stale && !game.error &&
  game.current !== null && (game.current.discountPercent ?? 0) > 0 && (game.current.originalPriceCents ?? 0) > game.current.priceCents;

export function priceState(game: GameWatch): { label: string; tone: string } {
  if (game.error) return { label: 'Error de fuente', tone: 'error' };
  if (!game.current) return { label: 'Pendiente', tone: 'muted' };
  if (game.stale) return { label: 'Lectura antigua', tone: 'muted' };
  if (game.targetReached) return { label: 'Objetivo alcanzado', tone: 'success' };
  if (onSale(game)) return { label: `Rebaja −${game.current.discountPercent}%`, tone: 'teal' };
  return { label: game.targetCents === null ? 'Sin objetivo' : 'En seguimiento', tone: 'muted' };
}

export interface GameGroup { key: string; name: string; watches: GameWatch[]; keys: GameWatch[]; steam: GameWatch[] }
export function gameGroupKey(game: GameWatch): string {
  const appId = game.steamAppId ?? (game.provider === 'steam' ? game.sourceUrl.match(/\/app\/(\d+)/)?.[1] : null);
  if (!appId) return `source:${game.id}`;
  let edition = game.edition.normalize('NFKC').trim().toLowerCase();
  // A non-Standard market edition only joins this Steam SKU after an explicit verified link.
  // Merely carrying a guessed/imported app ID or dropping an edition word is not sufficient.
  if (game.provider === 'allkeyshop' && game.counterpartStatus === 'verified' && game.counterpartUrl) {
    try {
      const link = new URL(game.counterpartUrl);
      if (link.protocol === 'https:' && link.hostname === 'store.steampowered.com' && link.pathname.match(/^\/app\/(\d+)\/?$/)?.[1] === appId)
        edition = 'standard';
    } catch { /* An invalid link never establishes a product mapping. */ }
  }
  return `steam:${appId}:${edition}`;
}
export function groupGames(games: GameWatch[]): GameGroup[] {
  const grouped = new Map<string, GameGroup>();
  for (const game of games) {
    const key = gameGroupKey(game);
    const group = grouped.get(key) ?? { key, name: game.name, watches: [], keys: [], steam: [] };
    group.watches.push(game);
    (game.provider === 'steam' ? group.steam : group.keys).push(game);
    grouped.set(key, group);
  }
  return [...grouped.values()];
}

export function widgetItems(data: Dashboard): WidgetItem[] {
  const prefs = data.preferences;
  const items: WidgetItem[] = [];
  if (prefs.showVersions) for (const watch of data.software) {
    if (!watch.includeInWidget) continue;
    if (prefs.softwareLocationIds !== null && (!watch.locationId || !prefs.softwareLocationIds.includes(watch.locationId))) continue;
    const updated = hasSoftwareUpdate(watch);
    if (prefs.softwareUpdatesOnly && !updated) continue;
    const error = prefs.showErrors && (!!watch.error || !!watch.detectionError || watch.stale && !!watch.latestVersion);
    if (prefs.onlyActionable && !updated && !error) continue;
    const kind = error ? 'error' : updated ? 'version' : 'software';
    items.push({ id: `${watch.id}:${kind}`, watchId: watch.id, kind,
      title: watch.name, value: `${watch.installedVersion ?? '—'} → ${watch.latestVersion ?? '—'}`,
       detail: [watch.locationName, error ? 'Fuente no disponible' : updated ? 'Actualización disponible' : !watch.installedVersion ? 'Versión instalada sin indicar' : 'Sin actualización confirmada'].filter(Boolean).join(' · '),
      sourceUrl: watch.releaseUrl ?? watch.sourceUrl, observedAt: watch.lastSuccessAt });
  }
  if (prefs.showGames) for (const game of data.games) {
    if (!game.includeInWidget) continue;
    const fresh = !game.stale && !game.error && game.current !== null;
    const kind = fresh && game.targetReached ? 'target' : fresh && prefs.showSales && onSale(game) ? 'sale' :
      fresh && prefs.showPriceDrops && (game.changeCents ?? 0) < 0 ? 'drop' : (game.error || game.stale && game.current) && prefs.showErrors ? 'error' : 'game';
    if (prefs.onlyActionable && kind === 'game') continue;
    items.push({ id: `${game.id}:${kind}`, watchId: game.id, kind, title: game.name, value: money(game.current?.priceCents),
      detail: `${sourceLabel(game)}${game.provider === 'allkeyshop' && game.current ? ` · ${offerLabel(game.current)}` : ''} · ${kind === 'target' ? `objetivo ${money(game.targetCents)}` : kind === 'sale' ? `−${game.current?.discountPercent}%` :
        kind === 'drop' ? `baja ${money(Math.abs(game.changeCents!))}` : kind === 'error' ? 'fuente no disponible' : game.stale ? 'lectura antigua' : 'en seguimiento'}`,
      sourceUrl: game.current?.offerUrl ?? game.sourceUrl, observedAt: game.current?.observedAt ?? null });
  }
  const priorities = { target: 0, version: 1, sale: 2, drop: 3, error: 4, software: 5, game: 6 };
  return items.sort((a,b) => priorities[a.kind] - priorities[b.kind]).slice(0, prefs.maxItems);
}
