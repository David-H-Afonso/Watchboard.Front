export type Comparison = 'update' | 'current' | 'ahead' | 'unknown';
export type ConnectionMode = 'panel' | 'direct' | 'cache';
export interface User { id: string; username: string; displayName: string; isAdmin: boolean; enabled: boolean }
export interface AuthSession { setupRequired: boolean; user: User | null }
export interface Location { id: string; name: string }
export interface WidgetPreferences {
  onlyActionable: boolean;
  showVersions: boolean;
  showGames: boolean;
  showSales: boolean;
  showPriceDrops: boolean;
  showErrors: boolean;
  maxItems: number;
  softwareLocationIds: string[] | null;
  softwareUpdatesOnly: boolean;
}
export const defaultPreferences: WidgetPreferences = {
  onlyActionable: true, showVersions: true, showGames: true, showSales: false,
  showPriceDrops: false, showErrors: false, maxItems: 8, softwareLocationIds: null, softwareUpdatesOnly: true,
};
export interface SoftwareWatch {
  id: string;
  name: string;
  group: 'pc' | 'server' | 'project';
  provider: 'github' | 'github-tags' | 'npm' | 'node-lts' | 'dotnet';
  source: string;
  sourceUrl: string;
  localTool: string | null;
  installedVersion: string | null;
  installedOn: string | null;
  installedMethod: 'detected' | 'manual' | null;
  installedCheckedAt: string | null;
  detectionError: string | null;
  latestVersion: string | null;
  releaseUrl: string | null;
  comparison: Comparison;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  error: string | null;
  stale: boolean;
  includeInWidget: boolean;
  releasePublishedAt: string | null;
  locationId: string | null;
  locationName: string | null;
}
export interface PricePoint {
  id: number;
  observedAt: string;
  priceCents: number;
  currency: string;
  merchant: string;
  region: string;
  edition: string;
  offerUrl: string;
  coupon: string | null;
  matchingOffers: number;
  originalPriceCents: number | null;
  discountPercent: number | null;
  saleEndsAt: string | null;
  paymentMethod: 'card' | 'paypal' | null;
  basePriceCents: number | null;
  feeCents: number | null;
  feeBasis: 'included' | 'not_applicable' | 'unknown';
  activationPlatform: string | null;
  deliveryType: 'key' | 'gift' | 'direct' | 'unknown';
  languageRestriction: string | null;
}
export interface SalePeriod {
  firstObservedAt: string;
  lastObservedAt: string;
  endedObservedAt: string | null;
  lowestPriceCents: number;
  discountPercent: number | null;
}
export type MatchStatus = 'verified' | 'needs_review' | 'not_found';
export interface HistoryCoverage {
  requestedFrom: string;
  requestedTo: string;
  oldestObservedAt: string | null;
  newestObservedAt: string | null;
  status: 'collecting' | 'partial' | 'complete';
  historicalBackfillAvailable: boolean;
  note: string;
}
export interface GameWatch {
  id: string;
  name: string;
  provider: 'allkeyshop' | 'steam';
  sourceUrl: string;
  edition: string;
  region: 'eu-global' | 'global';
  payment: 'best' | 'card' | 'paypal';
  officialOnly: boolean;
  targetCents: number | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  error: string | null;
  stale: boolean;
  targetReached: boolean;
  current: PricePoint | null;
  lowestCents: number | null;
  changeCents: number | null;
  history: PricePoint[];
  includeInWidget: boolean;
  steamAppId: string | null;
  salePeriods: SalePeriod[];
  lastTargetReachedAt: string | null;
  lowestObservedAt: string | null;
  twoYearLowCents: number | null;
  twoYearLowObservedAt: string | null;
  historyCoverage: HistoryCoverage;
  counterpartStatus: MatchStatus;
  counterpartNote: string | null;
  counterpartUrl?: string | null;
  lowestActivationPlatform: string | null;
  lowestDeliveryType: string | null;
  lowestLanguageRestriction: string | null;
  twoYearLowActivationPlatform: string | null;
  twoYearLowDeliveryType: string | null;
  twoYearLowLanguageRestriction: string | null;
}
export interface Dashboard {
  generatedAt: string;
  host: string;
  platform: string;
  pollingEnabled: boolean;
  priceIntervalMinutes: number;
  versionIntervalMinutes: number;
  software: SoftwareWatch[];
  games: GameWatch[];
  user: User;
  preferences: WidgetPreferences;
  locations: Location[];
}
export interface DashboardLoad {
  data: Dashboard;
  mode: ConnectionMode;
  cachedAt: string | null;
  cacheSaved: boolean;
  directCheckedAt?: string | null;
}
export interface RefreshResult { checked: number; succeeded: number; busy: boolean; finishedAt: string }
export interface RefreshOptions { force: boolean; scope: 'all' | 'prices' | 'versions' }
export type NewSoftware = Pick<SoftwareWatch, 'name' | 'group' | 'source' | 'installedVersion'> & { provider: 'github' | 'npm'; locationId?: string | null };
export type NewGame = Pick<GameWatch, 'name' | 'sourceUrl' | 'edition' | 'region' | 'payment' | 'officialOnly' | 'targetCents'> & { includeSteam?: boolean; includeCounterpart?: boolean };
export interface ResolvedGame {
  provider: 'allkeyshop' | 'steam'; sourceUrl: string; name: string; steamAppId: string | null; editions: string[];
  steamUrl: string | null; allKeyShopUrl: string | null; matchStatus: MatchStatus; matchNote: string | null;
}
export interface GameMutation { id: string; relatedIds: string[]; matchStatus: MatchStatus; matchNote: string | null }
export interface WidgetItem {
  id: string; watchId: string; kind: 'version' | 'target' | 'sale' | 'drop' | 'error' | 'software' | 'game';
  title: string; value: string; detail: string; sourceUrl: string; observedAt: string | null;
}
export interface ConfigDocument {
  format: 'watchboard-config'; version: 1 | 2; exportedAt?: string; exportedBy?: string;
  locations?: string[];
  preferences: Omit<WidgetPreferences, 'softwareLocationIds' | 'softwareUpdatesOnly'> & { softwareLocations?: string[] | null; softwareUpdatesOnly?: boolean };
  software: Array<Pick<SoftwareWatch, 'name' | 'group' | 'provider' | 'source' | 'localTool' | 'installedVersion' | 'installedOn' | 'includeInWidget'> & { location?: string | null }>;
  games: Array<Pick<GameWatch, 'name' | 'sourceUrl' | 'edition' | 'region' | 'payment' | 'officialOnly' | 'targetCents' | 'includeInWidget' | 'steamAppId'>>;
}
export interface ImportPreview { softwareAdded: number; softwareUpdated: number; gamesAdded: number; gamesUpdated: number; warnings: string[] }
