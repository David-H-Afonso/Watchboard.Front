import type { Dashboard, DashboardLoad, GameWatch, SoftwareWatch, User, WidgetPreferences } from '../types';
import { compareVersions } from '../lib/format';
import { HttpError } from './api';

const CACHE_PREFIX = 'watchboard.dashboard.v4.';
const DIRECT_INTERVAL_MS = 5 * 60_000;
interface SavedDashboard { schema: 4; owner: string; savedAt: string; directCheckedAt: string | null; directSucceeded: boolean; data: Dashboard }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const text = (value: unknown, length = 500): value is string => typeof value === 'string' && value.length <= length;
const nullableText = (value: unknown) => value === null || text(value);
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const nullableDate = (value: unknown) => value === null || date(value);
const cents = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000;

export function isUser(value: unknown): value is User {
  return record(value) && text(value.id, 100) && text(value.username, 100) && text(value.displayName, 100) &&
    typeof value.isAdmin === 'boolean' && typeof value.enabled === 'boolean';
}
export function isPreferences(value: unknown): value is WidgetPreferences {
  return record(value) && ['onlyActionable', 'showVersions', 'showGames', 'showSales', 'showPriceDrops', 'showErrors', 'softwareUpdatesOnly'].every(key => typeof value[key] === 'boolean') &&
    typeof value.maxItems === 'number' && Number.isInteger(value.maxItems) && value.maxItems >= 1 && value.maxItems <= 30 &&
    (value.softwareLocationIds === null || Array.isArray(value.softwareLocationIds) && value.softwareLocationIds.length <= 100 && value.softwareLocationIds.every(id => text(id, 100)) && new Set(value.softwareLocationIds).size === value.softwareLocationIds.length);
}
export function isDashboard(value: unknown): value is Dashboard {
  if (!record(value) || !isUser(value.user) || !isPreferences(value.preferences) || !date(value.generatedAt) || !text(value.host) || !text(value.platform) ||
    typeof value.pollingEnabled !== 'boolean' || typeof value.priceIntervalMinutes !== 'number' || typeof value.versionIntervalMinutes !== 'number' ||
    !Array.isArray(value.software) || !Array.isArray(value.games) || value.software.length > 100 || value.games.length > 100 ||
    !Array.isArray(value.locations) || value.locations.length > 100 || !value.locations.every((item: unknown) => record(item) && text(item.id, 100) && text(item.name, 100))) return false;
  const locations = new Map((value.locations as Array<{ id: string; name: string }>).map(location => [location.id, location.name]));
  if (locations.size !== value.locations.length || value.preferences.softwareLocationIds?.some(id => !locations.has(id))) return false;
  const softwareValid = value.software.every((item: unknown) => record(item) && text(item.id) && text(item.name) && text(item.source) && text(item.sourceUrl) &&
    ['pc', 'server', 'project'].includes(String(item.group)) && ['github', 'github-tags', 'npm', 'node-lts', 'dotnet'].includes(String(item.provider)) &&
    ['update', 'current', 'ahead', 'unknown'].includes(String(item.comparison)) && typeof item.stale === 'boolean' && typeof item.includeInWidget === 'boolean' &&
    ['installedVersion', 'installedOn', 'installedMethod', 'localTool', 'detectionError', 'latestVersion', 'releaseUrl', 'error'].every(key => nullableText(item[key])) &&
    ['installedCheckedAt', 'lastAttemptAt', 'lastSuccessAt', 'releasePublishedAt'].every(key => nullableDate(item[key])) &&
    (item.locationId === null ? item.locationName === null : text(item.locationId, 100) && locations.get(item.locationId) === item.locationName));
  const pointValid = (point: unknown) => record(point) && typeof point.id === 'number' && date(point.observedAt) && cents(point.priceCents) && point.currency === 'EUR' &&
    ['merchant', 'region', 'edition', 'offerUrl'].every(key => text(point[key])) && nullableText(point.coupon) && typeof point.matchingOffers === 'number' &&
    (point.originalPriceCents === null || cents(point.originalPriceCents)) && nullableDate(point.saleEndsAt) &&
    (point.discountPercent === null || typeof point.discountPercent === 'number' && point.discountPercent >= 0 && point.discountPercent <= 100) &&
    (point.paymentMethod === null || ['card', 'paypal'].includes(String(point.paymentMethod))) && ['included', 'not_applicable', 'unknown'].includes(String(point.feeBasis)) &&
    nullableText(point.activationPlatform) && ['key', 'gift', 'direct', 'unknown'].includes(String(point.deliveryType)) && nullableText(point.languageRestriction) &&
    (point.basePriceCents === null || cents(point.basePriceCents)) && (point.feeCents === null || cents(point.feeCents)) &&
    (point.basePriceCents === null || point.feeCents === null || Number(point.basePriceCents) + Number(point.feeCents) === point.priceCents);
  const coverageValid = (coverage: unknown) => record(coverage) && date(coverage.requestedFrom) && date(coverage.requestedTo) &&
    nullableDate(coverage.oldestObservedAt) && nullableDate(coverage.newestObservedAt) && ['collecting', 'partial', 'complete'].includes(String(coverage.status)) &&
    typeof coverage.historicalBackfillAvailable === 'boolean' && text(coverage.note, 2000);
  const gamesValid = value.games.every((item: unknown) => record(item) && ['id', 'name', 'sourceUrl', 'edition'].every(key => text(item[key])) &&
    ['allkeyshop', 'steam'].includes(String(item.provider)) && ['eu-global', 'global'].includes(String(item.region)) && ['best', 'card', 'paypal'].includes(String(item.payment)) &&
    typeof item.officialOnly === 'boolean' && typeof item.stale === 'boolean' && typeof item.targetReached === 'boolean' && typeof item.includeInWidget === 'boolean' && nullableText(item.error) &&
    nullableText(item.steamAppId) && nullableDate(item.lastTargetReachedAt) && nullableDate(item.lastAttemptAt) && nullableDate(item.lastSuccessAt) &&
    (item.targetCents === null || cents(item.targetCents)) && (item.lowestCents === null || cents(item.lowestCents)) && nullableDate(item.lowestObservedAt) &&
    (item.twoYearLowCents === null || cents(item.twoYearLowCents)) && nullableDate(item.twoYearLowObservedAt) && coverageValid(item.historyCoverage) &&
    ['verified', 'needs_review', 'not_found'].includes(String(item.counterpartStatus)) && nullableText(item.counterpartNote) &&
    ['lowestActivationPlatform', 'lowestDeliveryType', 'lowestLanguageRestriction', 'twoYearLowActivationPlatform', 'twoYearLowDeliveryType', 'twoYearLowLanguageRestriction'].every(key => nullableText(item[key])) &&
    (item.changeCents === null || typeof item.changeCents === 'number') && (item.current === null || pointValid(item.current)) &&
    Array.isArray(item.history) && item.history.length <= 2160 && item.history.every(pointValid) && Array.isArray(item.salePeriods) && item.salePeriods.every((period: unknown) =>
      record(period) && date(period.firstObservedAt) && date(period.lastObservedAt) && nullableDate(period.endedObservedAt) && cents(period.lowestPriceCents) && (period.discountPercent === null || typeof period.discountPercent === 'number')));
  return softwareValid && gamesValid;
}

export function clearCache(userId?: string) {
  try {
    localStorage.removeItem('watchboard.dashboard.v1');
    if (userId) {
      localStorage.removeItem('watchboard.dashboard.v2.' + userId);
      localStorage.removeItem('watchboard.dashboard.v3.' + userId);
      localStorage.removeItem(CACHE_PREFIX + userId);
    }
  } catch { /* Browser storage is optional. */ }
}
export function readCache(userId: string): SavedDashboard | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CACHE_PREFIX + userId) ?? 'null');
    return record(raw) && raw.schema === 4 && raw.owner === userId && date(raw.savedAt) && nullableDate(raw.directCheckedAt) &&
      typeof raw.directSucceeded === 'boolean' && isDashboard(raw.data) && raw.data.user.id === userId ? raw as unknown as SavedDashboard : null;
  } catch { return null; }
}

// Only the latest-wins hook commits this snapshot. An obsolete request must never replace a newer cache.
export function commitDashboard(userId: string, result: DashboardLoad): boolean {
  if (result.data.user.id !== userId || !isDashboard(result.data)) return false;
  try {
    localStorage.removeItem('watchboard.dashboard.v1');
    localStorage.removeItem('watchboard.dashboard.v2.' + userId);
    localStorage.removeItem('watchboard.dashboard.v3.' + userId);
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify({ schema: 4, owner: userId,
      savedAt: result.cachedAt ?? new Date().toISOString(), directCheckedAt: result.mode === 'panel' ? null : result.directCheckedAt ?? null,
      directSucceeded: result.mode === 'direct', data: result.data }));
    return true;
  } catch { return false; }
}

async function json(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(6000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function readDirectRelease(watch: SoftwareWatch, signal?: AbortSignal): Promise<{ version: string; url: string }> {
  if ((watch.provider === 'github' || watch.provider === 'github-tags') && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/.test(watch.source)) {
    if (watch.provider === 'github-tags') {
      const tags = await json(`https://api.github.com/repos/${watch.source}/tags?per_page=30`, signal);
      if (!Array.isArray(tags)) throw new Error('Formato de tags no reconocido.');
      const names = tags.filter(record).map(x => x.name).filter((x): x is string => text(x, 100) && !x.includes('-') && compareVersions(x, x) === 'current');
      if (!names.length) throw new Error('Sin tags estables.');
      const version = names.reduce((a, b) => compareVersions(a, b) === 'update' ? b : a);
      return { version, url: `https://github.com/${watch.source}/releases/tag/${encodeURIComponent(version)}` };
    }
    const release = await json(`https://api.github.com/repos/${watch.source}/releases/latest`, signal);
    if (record(release) && text(release.tag_name, 100) && release.draft === false && release.prerelease === false)
      return { version: release.tag_name, url: `https://github.com/${watch.source}/releases/tag/${encodeURIComponent(release.tag_name)}` };
  } else if (watch.provider === 'npm' && /^(?:@[a-z0-9][a-z0-9._-]{0,99}\/)?[a-z0-9][a-z0-9._-]{0,99}$/.test(watch.source)) {
    const release = await json(`https://registry.npmjs.org/${encodeURIComponent(watch.source)}/latest`, signal);
    if (record(release) && text(release.version, 100)) return { version: release.version, url: `https://www.npmjs.com/package/${watch.source}` };
  } else if (watch.provider === 'node-lts') {
    const releases = await json('https://nodejs.org/dist/index.json', signal);
    if (Array.isArray(releases)) {
      const lts = releases.find(x => record(x) && typeof x.lts === 'string') as Record<string, unknown> | undefined;
      if (lts && text(lts.version, 100)) return { version: lts.version, url: 'https://nodejs.org/en/download' };
    }
  } else if (watch.provider === 'dotnet') {
    const releases = await json('https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/10.0/releases.json', signal);
    if (record(releases) && text(releases['latest-sdk'], 100)) return { version: releases['latest-sdk'], url: 'https://dotnet.microsoft.com/download/dotnet/10.0' };
  }
  throw new Error('La fuente no permite una consulta directa o ha cambiado de formato.');
}

export function offlineGames(games: GameWatch[]): GameWatch[] { return games.map(game => ({ ...game, stale: true, targetReached: false })); }

export async function loadDashboard(userId: string, signal?: AbortSignal, allowFallback = true): Promise<DashboardLoad> {
  try {
    const timeout = AbortSignal.timeout(6000);
    const response = await fetch('/api/dashboard', { credentials: 'same-origin', headers: { 'X-Watchboard-User': userId }, signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) throw new HttpError('Vuelve a iniciar sesión.', response.status);
    if (!response.ok) throw new Error('Panel no disponible.');
    const data: unknown = await response.json();
    if (!isDashboard(data)) throw new Error('Respuesta del panel no reconocida.');
    if (data.user.id !== userId) throw new HttpError('La sesión ha cambiado. Vuelve a entrar.', 401);
    return { data, mode: 'panel', cachedAt: null, cacheSaved: true };
  } catch (error) {
    if (signal?.aborted || error instanceof HttpError && [401, 403].includes(error.status)) throw error;
    if (!allowFallback) throw new Error('Guardado, pero no se pudo recargar la vista. Reintenta la conexión.', { cause: error });
    const saved = readCache(userId);
    if (!saved) throw new Error('No se puede conectar al panel y no hay una copia de tu usuario en este navegador.', { cause: error });
    const data = { ...saved.data, games: offlineGames(saved.data.games) };
    if (saved.directCheckedAt && Date.now() - Date.parse(saved.directCheckedAt) < DIRECT_INTERVAL_MS)
      return { data, mode: saved.directSucceeded ? 'direct' : 'cache', cachedAt: saved.savedAt, cacheSaved: true, directCheckedAt: saved.directCheckedAt };
    let directSucceeded = false;
    const software: SoftwareWatch[] = [];
    for (let i = 0; i < data.software.length; i += 2) {
      software.push(...await Promise.all(data.software.slice(i, i + 2).map(async watch => {
        try {
          const release = await readDirectRelease(watch, signal);
          directSucceeded = true;
          return { ...watch, latestVersion: release.version, releaseUrl: release.url, comparison: compareVersions(watch.installedVersion, release.version),
            lastAttemptAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), stale: false, error: null };
        } catch { return { ...watch, stale: true, error: 'Fuente no disponible. Última lectura guardada.' }; }
      })));
      if (signal?.aborted) throw signal.reason;
    }
    return { data: { ...data, software }, mode: directSucceeded ? 'direct' : 'cache', cachedAt: saved.savedAt,
      cacheSaved: true, directCheckedAt: new Date().toISOString() };
  }
}
