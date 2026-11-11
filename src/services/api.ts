import type { AuthSession, ConfigDocument, GameMutation, ImportPreview, Location, NewGame, NewSoftware, RefreshOptions, RefreshResult, ResolvedGame, UpdateGame, UpdateSoftware, User, WidgetPreferences } from '../types';

export class HttpError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'HttpError'; }
}
export async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal, expectedUser?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: { 'X-Watchboard-Client': 'web', ...(expectedUser ? { 'X-Watchboard-User': expectedUser } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { detail?: string } | null;
    throw new HttpError(error?.detail ?? (response.status === 429 ? 'Demasiadas consultas. Espera un minuto.' : response.status === 401 ? 'Tu sesión ha caducado. Vuelve a entrar.' : `El panel respondió con HTTP ${response.status}.`), response.status);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const api = {
  session: () => request<AuthSession>('/auth/session'),
  setup: (password: string) => request<User>('/auth/setup', 'POST', { password }),
  login: (username: string, password: string) => request<User>('/auth/login', 'POST', { username, password }),
};

// Account identity is captured for the entire asynchronous action, not looked up from mutable global state.
export function ownedApi(userId: string) {
  const call = <T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) => request<T>(path, method, body, signal, userId);
  return {
    logout: () => call<void>('/auth/logout', 'POST'),
    refresh: (options?: RefreshOptions) => call<RefreshResult>('/refresh', 'POST', options),
    detect: () => call<RefreshResult>('/software/detect', 'POST'),
    addSoftware: (value: NewSoftware) => call<{ id: string }>('/software', 'POST', value),
    updateSoftware: (id: string, value: UpdateSoftware) => call<void>(`/software/${id}`, 'PUT', value),
    setInstalled: (id: string, installedVersion: string | null, installedOn: string | null, locationId?: string | null) => call<void>(`/software/${id}/installed`, 'PATCH', {
      installedVersion, installedOn, ...(locationId === undefined ? {} : { locationId, updateLocation: true }),
    }),
    setLocation: (id: string, locationId: string | null) => call<void>(`/software/${id}/location`, 'PATCH', { locationId }),
    locations: () => call<Location[]>('/locations'),
    addLocation: (name: string) => call<Location>('/locations', 'POST', { name }),
    deleteSoftware: (id: string) => call<void>(`/software/${id}`, 'DELETE'),
    includeSoftware: (id: string, included: boolean) => call<void>(`/software/${id}/widget`, 'PATCH', { included }),
    resolveGame: (sourceUrl: string, signal?: AbortSignal) => call<ResolvedGame>('/games/resolve', 'POST', { sourceUrl }, signal),
    addGame: (value: NewGame) => call<GameMutation>('/games', 'POST', value),
    updateGame: (id: string, value: UpdateGame) => call<GameMutation>(`/games/${id}`, 'PUT', value),
    pairGame: (id: string, sourceUrl?: string | null) => call<GameMutation>(`/games/${id}/counterpart`, 'POST', { sourceUrl }),
    setTarget: (id: string, targetCents: number | null) => call<void>(`/games/${id}/target`, 'PATCH', { targetCents }),
    deleteGame: (id: string) => call<void>(`/games/${id}`, 'DELETE'),
    includeGame: (id: string, included: boolean) => call<void>(`/games/${id}/widget`, 'PATCH', { included }),
    preferences: () => call<WidgetPreferences>('/preferences'),
    savePreferences: (value: WidgetPreferences) => call<WidgetPreferences>('/preferences', 'PUT', value),
    exportConfiguration: () => call<ConfigDocument>('/configuration'),
    previewConfiguration: (value: unknown) => call<ImportPreview>('/configuration/preview', 'POST', value),
    importConfiguration: (value: unknown) => call<ImportPreview>('/configuration/import', 'POST', value),
    users: () => call<User[]>('/users'),
    addUser: (value: { username: string; displayName: string; password: string; isAdmin: boolean }) => call<User>('/users', 'POST', value),
    enableUser: (id: string, enabled: boolean) => call<void>(`/users/${id}/enabled`, 'PATCH', { enabled }),
  };
}
